import shutil
import json
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.database import DB_PATH

router = APIRouter(prefix="/api/backup", tags=["backup"])

CONFIG_PATH = DB_PATH.parent / "backup_config.json"


class BackupConfig(BaseModel):
    pasta_destino: str


def _load_config() -> dict | None:
    if CONFIG_PATH.exists():
        return json.loads(CONFIG_PATH.read_text())
    return None


def _save_config(config: dict):
    CONFIG_PATH.write_text(json.dumps(config, indent=2))


@router.get("/config")
def obter_config():
    config = _load_config()
    return config or {"pasta_destino": ""}


@router.post("/config")
def salvar_config(data: BackupConfig):
    pasta = Path(data.pasta_destino)
    if not pasta.exists():
        raise HTTPException(
            status_code=400,
            detail=f"Pasta não encontrada: {data.pasta_destino}",
        )
    _save_config({"pasta_destino": data.pasta_destino})
    return {"ok": True}


@router.post("/executar")
def executar_backup():
    config = _load_config()
    if not config or not config.get("pasta_destino"):
        raise HTTPException(status_code=400, detail="Pasta de backup não configurada")

    destino = Path(config["pasta_destino"])
    if not destino.exists():
        raise HTTPException(
            status_code=400,
            detail=f"Pasta de destino não encontrada: {destino}",
        )

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    nome_arquivo = f"ricardo_pneus_backup_{timestamp}.db"
    destino_arquivo = destino / nome_arquivo

    try:
        shutil.copy2(DB_PATH, destino_arquivo)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao copiar: {e}")

    return {
        "ok": True,
        "arquivo": str(destino_arquivo),
        "tamanho_bytes": destino_arquivo.stat().st_size,
    }


@router.get("/historico")
def historico_backups():
    config = _load_config()
    if not config or not config.get("pasta_destino"):
        return []

    pasta = Path(config["pasta_destino"])
    if not pasta.exists():
        return []

    backups = []
    for f in sorted(pasta.glob("ricardo_pneus_backup_*.db"), reverse=True):
        backups.append({
            "arquivo": f.name,
            "caminho": str(f),
            "tamanho_bytes": f.stat().st_size,
            "data_modificacao": datetime.fromtimestamp(f.stat().st_mtime).isoformat(),
        })
    return backups
