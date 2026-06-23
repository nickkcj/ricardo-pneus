#!/bin/bash
# Script para empacotar o backend FastAPI como binário com PyInstaller
# O binário gerado será colocado na pasta de sidecars do Tauri

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_DIR/backend"
SIDECAR_DIR="$PROJECT_DIR/src-tauri/binaries"

echo "=== Empacotando backend com PyInstaller ==="

cd "$BACKEND_DIR"
source venv/bin/activate

# Instalar PyInstaller se necessário
pip install pyinstaller -q

# Gerar binário
pyinstaller --onefile --name backend-api \
    --add-data "app:app" \
    --hidden-import app.models.produto \
    --hidden-import app.models.financeiro \
    --hidden-import app.models.cliente \
    --hidden-import app.routes.produtos \
    --hidden-import app.routes.financeiro \
    --hidden-import app.routes.clientes \
    --hidden-import app.routes.backup \
    --hidden-import app.routes.dashboard \
    main.py

# Detectar a triple do sistema para o nome do sidecar do Tauri
ARCH=$(uname -m)
OS=$(uname -s)

if [ "$OS" = "Darwin" ]; then
    if [ "$ARCH" = "arm64" ]; then
        TRIPLE="aarch64-apple-darwin"
    else
        TRIPLE="x86_64-apple-darwin"
    fi
elif [ "$OS" = "Linux" ]; then
    TRIPLE="x86_64-unknown-linux-gnu"
fi

# Copiar para pasta de sidecars do Tauri
mkdir -p "$SIDECAR_DIR"
cp "dist/backend-api" "$SIDECAR_DIR/backend-api-$TRIPLE"

echo "=== Backend empacotado em: $SIDECAR_DIR/backend-api-$TRIPLE ==="
echo "Agora execute: cd $PROJECT_DIR && pnpm tauri build"
