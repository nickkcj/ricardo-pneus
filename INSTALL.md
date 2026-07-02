# Instalação — Ricardo Pneus (Windows)

Guia para instalar e atualizar o sistema no PC do cliente (Windows 10/11, x86_64).

## 1. Gerar o instalador

O instalador é gerado automaticamente no GitHub Actions a cada push no `main`
(workflow `Build Windows Installer`). Para baixar o `.msi` no seu Mac:

```bash
# substitua <run-id> pelo ID do build mais recente (gh run list)
gh run download <run-id> -n ricardo-pneus-windows-installer -D ~/Downloads/ricardo-pneus-win
```

> Como o Mac é Apple Silicon (arm64) e o PC do cliente é x86_64, o build **precisa**
> rodar no Windows. O GitHub Actions faz isso de graça — não tente compilar no Mac.

Para gerar manualmente numa máquina Windows (Python 3.11+, Node+pnpm, Rust, C++ Build Tools):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\build-backend.ps1
pnpm install
pnpm tauri build
# saída em src-tauri\target\release\bundle\{msi,nsis}\
```

## 2. Instalar no PC do cliente

1. Leve o `.msi` num **pen drive** (não depende de internet).
2. Duplo-clique no `.msi` → instala em `C:\Program Files\Ricardo Pneus\`.
3. Abra o app. O banco é criado em `%APPDATA%\Ricardo Pneus\ricardo_pneus.db`.
4. **Configure a pasta de backup** dentro do app (aba Backup).

### Resolução de problemas

| Sintoma | Causa | Solução |
|---|---|---|
| Tela abre branca/vazia | Falta WebView2 Runtime | Instalar "Evergreen WebView2 Runtime" (Microsoft, grátis) |
| App abre mas não carrega dados | Antivírus bloqueou `backend-api.exe` | Permitir/liberar o executável no antivírus |

## 3. Atualizar (sem perder dados)

Os dados ficam em `%APPDATA%\Ricardo Pneus\`, **separados** do programa
(`C:\Program Files\`). Instalar uma versão nova por cima **não apaga o banco**.

Fluxo de update:

1. Suba o número da versão em `tauri.conf.json` e `package.json` (ex: `0.1.0` → `0.1.1`).
2. Faça push → baixe o `.msi` novo do GitHub Actions.
3. Cliente instala por cima da versão antiga → **dados preservados**.

### Migração automática do banco

Na inicialização, o backend roda `run_migrations()` (em `backend/app/database.py`):

- Cria tabelas novas (modelos adicionados).
- Adiciona colunas que faltam em tabelas existentes (`ALTER TABLE ADD COLUMN`).

Isso cobre os casos comuns de evolução do schema sem perder dados.

> **Não cobre** renomear/remover colunas ou mudar tipo de coluna — esses casos
> (raros) exigem migração manual, pois o SQLite não os suporta nativamente.
