from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, col
from pydantic import BaseModel

from app.database import get_session
from app.models.cliente import Cliente, Divida, PagamentoDivida
from app.models.financeiro import (
    MovimentacaoFinanceira,
    TipoFinanceiro,
    CategoriaEntrada,
)
from app.models.produto import Produto, MovimentacaoEstoque, TipoMovimentacao

router = APIRouter(prefix="/api/clientes", tags=["clientes"])


# --- DTOs ---

class ClienteCreate(BaseModel):
    nome: str
    telefone: str | None = None


class ClienteUpdate(BaseModel):
    nome: str | None = None
    telefone: str | None = None


class DividaCreate(BaseModel):
    descricao: str
    valor_total: float
    produto_id: int | None = None
    quantidade: int | None = None


class PagamentoCreate(BaseModel):
    valor: float


# --- Clientes ---

@router.get("")
def listar_clientes(
    busca: str | None = Query(None),
    session: Session = Depends(get_session),
):
    query = select(Cliente)
    if busca:
        query = query.where(col(Cliente.nome).ilike(f"%{busca}%"))
    query = query.order_by(Cliente.nome)
    return session.exec(query).all()


@router.get("/{cliente_id}")
def obter_cliente(cliente_id: int, session: Session = Depends(get_session)):
    cliente = session.get(Cliente, cliente_id)
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return cliente


@router.post("", status_code=201)
def criar_cliente(data: ClienteCreate, session: Session = Depends(get_session)):
    cliente = Cliente(**data.model_dump())
    session.add(cliente)
    session.commit()
    session.refresh(cliente)
    return cliente


@router.put("/{cliente_id}")
def atualizar_cliente(
    cliente_id: int, data: ClienteUpdate, session: Session = Depends(get_session)
):
    cliente = session.get(Cliente, cliente_id)
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(cliente, key, value)
    session.add(cliente)
    session.commit()
    session.refresh(cliente)
    return cliente


@router.delete("/{cliente_id}")
def deletar_cliente(cliente_id: int, session: Session = Depends(get_session)):
    cliente = session.get(Cliente, cliente_id)
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    # Deletar dívidas e pagamentos associados
    dividas = session.exec(select(Divida).where(Divida.cliente_id == cliente_id)).all()
    for divida in dividas:
        pagamentos = session.exec(
            select(PagamentoDivida).where(PagamentoDivida.divida_id == divida.id)
        ).all()
        for p in pagamentos:
            session.delete(p)
        session.delete(divida)
    session.delete(cliente)
    session.commit()
    return {"ok": True}


# --- Dívidas ---

@router.get("/{cliente_id}/dividas")
def listar_dividas(
    cliente_id: int,
    quitadas: bool | None = Query(None),
    session: Session = Depends(get_session),
):
    query = select(Divida).where(Divida.cliente_id == cliente_id)
    if quitadas is not None:
        query = query.where(Divida.quitada == quitadas)
    query = query.order_by(col(Divida.created_at).desc())
    return session.exec(query).all()


@router.post("/{cliente_id}/dividas", status_code=201)
def criar_divida(
    cliente_id: int, data: DividaCreate, session: Session = Depends(get_session)
):
    cliente = session.get(Cliente, cliente_id)
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")

    # Venda fiado de item do estoque: baixa a quantidade e registra a movimentação
    if data.produto_id and data.quantidade:
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
        session.add(
            MovimentacaoEstoque(
                produto_id=data.produto_id,
                tipo=TipoMovimentacao.SAIDA,
                quantidade=data.quantidade,
                observacao=f"Venda fiado — {cliente.nome}: {data.descricao}",
            )
        )

    divida = Divida(
        cliente_id=cliente_id,
        descricao=data.descricao,
        valor_total=data.valor_total,
    )
    session.add(divida)
    session.commit()
    session.refresh(divida)
    return divida


@router.delete("/dividas/{divida_id}")
def deletar_divida(divida_id: int, session: Session = Depends(get_session)):
    divida = session.get(Divida, divida_id)
    if not divida:
        raise HTTPException(status_code=404, detail="Dívida não encontrada")
    pagamentos = session.exec(
        select(PagamentoDivida).where(PagamentoDivida.divida_id == divida_id)
    ).all()
    for p in pagamentos:
        session.delete(p)
    session.delete(divida)
    session.commit()
    return {"ok": True}


# --- Pagamentos ---

@router.post("/dividas/{divida_id}/pagamento", status_code=201)
def registrar_pagamento(
    divida_id: int, data: PagamentoCreate, session: Session = Depends(get_session)
):
    divida = session.get(Divida, divida_id)
    if not divida:
        raise HTTPException(status_code=404, detail="Dívida não encontrada")
    if divida.quitada:
        raise HTTPException(status_code=400, detail="Dívida já quitada")

    restante = divida.valor_total - divida.valor_pago
    if data.valor > restante:
        raise HTTPException(
            status_code=400,
            detail=f"Valor excede o restante (R$ {restante:.2f})",
        )

    divida.valor_pago += data.valor
    if divida.valor_pago >= divida.valor_total:
        divida.quitada = True
    divida.updated_at = datetime.now()

    pagamento = PagamentoDivida(divida_id=divida_id, valor=data.valor)

    # Dinheiro recebido entra no caixa do dia
    cliente = session.get(Cliente, divida.cliente_id)
    nome_cliente = cliente.nome if cliente else "Cliente"
    session.add(
        MovimentacaoFinanceira(
            tipo=TipoFinanceiro.ENTRADA,
            categoria=CategoriaEntrada.RECEBIMENTO_DIVIDA.value,
            descricao=f"Recebimento fiado — {nome_cliente}: {divida.descricao}",
            valor=data.valor,
        )
    )

    session.add(divida)
    session.add(pagamento)
    session.commit()
    session.refresh(divida)
    return divida
