from datetime import datetime, date, time
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, select, col, func

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Table,
    TableStyle,
    Paragraph,
    Spacer,
)

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

CATEGORIA_FIN_LABELS = {
    "VENDA": "Vendas",
    "SERVICO": "Serviços",
    "RECEBIMENTO_DIVIDA": "Recebimento de fiado",
    "FORNECEDOR": "Fornecedores",
    "CONTA_FIXA": "Contas fixas",
    "DESPESA_OPERACIONAL": "Despesas operacionais",
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
    """Formata no padrão brasileiro: R$ 1.234,56."""
    inteiro = f"{valor:,.2f}"  # ex: 1,234.56
    # Troca separadores en-US -> pt-BR
    inteiro = inteiro.replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {inteiro}"


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


# Cores da identidade do relatório
_COR_HEADER = colors.HexColor("#111827")
_COR_ZEBRA = colors.HexColor("#f9fafb")
_COR_GRID = colors.HexColor("#d1d5db")
_COR_SUB = colors.HexColor("#1f2937")


def _tabela(header: list[str], linhas: list[list], larguras: list[float],
            alinhar_dir: list[int] | None = None) -> Table:
    """Monta uma tabela estilizada (cabeçalho escuro, zebra, grade)."""
    alinhar_dir = alinhar_dir or []
    t = Table([header, *linhas], colWidths=larguras, repeatRows=1)
    estilo = [
        ("BACKGROUND", (0, 0), (-1, 0), _COR_HEADER),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, _COR_GRID),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, _COR_ZEBRA]),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
    for c in alinhar_dir:
        estilo.append(("ALIGN", (c, 0), (c, -1), "RIGHT"))
    t.setStyle(TableStyle(estilo))
    return t


