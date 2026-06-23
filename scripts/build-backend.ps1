# Empacota o backend FastAPI como .exe (PyInstaller) e copia para os sidecars do Tauri.
# Rode ESTE script numa máquina Windows (PowerShell), a partir da raiz do projeto:
#   powershell -ExecutionPolicy Bypass -File scripts\build-backend.ps1
#
# Pré-requisitos no Windows: Python 3.11+ e pip no PATH.

$ErrorActionPreference = "Stop"

$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir
$BackendDir = Join-Path $ProjectDir "backend"
$SidecarDir = Join-Path $ProjectDir "src-tauri\binaries"

Write-Host "=== Empacotando backend com PyInstaller (Windows) ==="

Set-Location $BackendDir

# Cria/usa venv
if (-not (Test-Path "venv")) {
    python -m venv venv
}
& ".\venv\Scripts\Activate.ps1"

# Dependências
pip install --upgrade pip -q
pip install -r requirements.txt -q
pip install pyinstaller -q

# Gera o binário onefile
pyinstaller --onefile --name backend-api `
    --add-data "app;app" `
    --hidden-import app.models.produto `
    --hidden-import app.models.financeiro `
    --hidden-import app.models.cliente `
    --hidden-import app.routes.produtos `
    --hidden-import app.routes.financeiro `
    --hidden-import app.routes.clientes `
    --hidden-import app.routes.backup `
    --hidden-import app.routes.dashboard `
    --hidden-import app.routes.relatorios `
    main.py

# Triple do Windows que o Tauri espera no nome do sidecar
$Triple = "x86_64-pc-windows-msvc"

New-Item -ItemType Directory -Force -Path $SidecarDir | Out-Null
Copy-Item "dist\backend-api.exe" (Join-Path $SidecarDir "backend-api-$Triple.exe") -Force

Write-Host "=== Backend empacotado em: $SidecarDir\backend-api-$Triple.exe ==="
Write-Host "Agora rode na raiz do projeto: pnpm install ; pnpm tauri build"
