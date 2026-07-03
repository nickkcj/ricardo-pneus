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


class TipoItem(str, Enum):
    PRODUTO = "PRODUTO"
    SERVICO = "SERVICO"


class MovimentacaoFinanceira(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    tipo: TipoFinanceiro = Field()
    categoria: str = Field()
    descricao: str = Field()
    valor: float = Field()  # Total Geral (soma dos itens, no caso de pedido)
    # Dados do cliente/veículo (opcionais — usados nos pedidos de entrada)
    cliente_nome: str | None = Field(default=None)
    placa: str | None = Field(default=None)
    telefone: str | None = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.now)


class ItemMovimentacao(SQLModel, table=True):
    """Item (linha) de um pedido de entrada — produto de estoque ou serviço."""
    id: int | None = Field(default=None, primary_key=True)
    movimentacao_id: int = Field(foreign_key="movimentacaofinanceira.id", index=True)
    descricao: str = Field()
    quantidade: int = Field(default=1)
    valor_unitario: float = Field(default=0.0)
    valor_total: float = Field(default=0.0)
    produto_id: int | None = Field(default=None, foreign_key="produto.id")
    tipo: TipoItem = Field(default=TipoItem.SERVICO)
