import os
import sys
from pathlib import Path
from sqlmodel import SQLModel, create_engine, Session

APP_DIR_NAME = "Ricardo Pneus"


def _resolve_data_dir() -> Path:
    """Pasta gravável para o banco e configs.

    - Empacotado (PyInstaller): usa o diretório de dados do usuário
      (%APPDATA% no Windows, ~/Library/Application Support no macOS,
      ~/.local/share no Linux), pois a pasta de instalação é somente-leitura.
    - Em dev (rodando do código-fonte): usa a pasta ./data do projeto.
    """
    if getattr(sys, "frozen", False):
        if sys.platform == "win32":
            base = Path(os.environ.get("APPDATA", Path.home() / "AppData" / "Roaming"))
        elif sys.platform == "darwin":
            base = Path.home() / "Library" / "Application Support"
        else:
            base = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share"))
        return base / APP_DIR_NAME

    return Path(__file__).resolve().parent.parent.parent / "data"


DB_DIR = _resolve_data_dir()
DB_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DB_DIR / "ricardo_pneus.db"

engine = create_engine(
    f"sqlite:///{DB_PATH}",
    echo=False,
    connect_args={"check_same_thread": False},
)


def _default_sql(column) -> str | None:
    """Converte o default escalar de uma coluna para literal SQL, se houver."""
    default = column.default
    if default is None or not getattr(default, "is_scalar", False):
        return None
    val = default.arg
    if isinstance(val, bool):
        return "1" if val else "0"
    if isinstance(val, (int, float)):
        return str(val)
    if isinstance(val, str):
        return "'" + val.replace("'", "''") + "'"
    return None


def run_migrations():
    """Migração automática leve e idempotente (roda a cada inicialização).

    - Cria tabelas novas (modelos adicionados em versões futuras).
    - Adiciona colunas que faltam em tabelas já existentes, sem apagar dados.

    A coluna nova é adicionada como NULL (ou com o DEFAULT escalar do modelo),
    o que nunca quebra um banco populado.

    NÃO cobre renomear/remover colunas nem mudar tipo — esses casos são raros,
    o SQLite não suporta nativamente e exigiriam migração manual.
    """
    from sqlalchemy import inspect, text

    # 1. Cria as tabelas que ainda não existem
    SQLModel.metadata.create_all(engine)

    # 2. Adiciona colunas faltantes nas tabelas existentes
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    with engine.begin() as conn:
        for table in SQLModel.metadata.sorted_tables:
            if table.name not in existing_tables:
                continue  # recém-criada por create_all, já está completa
            existing_cols = {c["name"] for c in inspector.get_columns(table.name)}
            for column in table.columns:
                if column.name in existing_cols:
                    continue
                coltype = column.type.compile(dialect=engine.dialect)
                ddl = f'ALTER TABLE "{table.name}" ADD COLUMN "{column.name}" {coltype}'
                default = _default_sql(column)
                if default is not None:
                    ddl += f" DEFAULT {default}"
                conn.execute(text(ddl))
                print(f"[migration] coluna adicionada: {table.name}.{column.name}")


def create_db_and_tables():
    # Mantém o nome usado no lifespan; agora aplica migrações automáticas.
    run_migrations()


def get_session():
    with Session(engine) as session:
        yield session
