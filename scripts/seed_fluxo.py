"""Insere movimentações financeiras nos dias anteriores para popular
o gráfico de fluxo semanal do dashboard.

Curva: crescente ao longo da semana passada, queda no sábado,
domingo fechado e semana atual mediana.

Idempotente: remove os registros inseridos por execuções anteriores
(identificados pela descrição) antes de inserir de novo.

Uso: backend/venv/bin/python scripts/seed_fluxo.py
"""
import sys
from datetime import date, datetime, time, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from sqlmodel import Session, select, col  # noqa: E402
from app.database import engine  # noqa: E402
from app.models.financeiro import MovimentacaoFinanceira  # noqa: E402

# (dias atrás, tipo, categoria, descrição, valor, hora)
SEED = [
    # 9 dias atrás (segunda) — começo fraco
    (9, "ENTRADA", "SERVICO", "Troca de óleo (Uno)", 90.0, 10),
    (9, "ENTRADA", "VENDA", "Venda válvulas (par)", 110.0, 14),
    (9, "SAIDA", "DESPESA_OPERACIONAL", "Material de escritório", 150.0, 15),
    # 8 dias atrás (terça) — subindo
    (8, "ENTRADA", "VENDA", "Venda 2x Pneu moto 90/90-18", 360.0, 9),
    (8, "ENTRADA", "SERVICO", "Conserto de furo (caminhonete)", 90.0, 16),
    (8, "SAIDA", "CONTA_FIXA", "Internet da loja", 120.0, 11),
    # 7 dias atrás (quarta) — subindo
    (7, "ENTRADA", "VENDA", "Venda 2x Pneu 175/70 R13", 500.0, 10),
    (7, "ENTRADA", "SERVICO", "Alinhamento e balanceamento", 200.0, 15),
    (7, "SAIDA", "DESPESA_OPERACIONAL", "Manutenção do compressor", 250.0, 13),
    # 6 dias atrás (quinta) — subindo
    (6, "ENTRADA", "VENDA", "Venda 4x Pneu 185/65 R15", 880.0, 9),
    (6, "ENTRADA", "SERVICO", "Troca de pastilha de freio", 120.0, 14),
    (6, "SAIDA", "CONTA_FIXA", "Conta de luz", 380.0, 11),
    # 5 dias atrás (sexta) — pico
    (5, "ENTRADA", "VENDA", "Venda 4x Pneu 205/55 R16", 1100.0, 10),
    (5, "ENTRADA", "VENDA", "Venda bateria 60Ah", 300.0, 12),
    (5, "SAIDA", "FORNECEDOR", "Compra de pneus (fornecedor)", 600.0, 13),
    # 4 dias atrás (sábado) — queda
    (4, "ENTRADA", "VENDA", "Venda câmara de moto", 65.0, 9),
    (4, "ENTRADA", "SERVICO", "Rodízio de pneus", 435.0, 11),
    (4, "SAIDA", "DESPESA_OPERACIONAL", "Material de limpeza", 85.0, 10),
    # 3 dias atrás (domingo) — fechado, sem movimentações
    # 2 dias atrás (segunda) — mediano
    (2, "ENTRADA", "VENDA", "Venda 2x Pneu 165/70 R13", 460.0, 10),
    (2, "ENTRADA", "SERVICO", "Troca de óleo (Gol)", 140.0, 15),
    (2, "SAIDA", "DESPESA_OPERACIONAL", "Frete de entrega", 200.0, 12),
    # ontem (terça) — mediano
    (1, "ENTRADA", "VENDA", "Venda bateria 70Ah", 520.0, 9),
    (1, "ENTRADA", "SERVICO", "Conserto de furo (moto)", 130.0, 14),
    (1, "SAIDA", "CONTA_FIXA", "Conta de água", 180.0, 11),
]

# Descrições de versões antigas do seed, para limpeza
DESCRICOES_ANTIGAS = {
    "Recebimento fiado — João",
    "Compra de óleo (fornecedor)",
    "Troca de óleo",
    "Conserto de furo",
}

hoje = date.today()
with Session(engine) as session:
    descricoes = {s[3] for s in SEED} | DESCRICOES_ANTIGAS
    antigos = session.exec(
        select(MovimentacaoFinanceira).where(
            col(MovimentacaoFinanceira.descricao).in_(descricoes)
        )
    ).all()
    for m in antigos:
        session.delete(m)

    for dias_atras, tipo, categoria, descricao, valor, hora in SEED:
        session.add(
            MovimentacaoFinanceira(
                tipo=tipo,
                categoria=categoria,
                descricao=descricao,
                valor=valor,
                created_at=datetime.combine(
                    hoje - timedelta(days=dias_atras), time(hour=hora)
                ),
            )
        )
    session.commit()

print(f"{len(antigos)} removidas, {len(SEED)} inseridas")
