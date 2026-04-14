from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, col, func
from pydantic import BaseModel

from app.database import get_session
from app.models.financeiro import (
    MovimentacaoFinanceira,
    TipoFinanceiro,
)

router = APIRouter(prefix="/api/financeiro", tags=["financeiro"])


class MovimentacaoCreate(BaseModel):
    tipo: TipoFinanceiro
    categoria: str
    descricao: str
    valor: float


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


@router.post("", status_code=201)
def criar_movimentacao(data: MovimentacaoCreate, session: Session = Depends(get_session)):
    mov = MovimentacaoFinanceira(**data.model_dump())
    session.add(mov)
    session.commit()
    session.refresh(mov)
    return mov


@router.delete("/{mov_id}")
def deletar_movimentacao(mov_id: int, session: Session = Depends(get_session)):
    mov = session.get(MovimentacaoFinanceira, mov_id)
    if not mov:
        raise HTTPException(status_code=404, detail="Movimentação não encontrada")
    session.delete(mov)
    session.commit()
    return {"ok": True}
