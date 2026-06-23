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


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
