# Architecture Overview

This document provides a short structural summary of FLooks. The complete rationale for the stack, alternative analysis, current repository structure, and future plan is documented in [platform-dossier.md](./platform-dossier.md).

## Product frame

FLooks is an internal enterprise dashboard platform that safely consumes Linkmerce analytics and provides permission-aware dashboard editing plus AI assistance.

The core product principles are:

1. Data access is enforced by server policy, not by UI convention.
2. Visual dashboard editing and code-first editing share the same document model.
3. Panels and AI operate on top of the same governed query contract.
4. The current operating model is Compose-first while keeping Helm-ready boundaries.

## Runtime layers

### Web

- handles authenticated dashboard viewing, editing, administration, and AI interaction
- accesses data and metadata only through backend APIs
- reads and writes the same dashboard document from both visual and code-based modes

### API

- owns identity, permissions, data catalog, dashboard persistence, discussions, and AI orchestration
- executes governed queries through Dataset manifests and QuerySpec
- defines the audit boundary for dashboards, panels, AI tools, and request workflows

### Shared contract packages

- `packages/dashboard-schema` is the source of truth for the versioned dashboard document
- `panel-sdk`, `query-spec`, and `ui` packages may be added later

### Delivery layer

- `deploy/compose` is the current local and early-stage delivery entry point
- `deploy/helm` will be added later for standardized cluster packaging

## Current state vs next state

The repository is still at the skeleton stage, but it now includes a live bootstrap slice. The web shell reads `/api/v1/system` and `/api/v1/overview` from the FastAPI service so the current runtime state and immediate implementation order are visible without reading source files.

The parts that are already aligned are the monorepo layout, the React shell, the FastAPI skeleton, the live bootstrap overview surface, the dashboard schema package, and the Compose structure.

The next implementation wave should add the following immediately:

1. the identity and permissions skeleton
2. SQLAlchemy 2, Alembic, and metadata models
3. the Dataset manifest loader and QuerySpec executor
4. dashboard CRUD, versioning, and the panel runtime
5. React Router, TanStack Query, TanStack Table, and Apache ECharts for the full application shell

## Near-term execution plan

1. Phase 1: `feat(backend)` for the identity and permissions skeleton, including email login contracts, approval flow scaffolding, and protected route boundaries.
2. Phase 2: `feat(backend)` for metadata persistence, including SQLAlchemy setup, Alembic wiring, and the first dashboard and access-control tables.
3. Phase 3: `feat(backend)` for governed query bootstrap, including dataset manifest loading, QuerySpec validation, and the first Linkmerce connector stub.
4. Phase 4: `feat(frontend)` for the application shell, including routing, API client structure, and authenticated navigation surfaces.
5. Phase 5: `feat(frontend)` for dashboard runtime basics, including first-party table and scorecard panels wired to live API responses.
6. Phase 6: `chore(infra)` for delivery hardening, including Compose health checks, developer entrypoints, and CI-ready validation commands.

## Immediate references

- stack rationale: [platform-dossier.md](./platform-dossier.md)
- governed query contract: [query-spec.md](./query-spec.md)
- core entities: [domain-model.md](./domain-model.md)
- panel extension boundary: [panel-sdk.md](./panel-sdk.md)
- AI extension boundary: [ai-harness.md](./ai-harness.md)
