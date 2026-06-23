import csv
import io
from datetime import datetime, date, time
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, select, col, func

from app.database import get_session
from app.models.produto import Produto
from app.models.financeiro import MovimentacaoFinanceira, TipoFinanceiro
from app.models.cliente import Cliente, Divida

router = APIRouter(prefix="/api/relatorios", tags=["relatorios"])

CATEGORIA_LABELS = {
    "PNEU": "Pneus",
    "OLEO": "Óleos",
    "BATERIA": "Baterias",
    "FILTRO": "Filtros",
    "CAMARA": "Câmaras",
    "VALVULA": "Válvulas",
}


# ----------------------------- helpers -----------------------------

def _intervalo(inicio: str | None, fim: str | None) -> tuple[datetime, datetime, date, date]:
    """Resolve o intervalo do relatório. Padrão: mês corrente."""
    hoje = date.today()
    di = date.fromisoformat(inicio) if inicio else hoje.replace(day=1)
    df = date.fromisoformat(fim) if fim else hoje
    if df < di:
        raise HTTPException(status_code=400, detail="Data final anterior à inicial")
    return datetime.combine(di, time.min), datetime.combine(df, time.max), di, df


def _moeda(valor: float) -> str:
    """Formata número no padrão brasileiro para abrir no Excel (vírgula decimal)."""
    return f"{valor:.2f}".replace(".", ",")


# ----------------------------- coleta de dados -----------------------------

def _coletar(session: Session, inicio_dt: datetime, fim_dt: datetime) -> dict:
    # Estoque
    produtos = session.exec(select(Produto)).all()
    valor_custo = sum(p.quantidade * p.preco_compra for p in produtos)
    valor_venda = sum(p.quantidade * p.preco_venda for p in produtos)
    em_alerta = [p for p in produtos if p.quantidade <= p.quantidade_minima]

    por_categoria: dict[str, dict] = {}
    for p in produtos:
        c = por_categoria.setdefault(
            p.categoria, {"itens": 0, "quantidade": 0, "valor_custo": 0.0, "valor_venda": 0.0}
        )
        c["itens"] += 1
        c["quantidade"] += p.quantidade
        c["valor_custo"] += p.quantidade * p.preco_compra
        c["valor_venda"] += p.quantidade * p.preco_venda

    # Faturamento (período)
    entradas = session.exec(
        select(func.coalesce(func.sum(MovimentacaoFinanceira.valor), 0)).where(
            MovimentacaoFinanceira.tipo == TipoFinanceiro.ENTRADA,
            col(MovimentacaoFinanceira.created_at) >= inicio_dt,
            col(MovimentacaoFinanceira.created_at) <= fim_dt,
        )
    ).one()
    saidas = session.exec(
        select(func.coalesce(func.sum(MovimentacaoFinanceira.valor), 0)).where(
            MovimentacaoFinanceira.tipo == TipoFinanceiro.SAIDA,
            col(MovimentacaoFinanceira.created_at) >= inicio_dt,
            col(MovimentacaoFinanceira.created_at) <= fim_dt,
        )
    ).one()

    entradas_por_cat = session.exec(
        select(
            MovimentacaoFinanceira.categoria,
            func.coalesce(func.sum(MovimentacaoFinanceira.valor), 0),
        )
        .where(
            MovimentacaoFinanceira.tipo == TipoFinanceiro.ENTRADA,
            col(MovimentacaoFinanceira.created_at) >= inicio_dt,
            col(MovimentacaoFinanceira.created_at) <= fim_dt,
        )
        .group_by(MovimentacaoFinanceira.categoria)
    ).all()

    saidas_por_cat = session.exec(
        select(
            MovimentacaoFinanceira.categoria,
            func.coalesce(func.sum(MovimentacaoFinanceira.valor), 0),
        )
        .where(
            MovimentacaoFinanceira.tipo == TipoFinanceiro.SAIDA,
            col(MovimentacaoFinanceira.created_at) >= inicio_dt,
            col(MovimentacaoFinanceira.created_at) <= fim_dt,
        )
        .group_by(MovimentacaoFinanceira.categoria)
    ).all()

    # Fiado
    total_clientes = session.exec(select(func.count(Cliente.id))).one()
    dividas_pendentes = session.exec(
        select(func.count(Divida.id)).where(Divida.quitada == False)
    ).one()
    divida_total = session.exec(
        select(func.coalesce(func.sum(Divida.valor_total), 0)).where(Divida.quitada == False)
    ).one()
    divida_paga = session.exec(
        select(func.coalesce(func.sum(Divida.valor_pago), 0)).where(Divida.quitada == False)
    ).one()

    return {
        "estoque": {
            "total_produtos": len(produtos),
            "quantidade_total": sum(p.quantidade for p in produtos),
            "valor_custo": float(valor_custo),
            "valor_venda": float(valor_venda),
            "itens_em_alerta": len(em_alerta),
            "por_categoria": [
                {
                    "categoria": CATEGORIA_LABELS.get(k, k),
                    "itens": v["itens"],
                    "quantidade": v["quantidade"],
                    "valor_custo": round(v["valor_custo"], 2),
                    "valor_venda": round(v["valor_venda"], 2),
                }
                for k, v in sorted(por_categoria.items())
            ],
        },
        "faturamento": {
            "entradas": float(entradas),
            "saidas": float(saidas),
            "saldo": float(entradas) - float(saidas),
            "entradas_por_categoria": [
                {"categoria": c, "valor": float(v)} for c, v in entradas_por_cat
            ],
            "saidas_por_categoria": [
                {"categoria": c, "valor": float(v)} for c, v in saidas_por_cat
            ],
        },
        "fiado": {
            "total_clientes": total_clientes or 0,
            "dividas_pendentes": dividas_pendentes or 0,
            "valor_pendente": float(divida_total) - float(divida_paga),
        },
        "_produtos": produtos,
    }


