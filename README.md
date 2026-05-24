# FLooks

FLooks is an internal-first enterprise dashboard platform for governed commerce analytics.

The initial implementation targets Linkmerce-backed PostgreSQL marts, email-based access control, code-first dashboard documents, reusable panel libraries, and an extensible AI assistant layer. The long-term direction is an open-source dashboard platform with connector, panel, and harness extension points.

The primary architecture and stack rationale lives in [docs/architecture/platform-dossier.md](docs/architecture/platform-dossier.md). Read that document first if you want to understand why the current structure exists and what will be added next.

## Documentation language policy

- `docs/` contains canonical project documentation in English.
- `docs-ko/` contains Korean user-facing documents for direct review and execution.
- AI-facing and repository-reference documents must stay in English.
- Do not mix English and Korean documents in the same documentation path.

## Current bootstrap

- Vite + React frontend shell in `apps/web`
- FastAPI backend skeleton in `apps/api`
- Identity and permissions bootstrap endpoint in `apps/api`
- Live bootstrap overview endpoint consumed by the web shell
- Shared dashboard document package in `packages/dashboard-schema`
- Development Docker Compose stack in `deploy/compose`
- Architecture, ADR, and implementation playbooks in `docs`
- AI collaboration rules in `AGENTS.md` and `.github/copilot-instructions.md`

The bootstrap is intentionally minimal. The next implementation wave keeps the same core structure but adds React Router, TanStack Query, TanStack Table, Apache ECharts, SQLAlchemy, Alembic, and the governed query/auth layers described in the dossier.

## Repository layout

```text
flooks/
├── apps/
│   ├── api/                 # FastAPI service
│   └── web/                 # Vite + React shell
├── packages/
│   └── dashboard-schema/    # Shared dashboard document contract
├── deploy/
│   └── compose/             # Docker Compose files
├── docs/
│   ├── adr/                 # Architecture decision records
│   ├── architecture/        # Domain and interface documents
│   └── playbooks/           # Change workflows for new extensions
├── AGENTS.md                # Repo rules for coding agents
└── .github/copilot-instructions.md
```

## Quick start

### Frontend

```bash
npm install
npm run dev:web
```

### Backend

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -e apps/api[dev]
uvicorn app.main:app --app-dir apps/api --reload
```

### Containers

```bash
cp .env.example .env
docker compose -f deploy/compose/docker-compose.dev.yml up --build
```

### Running surfaces

- Web shell: `http://localhost:5173`
- Identity bootstrap API: `http://localhost:8000/api/v1/identity/bootstrap`
- Live overview API: `http://localhost:8000/api/v1/overview`
- System metadata API: `http://localhost:8000/api/v1/system`
- OpenAPI docs: `http://localhost:8000/docs`

## Validation

```bash
npm run build:web
PYTHONPATH=apps/api python3 -m pytest apps/api/tests/test_system.py
python3 -m compileall apps/api/app apps/api/tests
docker compose -f deploy/compose/docker-compose.dev.yml config
```

## Design references

- `docs/architecture/platform-dossier.md`
- `docs/adr/0001-platform-baseline.md`
- `docs/architecture/overview.md`
- `docs/architecture/domain-model.md`
- `docs/architecture/query-spec.md`
- `docs/architecture/panel-sdk.md`
- `docs/architecture/ai-harness.md`

## Next implementation targets

1. Add persistent metadata models and Alembic migrations.
2. Introduce dataset manifest loading and QuerySpec execution for Linkmerce PostgreSQL marts.
3. Implement dashboard CRUD and versioned document persistence.
4. Add the authenticated application shell and API client structure.
5. Add first-party table and scorecard panels.
6. Add the governed AI tool registry and harness pack loading.
7. Add `ruff`-based static checks for backend import, typing, and module conventions.
