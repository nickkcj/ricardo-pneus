from __future__ import annotations
from enum import Enum
from datetime import datetime
from sqlmodel import SQLModel, Field


class TipoFinanceiro(str, Enum):
    ENTRADA = "ENTRADA"
    SAIDA = "SAIDA"


class CategoriaEntrada(str, Enum):
    VENDA = "VENDA"
    SERVICO = "SERVICO"
    RECEBIMENTO_DIVIDA = "RECEBIMENTO_DIVIDA"


class CategoriaSaida(str, Enum):
    FORNECEDOR = "FORNECEDOR"
    CONTA_FIXA = "CONTA_FIXA"
    DESPESA_OPERACIONAL = "DESPESA_OPERACIONAL"


class MovimentacaoFinanceira(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    tipo: TipoFinanceiro = Field()
    categoria: str = Field()
    descricao: str = Field()
    valor: float = Field()
    created_at: datetime = Field(default_factory=datetime.now)