@router.post("/exportar")
def exportar_pdf(req: ExportarRequest, session: Session = Depends(get_session)):
    pasta = Path(req.pasta_destino)
    if not pasta.exists():
        raise HTTPException(status_code=400, detail=f"Pasta não encontrada: {pasta}")

    inicio_dt, fim_dt, di, df = _intervalo(req.inicio, req.fim)
    dados = _coletar(session, inicio_dt, fim_dt)
    produtos = dados.pop("_produtos")
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    periodo_str = f"{di.strftime('%d/%m/%Y')} a {df.strftime('%d/%m/%Y')}"
    caminho = pasta / f"relatorio_{ts}.pdf"

    styles = getSampleStyleSheet()
    st_titulo = ParagraphStyle("titulo", parent=styles["Title"], fontSize=18, spaceAfter=2)
    st_sub = ParagraphStyle("sub", parent=styles["Normal"], fontSize=9,
                            textColor=colors.grey, spaceAfter=14)
    st_secao = ParagraphStyle("secao", parent=styles["Heading2"], fontSize=13,
                              textColor=_COR_SUB, spaceBefore=16, spaceAfter=6)
    st_celula = ParagraphStyle("celula", parent=styles["Normal"], fontSize=8, leading=10)

    e, f, fi = dados["estoque"], dados["faturamento"], dados["fiado"]

    story: list = [
        Paragraph("Relatório Geral — Ricardo Pneus", st_titulo),
        Paragraph(
            f"Período: {periodo_str} &nbsp;•&nbsp; "
            f"Gerado em {datetime.now().strftime('%d/%m/%Y %H:%M')}",
            st_sub,
        ),
    ]

    # ---------------- Resumo ----------------
    story.append(Paragraph("Resumo", st_secao))
    resumo = [
        ["Estoque — produtos cadastrados", str(e["total_produtos"])],
        ["Estoque — quantidade total", str(e["quantidade_total"])],
        ["Estoque — valor (custo)", _moeda(e["valor_custo"])],
        ["Estoque — valor (venda)", _moeda(e["valor_venda"])],
        ["Estoque — itens em alerta", str(e["itens_em_alerta"])],
        ["Faturamento — entradas", _moeda(f["entradas"])],
        ["Faturamento — saídas", _moeda(f["saidas"])],
        ["Faturamento — saldo", _moeda(f["saldo"])],
        ["Fiado — clientes", str(fi["total_clientes"])],
        ["Fiado — dívidas pendentes", str(fi["dividas_pendentes"])],
        ["Fiado — valor a receber", _moeda(fi["valor_pendente"])],
    ]
    story.append(_tabela(["Indicador", "Valor"], resumo, [120 * mm, 60 * mm], alinhar_dir=[1]))

    # ---------------- Estoque por categoria ----------------
    story.append(Paragraph("Estoque por Categoria", st_secao))
    cat_linhas = [
        [c["categoria"], str(c["itens"]), str(c["quantidade"]),
         _moeda(c["valor_custo"]), _moeda(c["valor_venda"])]
        for c in e["por_categoria"]
    ] or [["Nenhum produto cadastrado", "", "", "", ""]]
    story.append(_tabela(
        ["Categoria", "Itens", "Qtd", "Valor (custo)", "Valor (venda)"],
        cat_linhas, [50 * mm, 22 * mm, 22 * mm, 43 * mm, 43 * mm], alinhar_dir=[1, 2, 3, 4],
    ))

    # ---------------- Estoque detalhado ----------------
    story.append(Paragraph("Estoque Detalhado", st_secao))
    est_linhas = [
        [Paragraph(p.nome, st_celula), CATEGORIA_LABELS.get(p.categoria, p.categoria),
         p.subcategoria or "", str(p.quantidade), str(p.quantidade_minima),
         _moeda(p.preco_compra), _moeda(p.preco_venda), _moeda(p.quantidade * p.preco_venda)]
        for p in sorted(produtos, key=lambda x: x.nome.lower())
    ] or [["Nenhum produto cadastrado", "", "", "", "", "", "", ""]]
    story.append(_tabela(
        ["Nome", "Categoria", "Subcat.", "Qtd", "Qtd mín.",
         "Compra", "Venda", "Total (venda)"],
        est_linhas,
        [40 * mm, 22 * mm, 20 * mm, 12 * mm, 15 * mm, 22 * mm, 22 * mm, 27 * mm],
        alinhar_dir=[3, 4, 5, 6, 7],
    ))

    # ---------------- Faturamento detalhado ----------------
    story.append(Paragraph("Faturamento Detalhado", st_secao))
    movs = session.exec(
        select(MovimentacaoFinanceira)
        .where(
            col(MovimentacaoFinanceira.created_at) >= inicio_dt,
            col(MovimentacaoFinanceira.created_at) <= fim_dt,
        )
        .order_by(col(MovimentacaoFinanceira.created_at))
    ).all()
    fat_linhas = [
        [m.created_at.strftime("%d/%m/%Y %H:%M"),
         "Entrada" if m.tipo == TipoFinanceiro.ENTRADA else "Saída",
         CATEGORIA_FIN_LABELS.get(m.categoria, m.categoria),
         Paragraph(m.descricao or "", st_celula), _moeda(m.valor)]
        for m in movs
    ] or [["Sem movimentações no período", "", "", "", ""]]
    story.append(_tabela(
        ["Data", "Tipo", "Categoria", "Descrição", "Valor"],
        fat_linhas, [30 * mm, 18 * mm, 38 * mm, 64 * mm, 30 * mm], alinhar_dir=[4],
    ))

    doc = SimpleDocTemplate(
        str(caminho), pagesize=A4,
        leftMargin=15 * mm, rightMargin=15 * mm,
        topMargin=15 * mm, bottomMargin=15 * mm,
        title="Relatório Geral - Ricardo Pneus", author="Ricardo Pneus",
    )
    doc.build(story)

    return {"ok": True, "arquivos": [str(caminho)], "pasta": str(pasta)}
