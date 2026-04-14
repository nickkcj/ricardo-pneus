from __future__ import annotations
from datetime import datetime
from sqlmodel import SQLModel, Field


class Cliente(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    nome: str = Field(index=True)
    telefone: str | None = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.now)


class Divida(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    cliente_id: int = Field(foreign_key="cliente.id")
    descricao: str = Field()
    valor_total: float = Field()
    valor_pago: float = Field(default=0.0)
    quitada: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class PagamentoDivida(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    divida_id: int = Field(foreign_key="divida.id")
    valor: float = Field()
    created_at: datetime = Field(default_factory=datetime.now)
