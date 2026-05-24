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

The repository is still at the skeleton stage, but it now includes a live bootstrap slice, an identity baseline slice, a metadata persistence baseline, and a governed query bootstrap. The web shell reads `/api/v1/system` and `/api/v1/overview` from the FastAPI service, while the API now exposes `/api/v1/identity/bootstrap`, `/api/v1/metadata/bootstrap`, `/api/v1/query/bootstrap`, and `/api/v1/query/validate` for the first auth, storage, and query contracts.

The parts that are already aligned are the monorepo layout, the React shell, the FastAPI skeleton, the identity, metadata, and query bootstrap surfaces, the dashboard schema package, and the Compose structure.

The next implementation wave should add the following immediately:

1. dashboard CRUD, versioning, and the panel runtime on top of the new metadata tables
2. connector-backed QuerySpec execution for Linkmerce PostgreSQL marts
3. React Router, TanStack Query, TanStack Table, and Apache ECharts for the full application shell
4. `ruff`-based static checks for backend import, typing, and module conventions

## Near-term execution plan

1. Delivered: `feat(backend)` for the identity and permissions skeleton, including the `/api/v1/identity/bootstrap` contract for email login policy, approval stages, and permission evaluation rules.
2. Delivered: `feat(backend)` for metadata persistence, including SQLAlchemy setup, the Alembic baseline, and the `/api/v1/metadata/bootstrap` contract for the first dashboard and access-control tables.
3. Delivered: `feat(backend)` for the governed query bootstrap, including the dataset manifest registry plus `/api/v1/query/bootstrap` and `/api/v1/query/validate`.
4. Next: `feat(backend)` for dashboard CRUD and versioned document persistence on top of the new relational schema.
5. Phase 5: `feat(backend)` for connector-backed QuerySpec execution against the first Linkmerce PostgreSQL marts.
6. Phase 6: `feat(frontend)` for the application shell, including routing, API client structure, and authenticated navigation surfaces.
7. Phase 7: `feat(frontend)` for dashboard runtime basics, including first-party table and scorecard panels wired to live API responses.
8. Phase 8: `chore(infra)` for delivery hardening, including Compose health checks, developer entrypoints, CI-ready validation commands, and `ruff`-based static checks.

## Immediate references

- stack rationale: [platform-dossier.md](./platform-dossier.md)
- API parameters and response reference: [api-reference.md](./api-reference.md)
- governed query contract: [query-spec.md](./query-spec.md)
- core entities: [domain-model.md](./domain-model.md)
- panel extension boundary: [panel-sdk.md](./panel-sdk.md)
- AI extension boundary: [ai-harness.md](./ai-harness.md)
