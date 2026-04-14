# PRD - Sistema de Gestão Ricardo Pneus

## 1. Visão Geral do Produto
- **Nome do Projeto:** Ricardo Pneus Management System
- **Status:** Planejamento (Fase de Definição)
- **Responsável:** Nicholas Jasper
- **Plataforma:** Desktop (Windows 10)
- **Abordagem:** Offline-first (Independência total de internet)

### Objetivo
Prover uma ferramenta robusta e ágil para o controle de balcão de uma borracharia, eliminando processos manuais e organizando o estoque, o fluxo de caixa e a gestão de clientes ("fiado").

---

## 2. Stack Tecnológico
Para garantir a melhor performance em hardware legado (Windows 10), foi selecionada a seguinte stack:

- **Desktop Wrapper:** [Tauri](https://tauri.app/) (Base em Rust para leveza e segurança).
- **Frontend:** React + Vite + [Shadcn UI](https://ui.shadcn.com/) (Interface minimalista e focada em UX).
- **Backend (Sidecar):** FastAPI (Python) para processamento local de alta velocidade.
- **Banco de Dados:** SQLite (Arquivo local único, ACID compliant).

---

## 3. Requisitos Funcionais

### Módulo 1: Controle de Estoque
- **Cadastro Flexível:** Suporte para Pneus (Carro, Moto, Caminhão, Empilhadeira), Óleos, Baterias, Filtros, Câmaras e Válvulas.
- **Busca Preditiva:** Campo de pesquisa global com autocomplete para localização instantânea de itens por nome ou categoria.
- **Gestão de Inventário:** Ajuste rápido de quantidades (Entrada/Saída) diretamente na listagem.
- **Alertas de Reposição:** Notificação visual para itens com estoque abaixo do mínimo configurado.

### Módulo 2: Fluxo de Caixa (Financeiro)
- **Registro de Movimentações:** Entradas e saídas categorizadas.
- **Categorias de Entrada:** Vendas de produtos, prestação de serviços e recebimento de dívidas.
- **Categorias de Saída:** Pagamento de fornecedores, contas fixas (Luz, Água), e despesas operacionais.
- **Resumo do Dia:** Dashboard simples com o saldo atual do caixa.

### Módulo 3: Gestão de "Fiado" (Contas a Receber)
- **Registro de Clientes:** Nome e contato dos clientes com crédito na loja.
- **Histórico de Dívidas:** Lançamento de compras a prazo com descrição detalhada.
- **Controle de Quitação:** Opção de dar baixa total ou parcial em dívidas acumuladas.

### Módulo 4: Backup e Segurança
- **Backup Automático:** Sincronização automática do arquivo `.sqlite` para uma pasta mapeada (Google Drive/OneDrive) ao encerrar o sistema ou periodicamente.

---

## 4. Requisitos Não Funcionais
- **Performance:** O sistema deve iniciar em menos de 3 segundos e as buscas devem ser instantâneas.
- **Usabilidade:** Interface com botões grandes e suporte a navegação via teclado para agilizar o atendimento.
- **Resiliência:** O sistema não deve depender de serviços externos para suas funções principais.

---

## 5. Fora de Escopo (Out of Scope)
- Emissão de Notas Fiscais (NFS-e ou NFC-e).
- Integração com máquinas de cartão (TEF).
- Acesso remoto via web ou app mobile.
- Controle de múltiplos usuários (Login único/aberto).

---

## 6. Cronograma Estimado (2,5 Meses)
- **Mês 1:** Configuração da infraestrutura (Tauri + FastAPI) e Módulo de Estoque.
- **Mês 2:** Módulo Financeiro e Gestão de Fiado.
- **Mês 2.5:** Dashboards, Backup Automático, Testes Finais e Instalação.

---

## 7. Estrutura do Repositório (Monorepo)
```text
/ricardo-pneus-app
├── src/                # Frontend (React)
├── src-tauri/          # Tauri Core (Rust)
├── backend/            # API FastAPI
│   ├── app/
│   │   ├── models/     # SQLModel/SQLAlchemy schemas
│   │   ├── routes/     # Endpoints
│   │   └── database.py # SQLite engine
│   └── main.py
├── data/               # Local do .sqlite (Ignorado no Git)
└── README.md