# ----------------------------- endpoints -----------------------------

@router.get("/geral")
def relatorio_geral(
    inicio: str | None = Query(None, description="YYYY-MM-DD"),
    fim: str | None = Query(None, description="YYYY-MM-DD"),
    session: Session = Depends(get_session),
):
    inicio_dt, fim_dt, di, df = _intervalo(inicio, fim)
    dados = _coletar(session, inicio_dt, fim_dt)
    dados.pop("_produtos", None)
    dados["periodo"] = {"inicio": di.isoformat(), "fim": df.isoformat()}
    return dados


class ExportarRequest(BaseModel):
    pasta_destino: str
    inicio: str | None = None
    fim: str | None = None


@router.post("/exportar")
def exportar_csv(req: ExportarRequest, session: Session = Depends(get_session)):
    pasta = Path(req.pasta_destino)
    if not pasta.exists():
        raise HTTPException(status_code=400, detail=f"Pasta não encontrada: {pasta}")

    inicio_dt, fim_dt, di, df = _intervalo(req.inicio, req.fim)
    dados = _coletar(session, inicio_dt, fim_dt)
    produtos = dados.pop("_produtos")
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    periodo_str = f"{di.strftime('%d/%m/%Y')} a {df.strftime('%d/%m/%Y')}"
    gerados = []

    def _escrever(nome: str, montar) -> None:
        buf = io.StringIO()
        montar(csv.writer(buf, delimiter=";", lineterminator="\n"))
        caminho = pasta / nome
        # BOM para o Excel reconhecer UTF-8 e exibir acentos corretamente
        caminho.write_text("﻿" + buf.getvalue(), encoding="utf-8")
        gerados.append(str(caminho))

    # 1. Resumo (visão geral)
    def _resumo(w):
        e, f, fi = dados["estoque"], dados["faturamento"], dados["fiado"]
        w.writerow(["Relatório Geral - Ricardo Pneus"])
        w.writerow(["Período", periodo_str])
        w.writerow([])
        w.writerow(["ESTOQUE"])
        w.writerow(["Produtos cadastrados", e["total_produtos"]])
        w.writerow(["Quantidade total em estoque", e["quantidade_total"]])
        w.writerow(["Valor do estoque (custo)", _moeda(e["valor_custo"])])
        w.writerow(["Valor do estoque (venda)", _moeda(e["valor_venda"])])
        w.writerow(["Itens em alerta de reposição", e["itens_em_alerta"]])
        w.writerow([])
        w.writerow(["FATURAMENTO (período)"])
        w.writerow(["Entradas", _moeda(f["entradas"])])
        w.writerow(["Saídas", _moeda(f["saidas"])])
        w.writerow(["Saldo", _moeda(f["saldo"])])
        w.writerow([])
        w.writerow(["FIADO"])
        w.writerow(["Clientes", fi["total_clientes"]])
        w.writerow(["Dívidas pendentes", fi["dividas_pendentes"]])
        w.writerow(["Valor a receber", _moeda(fi["valor_pendente"])])

    # 2. Estoque detalhado
    def _estoque(w):
        w.writerow(["Nome", "Categoria", "Subcategoria", "Quantidade",
                    "Qtd. mínima", "Preço compra", "Preço venda", "Valor total (venda)"])
        for p in sorted(produtos, key=lambda x: x.nome.lower()):
            w.writerow([
                p.nome,
                CATEGORIA_LABELS.get(p.categoria, p.categoria),
                p.subcategoria or "",
                p.quantidade,
                p.quantidade_minima,
                _moeda(p.preco_compra),
                _moeda(p.preco_venda),
                _moeda(p.quantidade * p.preco_venda),
            ])

    # 3. Faturamento detalhado (movimentações do período)
    def _faturamento(w):
        movs = session.exec(
            select(MovimentacaoFinanceira)
            .where(
                col(MovimentacaoFinanceira.created_at) >= inicio_dt,
                col(MovimentacaoFinanceira.created_at) <= fim_dt,
            )
            .order_by(col(MovimentacaoFinanceira.created_at))
        ).all()
        w.writerow(["Data", "Tipo", "Categoria", "Descrição", "Valor"])
        for m in movs:
            w.writerow([
                m.created_at.strftime("%d/%m/%Y %H:%M"),
                "Entrada" if m.tipo == TipoFinanceiro.ENTRADA else "Saída",
                m.categoria,
                m.descricao,
                _moeda(m.valor),
            ])

    _escrever(f"resumo_{ts}.csv", _resumo)
    _escrever(f"estoque_{ts}.csv", _estoque)
    _escrever(f"faturamento_{ts}.csv", _faturamento)

    return {"ok": True, "arquivos": gerados, "pasta": str(pasta)}
