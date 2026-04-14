from datetime import datetime, date, timedelta
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select, col, func
from pydantic import BaseModel

from app.database import get_session
from app.models.produto import Produto
from app.models.financeiro import MovimentacaoFinanceira, TipoFinanceiro
from app.models.cliente import Cliente, Divida


router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


class DashboardResponse(BaseModel):
    # Financeiro do dia
    entradas_hoje: float
    saidas_hoje: float
    saldo_hoje: float
    # Estoque
    total_produtos: int
    produtos_alerta: int
    # Fiado
    total_clientes: int
    dividas_pendentes: int
    valor_total_dividas: float
    valor_recebido_dividas: float


class MovimentacaoRecente(BaseModel):
    id: int
    tipo: str
    categoria: str
    descricao: str
    valor: float
    created_at: str


class ProdutoAlerta(BaseModel):
    id: int
    nome: str
    categoria: str
    quantidade: int
    quantidade_minima: int


@router.get("", response_model=DashboardResponse)
def obter_dashboard(session: Session = Depends(get_session)):
    hoje = date.today()
    inicio = datetime.combine(hoje, datetime.min.time())
    fim = datetime.combine(hoje, datetime.max.time())

    # Financeiro
    entradas = session.exec(
        select(func.coalesce(func.sum(MovimentacaoFinanceira.valor), 0)).where(
            MovimentacaoFinanceira.tipo == TipoFinanceiro.ENTRADA,
            col(MovimentacaoFinanceira.created_at) >= inicio,
            col(MovimentacaoFinanceira.created_at) <= fim,
        )
    ).one()

    saidas = session.exec(
        select(func.coalesce(func.sum(MovimentacaoFinanceira.valor), 0)).where(
            MovimentacaoFinanceira.tipo == TipoFinanceiro.SAIDA,
            col(MovimentacaoFinanceira.created_at) >= inicio,
            col(MovimentacaoFinanceira.created_at) <= fim,
        )
    ).one()

    # Estoque
    total_produtos = session.exec(select(func.count(Produto.id))).one()
    produtos_alerta = session.exec(
        select(func.count(Produto.id)).where(
            col(Produto.quantidade) <= col(Produto.quantidade_minima)
        )
    ).one()

    # Fiado
    total_clientes = session.exec(select(func.count(Cliente.id))).one()
    dividas_pendentes = session.exec(
        select(func.count(Divida.id)).where(Divida.quitada == False)
    ).one()
    valor_total = session.exec(
        select(func.coalesce(func.sum(Divida.valor_total), 0)).where(Divida.quitada == False)
    ).one()
    valor_recebido = session.exec(
        select(func.coalesce(func.sum(Divida.valor_pago), 0)).where(Divida.quitada == False)
    ).one()

    return DashboardResponse(
        entradas_hoje=float(entradas),
        saidas_hoje=float(saidas),
        saldo_hoje=float(entradas) - float(saidas),
        total_produtos=total_produtos or 0,
        produtos_alerta=produtos_alerta or 0,
        total_clientes=total_clientes or 0,
        dividas_pendentes=dividas_pendentes or 0,
        valor_total_dividas=float(valor_total),
        valor_recebido_dividas=float(valor_recebido),
    )


@router.get("/movimentacoes-recentes")
def movimentacoes_recentes(session: Session = Depends(get_session)):
    movs = session.exec(
        select(MovimentacaoFinanceira)
        .order_by(col(MovimentacaoFinanceira.created_at).desc())
        .limit(10)
    ).all()
    return [
        MovimentacaoRecente(
            id=m.id,
            tipo=m.tipo,
            categoria=m.categoria,
            descricao=m.descricao,
            valor=m.valor,
            created_at=m.created_at.isoformat(),
        )
        for m in movs
    ]


@router.get("/fluxo-semanal")
def fluxo_semanal(
    dias: int = Query(7),
    session: Session = Depends(get_session),
):
    resultado = []
    hoje = date.today()
    for i in range(dias - 1, -1, -1):
        dia = hoje - timedelta(days=i)
        inicio = datetime.combine(dia, datetime.min.time())
        fim = datetime.combine(dia, datetime.max.time())

        entradas = session.exec(
            select(func.coalesce(func.sum(MovimentacaoFinanceira.valor), 0)).where(
                MovimentacaoFinanceira.tipo == TipoFinanceiro.ENTRADA,
                col(MovimentacaoFinanceira.created_at) >= inicio,
                col(MovimentacaoFinanceira.created_at) <= fim,
            )
        ).one()

        saidas = session.exec(
            select(func.coalesce(func.sum(MovimentacaoFinanceira.valor), 0)).where(
                MovimentacaoFinanceira.tipo == TipoFinanceiro.SAIDA,
                col(MovimentacaoFinanceira.created_at) >= inicio,
                col(MovimentacaoFinanceira.created_at) <= fim,
            )
        ).one()

        resultado.append({
            "dia": dia.strftime("%d/%m"),
            "dia_semana": ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"][dia.weekday()],
            "entradas": float(entradas),
            "saidas": float(saidas),
            "saldo": float(entradas) - float(saidas),
        })
    return resultado


@router.get("/estoque-por-categoria")
def estoque_por_categoria(session: Session = Depends(get_session)):
    resultados = session.exec(
        select(
            Produto.categoria,
            func.count(Produto.id).label("quantidade_itens"),
            func.coalesce(func.sum(Produto.quantidade), 0).label("quantidade_total"),
            func.coalesce(func.sum(Produto.quantidade * Produto.preco_venda), 0).label("valor_total"),
        ).group_by(Produto.categoria)
    ).all()

    labels = {
        "PNEU": "Pneus",
        "OLEO": "Óleos",
        "BATERIA": "Baterias",
        "FILTRO": "Filtros",
        "CAMARA": "Câmaras",
        "VALVULA": "Válvulas",
    }

    return [
        {
            "categoria": labels.get(r[0], r[0]),
            "itens": r[1],
            "quantidade": int(r[2]),
            "valor": float(r[3]),
        }
        for r in resultados
    ]


@router.get("/produtos-alerta")
def produtos_em_alerta(session: Session = Depends(get_session)):
    produtos = session.exec(
        select(Produto)
        .where(col(Produto.quantidade) <= col(Produto.quantidade_minima))
        .order_by(Produto.quantidade)
        .limit(10)
    ).all()
    return [
        ProdutoAlerta(
            id=p.id,
            nome=p.nome,
            categoria=p.categoria,
            quantidade=p.quantidade,
            quantidade_minima=p.quantidade_minima,
        )
        for p in produtos
    ]
