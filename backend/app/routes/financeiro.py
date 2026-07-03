from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, col, func
from pydantic import BaseModel

from app.database import get_session
from app.models.financeiro import (
    MovimentacaoFinanceira,
    ItemMovimentacao,
    TipoFinanceiro,
    TipoItem,
)
from app.models.produto import Produto, MovimentacaoEstoque, TipoMovimentacao

router = APIRouter(prefix="/api/financeiro", tags=["financeiro"])


class ItemCreate(BaseModel):
    descricao: str
    quantidade: int = 1
    valor_unitario: float
    produto_id: int | None = None


class MovimentacaoCreate(BaseModel):
    tipo: TipoFinanceiro
    categoria: str = "VENDA"
    descricao: str = ""
    valor: float | None = None
    # Movimentação simples (saídas / compatibilidade)
    produto_id: int | None = None
    quantidade: int | None = None
    # Pedido de entrada com vários itens
    cliente_nome: str | None = None
    placa: str | None = None
    telefone: str | None = None
    itens: list[ItemCreate] | None = None


def _resumo_itens(itens: list[ItemCreate]) -> str:
    """Gera uma descrição-resumo do pedido para a listagem."""
    partes = [
        f"{it.descricao} (x{it.quantidade})" if it.quantidade and it.quantidade != 1 else it.descricao
        for it in itens
    ]
    resumo = ", ".join(partes)
    return resumo if len(resumo) <= 120 else resumo[:117] + "..."


class ResumoResponse(BaseModel):
    total_entradas: float
    total_saidas: float
    saldo: float


@router.get("")
def listar_movimentacoes(
    tipo: TipoFinanceiro | None = Query(None),
    data_inicio: date | None = Query(None),
    data_fim: date | None = Query(None),
    session: Session = Depends(get_session),
):
    query = select(MovimentacaoFinanceira)
    if tipo:
        query = query.where(MovimentacaoFinanceira.tipo == tipo)
    if data_inicio:
        query = query.where(
            col(MovimentacaoFinanceira.created_at) >= datetime.combine(data_inicio, datetime.min.time())
        )
    if data_fim:
        query = query.where(
            col(MovimentacaoFinanceira.created_at) <= datetime.combine(data_fim, datetime.max.time())
        )
    query = query.order_by(col(MovimentacaoFinanceira.created_at).desc())
    return session.exec(query).all()


@router.get("/resumo")
def resumo_dia(
    dia: date | None = Query(None),
    session: Session = Depends(get_session),
) -> ResumoResponse:
    target = dia or date.today()
    inicio = datetime.combine(target, datetime.min.time())
    fim = datetime.combine(target, datetime.max.time())

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

    return ResumoResponse(
        total_entradas=float(entradas),
        total_saidas=float(saidas),
        saldo=float(entradas) - float(saidas),
    )


@router.get("/{mov_id}")
def detalhe_movimentacao(mov_id: int, session: Session = Depends(get_session)):
    """Retorna a movimentação com seus itens (se for um pedido)."""
    mov = session.get(MovimentacaoFinanceira, mov_id)
    if not mov:
        raise HTTPException(status_code=404, detail="Movimentação não encontrada")
    itens = session.exec(
        select(ItemMovimentacao)
        .where(ItemMovimentacao.movimentacao_id == mov_id)
        .order_by(col(ItemMovimentacao.id))
    ).all()
    return {**mov.model_dump(), "itens": [i.model_dump() for i in itens]}


@router.post("", status_code=201)
def criar_movimentacao(data: MovimentacaoCreate, session: Session = Depends(get_session)):
    # ---- Pedido de entrada com vários itens ----
    if data.itens:
        if len(data.itens) == 0:
            raise HTTPException(status_code=400, detail="Pedido sem itens")

        # Valida estoque de todos os itens de produto antes de qualquer alteração
        for it in data.itens:
            if it.produto_id:
                produto = session.get(Produto, it.produto_id)
                if not produto:
                    raise HTTPException(status_code=404, detail=f"Produto {it.produto_id} não encontrado")
                if produto.quantidade < it.quantidade:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Estoque insuficiente de {produto.nome} ({produto.quantidade} disponível)",
                    )

        total = sum(it.valor_unitario * it.quantidade for it in data.itens)
        tem_produto = any(it.produto_id for it in data.itens)

        mov = MovimentacaoFinanceira(
            tipo=TipoFinanceiro.ENTRADA,
            # categoria derivada: VENDA se há produto, senão SERVICO
            categoria="VENDA" if tem_produto else "SERVICO",
            descricao=data.descricao or _resumo_itens(data.itens),
            valor=total,
            cliente_nome=data.cliente_nome or None,
            placa=data.placa or None,
            telefone=data.telefone or None,
        )
        session.add(mov)
        session.flush()  # garante mov.id para os itens

        for it in data.itens:
            item = ItemMovimentacao(
                movimentacao_id=mov.id,
                descricao=it.descricao,
                quantidade=it.quantidade,
                valor_unitario=it.valor_unitario,
                valor_total=it.valor_unitario * it.quantidade,
                produto_id=it.produto_id,
                tipo=TipoItem.PRODUTO if it.produto_id else TipoItem.SERVICO,
            )
            session.add(item)

            if it.produto_id:
                produto = session.get(Produto, it.produto_id)
                produto.quantidade -= it.quantidade
                produto.updated_at = datetime.now()
                session.add(produto)
                session.add(MovimentacaoEstoque(
                    produto_id=it.produto_id,
                    tipo=TipoMovimentacao.SAIDA,
                    quantidade=it.quantidade,
                    observacao=f"Venda (pedido #{mov.id}): {it.descricao}",
                ))

        session.commit()
        session.refresh(mov)
        return mov

    # ---- Movimentação simples (saídas / compatibilidade) ----
    if data.valor is None:
        raise HTTPException(status_code=400, detail="Valor obrigatório")

    # Venda simples com produto: baixa o estoque
    if data.produto_id and data.quantidade and data.categoria == "VENDA":
        produto = session.get(Produto, data.produto_id)
        if not produto:
            raise HTTPException(status_code=404, detail="Produto não encontrado")
        if produto.quantidade < data.quantidade:
            raise HTTPException(
                status_code=400,
                detail=f"Estoque insuficiente ({produto.quantidade} disponível)",
            )
        produto.quantidade -= data.quantidade
        produto.updated_at = datetime.now()
        session.add(produto)

        mov_estoque = MovimentacaoEstoque(
            produto_id=data.produto_id,
            tipo=TipoMovimentacao.SAIDA,
            quantidade=data.quantidade,
            observacao=f"Venda registrada: {data.descricao}",
        )
        session.add(mov_estoque)

    mov = MovimentacaoFinanceira(
        tipo=data.tipo,
        categoria=data.categoria,
        descricao=data.descricao,
        valor=data.valor,
    )
    session.add(mov)
    session.commit()
    session.refresh(mov)
    return mov


@router.delete("/{mov_id}")
def deletar_movimentacao(mov_id: int, session: Session = Depends(get_session)):
    mov = session.get(MovimentacaoFinanceira, mov_id)
    if not mov:
        raise HTTPException(status_code=404, detail="Movimentação não encontrada")
    # Remove os itens do pedido junto (SQLite não faz cascade automático)
    itens = session.exec(
        select(ItemMovimentacao).where(ItemMovimentacao.movimentacao_id == mov_id)
    ).all()
    for it in itens:
        session.delete(it)
    session.delete(mov)
    session.commit()
    return {"ok": True}
