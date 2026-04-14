from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, col
from pydantic import BaseModel

from app.database import get_session
from app.models.produto import (
    Produto,
    MovimentacaoEstoque,
    CategoriaProduto,
    SubcategoriaPneu,
    TipoMovimentacao,
)

router = APIRouter(prefix="/api/produtos", tags=["produtos"])


class ProdutoCreate(BaseModel):
    nome: str
    categoria: CategoriaProduto
    subcategoria: SubcategoriaPneu | None = None
    quantidade: int = 0
    quantidade_minima: int = 0
    preco_compra: float = 0.0
    preco_venda: float = 0.0


class ProdutoUpdate(BaseModel):
    nome: str | None = None
    categoria: CategoriaProduto | None = None
    subcategoria: SubcategoriaPneu | None = None
    quantidade_minima: int | None = None
    preco_compra: float | None = None
    preco_venda: float | None = None


class MovimentacaoCreate(BaseModel):
    tipo: TipoMovimentacao
    quantidade: int
    observacao: str | None = None


@router.get("")
def listar_produtos(
    busca: str | None = Query(None),
    categoria: CategoriaProduto | None = Query(None),
    session: Session = Depends(get_session),
):
    query = select(Produto)
    if busca:
        query = query.where(col(Produto.nome).ilike(f"%{busca}%"))
    if categoria:
        query = query.where(Produto.categoria == categoria)
    query = query.order_by(Produto.nome)
    return session.exec(query).all()


@router.get("/alertas")
def alertas_estoque(session: Session = Depends(get_session)):
    query = select(Produto).where(col(Produto.quantidade) <= col(Produto.quantidade_minima))
    return session.exec(query).all()


@router.get("/{produto_id}")
def obter_produto(produto_id: int, session: Session = Depends(get_session)):
    produto = session.get(Produto, produto_id)
    if not produto:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    return produto


@router.post("", status_code=201)
def criar_produto(data: ProdutoCreate, session: Session = Depends(get_session)):
    produto = Produto(**data.model_dump())
    session.add(produto)
    session.commit()
    session.refresh(produto)
    return produto


@router.put("/{produto_id}")
def atualizar_produto(
    produto_id: int, data: ProdutoUpdate, session: Session = Depends(get_session)
):
    produto = session.get(Produto, produto_id)
    if not produto:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(produto, key, value)
    produto.updated_at = datetime.now()
    session.add(produto)
    session.commit()
    session.refresh(produto)
    return produto


@router.delete("/{produto_id}")
def deletar_produto(produto_id: int, session: Session = Depends(get_session)):
    produto = session.get(Produto, produto_id)
    if not produto:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    session.delete(produto)
    session.commit()
    return {"ok": True}


@router.post("/{produto_id}/movimentacao", status_code=201)
def registrar_movimentacao(
    produto_id: int, data: MovimentacaoCreate, session: Session = Depends(get_session)
):
    produto = session.get(Produto, produto_id)
    if not produto:
        raise HTTPException(status_code=404, detail="Produto não encontrado")

    if data.tipo == TipoMovimentacao.ENTRADA:
        produto.quantidade += data.quantidade
    else:
        if produto.quantidade < data.quantidade:
            raise HTTPException(status_code=400, detail="Estoque insuficiente")
        produto.quantidade -= data.quantidade

    produto.updated_at = datetime.now()

    mov = MovimentacaoEstoque(produto_id=produto_id, **data.model_dump())
    session.add(produto)
    session.add(mov)
    session.commit()
    session.refresh(produto)
    return produto
