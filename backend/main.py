from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import create_db_and_tables
import app.models  # noqa: F401 - garante que os modelos são registrados no SQLModel
from app.routes.produtos import router as produtos_router
from app.routes.financeiro import router as financeiro_router
from app.routes.clientes import router as clientes_router
from app.routes.backup import router as backup_router
from app.routes.dashboard import router as dashboard_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    yield


app = FastAPI(title="Ricardo Pneus API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:1420", "http://127.0.0.1:1420", "tauri://localhost"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(produtos_router)
app.include_router(financeiro_router)
app.include_router(clientes_router)
app.include_router(backup_router)
app.include_router(dashboard_router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
