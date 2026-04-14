from __future__ import annotations
from enum import Enum
from datetime import datetime
from sqlmodel import SQLModel, Field


class CategoriaProduto(str, Enum):
    PNEU = "PNEU"
    OLEO = "OLEO"
    BATERIA = "BATERIA"
    FILTRO = "FILTRO"
    CAMARA = "CAMARA"
    VALVULA = "VALVULA"


class SubcategoriaPneu(str, Enum):
    CARRO = "CARRO"
    MOTO = "MOTO"
    CAMINHAO = "CAMINHAO"
    EMPILHADEIRA = "EMPILHADEIRA"


class TipoMovimentacao(str, Enum):
    ENTRADA = "ENTRADA"
    SAIDA = "SAIDA"


class Produto(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    nome: str = Field(index=True)
    categoria: CategoriaProduto = Field()
    subcategoria: SubcategoriaPneu | None = Field(default=None)
    quantidade: int = Field(default=0)
    quantidade_minima: int = Field(default=0)
    preco_compra: float = Field(default=0.0)
    preco_venda: float = Field(default=0.0)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class MovimentacaoEstoque(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    produto_id: int = Field(foreign_key="produto.id")
    tipo: TipoMovimentacao = Field()
    quantidade: int = Field()
    observacao: str | None = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.now)
