# FLooks Work Log

This file is the canonical English implementation log for the FLooks bootstrap.
Each entry is written after the relevant work lands so another engineer can understand what was built, why it was built, which files carried the behavior, and which checks were used to validate it.

## e83be0a8 · Initial repository baseline

Intent: establish the repository with a license before any product or runtime code landed.

What changed:
- `LICENSE` added the project license text so the repository had an explicit legal baseline from the first commit.

Functional result:
- The repository started with a declared license before any application scaffolding or product implementation was added.

## c8b47488 · Platform bootstrap and live overview slice

Intent: create the initial FLooks monorepo, ship the first runnable API and web shell, and lay down the documentation and development workflow for the whole platform.

What changed:
- Root project files such as `.dockerignore`, `.editorconfig`, `.env.example`, `.gitignore`, `.pre-commit-config.yaml`, `package.json`, `package-lock.json`, `tsconfig.base.json`, `AGENTS.md`, and `.github/copilot-instructions.md` established workspace conventions, package management, local environment examples, and shared coding guidance.
- `apps/api/pyproject.toml`, `apps/api/Dockerfile`, `apps/api/app/main.py`, `apps/api/app/core/config.py`, and `apps/api/app/api/router.py` created the first FastAPI service with CORS, environment parsing, and route registration.
- `apps/api/app/api/routes/health.py`, `apps/api/app/api/routes/system.py`, and `apps/api/app/api/routes/overview.py` introduced the original live bootstrap endpoints so the frontend could discover health, system metadata, and roadmap status from the running backend.
- `apps/api/app/domain/enums.py` added the first shared backend enums for system roles, modules, and data source kinds.
- `apps/api/tests/test_system.py` added the first API contract tests for the health, system, and overview surfaces.
- `apps/web/package.json`, `apps/web/index.html`, `apps/web/src/main.tsx`, `apps/web/src/App.tsx`, `apps/web/src/styles.css`, `apps/web/tsconfig.json`, and `apps/web/vite.config.ts` bootstrapped the React/Vite shell and connected it to the live overview and system APIs.
- `packages/dashboard-schema/package.json` and `packages/dashboard-schema/src/index.ts` introduced the first shared dashboard document contract so frontend work had a typed seed dashboard and shared enums.
- `deploy/compose/docker-compose.dev.yml`, `apps/web/Dockerfile`, and `apps/api/Dockerfile` added the first compose-based local environment for running the stack together.
- `README.md`, `docs/adr/0001-platform-baseline.md`, `docs/architecture/*.md`, `docs-ko/README.md`, and `docs-ko/architecture/*.md` defined the initial product intent, architecture, extension paths, and the English-vs-Korean documentation split.

Functional result:
- The repository became a runnable monorepo with a FastAPI backend, a React web shell, a shared schema package, and compose support.
- The shell could already render live bootstrap information from the API instead of only static marketing copy.
- The documentation baseline for connectors, panel SDK, AI harness direction, and product scope was in place before deeper implementation work began.

## c1815aa0 · Identity and permissions bootstrap APIs

Intent: turn identity and permission planning into a typed backend contract that clients and future auth flows could consume.

What changed:
- `apps/api/app/domain/identity.py` added typed models for authentication methods, approval stages, session policy, system roles, ACL targets, dataset grant axes, and hidden-resource behavior.
- `apps/api/app/api/routes/identity.py` added `GET /api/v1/identity/bootstrap` to expose the initial identity and permission baseline as a stable API payload.
- `apps/api/app/api/router.py` registered the new identity route.
- `apps/api/app/api/routes/overview.py` updated the overview stage list and service links so the shell reported identity and permissions as a delivered backend slice.
- `apps/api/app/api/routes/health.py`, `apps/api/app/api/routes/system.py`, `apps/api/app/main.py`, and `apps/api/app/__init__.py` were cleaned up to use explicit typing, absolute `app...` imports, and clearer module docstrings while the identity slice was added.
- `apps/api/app/core/config.py` and `apps/api/app/domain/enums.py` gained supporting values needed by the new identity contract.
- `apps/api/tests/test_system.py` added coverage for the identity bootstrap response and the updated overview payload.

Functional result:
- The backend exposed a machine-readable identity and permissions baseline instead of leaving those rules only in architecture docs.
- The shell and future clients could discover approval flow, role boundaries, and dataset grant axes from a live endpoint.

Validation:
- `PYTHONPATH=apps/api python3 -m pytest apps/api/tests/test_system.py`
- `python3 -m compileall apps/api/app apps/api/tests`

## d7231856 · Early backend phase and style alignment

Intent: move the written roadmap forward after the identity slice landed and lock in backend coding conventions before the next implementation phase.

What changed:
- `README.md` recorded `/api/v1/identity/bootstrap` and updated the near-term phase ordering so metadata persistence was clearly the next implementation slice.
- `docs/architecture/overview.md` and `docs-ko/architecture/overview.md` marked the identity baseline as delivered and advanced the plan to metadata persistence.
- `AGENTS.md` and `.github/copilot-instructions.md` added explicit repository guidance for backend work, including absolute `app` imports, English module docstrings, explicit typing for public contracts, and the planned `ruff` check direction.

Functional result:
- The repo documentation stopped treating identity bootstrap as planned work and started treating it as delivered behavior.
- Contributors got concrete backend style rules before the database and query slices expanded the codebase.

## 9bf73789 · Metadata persistence baseline

Intent: move dashboard and permission metadata out of placeholders and into a real relational backend that the API can introspect and migrate.

What changed:
- `apps/api/pyproject.toml` added `SQLAlchemy`, `Alembic`, and `psycopg` so the API could create an engine, manage metadata sessions, and run migrations.
- `apps/api/app/core/config.py` added database settings so the API could read a metadata database URL and expected revision from configuration.
- `apps/api/app/db/base.py`, `apps/api/app/db/models.py`, and `apps/api/app/db/session.py` introduced the database layer, including tables and ORM models for dashboards, dashboard versions, resource ACL entries, and dataset grants.
- `apps/api/alembic.ini`, `apps/api/alembic/env.py`, `apps/api/alembic/script.py.mako`, and `apps/api/alembic/versions/20260524_0001_bootstrap_metadata_tables.py` bootstrapped Alembic and created the first metadata schema revision.
- `apps/api/app/domain/persistence.py` added typed enums and shared persistence-side concepts used by the metadata models.
- `apps/api/app/api/routes/metadata.py` added `GET /api/v1/metadata/bootstrap`, which reports the active dialect, driver, expected Alembic revision, and the known metadata tables.
- `apps/api/app/api/router.py` registered the metadata route, and `apps/api/app/api/routes/overview.py` updated the overview payload so the shell could report metadata persistence as a delivered stage.
- `apps/api/tests/test_system.py` gained assertions for the metadata bootstrap contract so the schema and route output stayed fixed.

Functional result:
- The backend gained a concrete metadata persistence layer instead of in-memory placeholders.
- Operators and the shell could verify metadata DB wiring from a live API route.
- Dashboard CRUD had a storage foundation to build on in later commits.

Validation:
- `PYTHONPATH=apps/api python3 -m pytest apps/api/tests/test_system.py`
- `python3 -m compileall apps/api/app apps/api/tests`
- `python3 -m alembic -c apps/api/alembic.ini upgrade head`

## d39aaa6e · Metadata database defaults

Intent: make the new metadata persistence layer runnable in both direct local execution and the compose stack without manual environment patching.

What changed:
- `.env.example` added `FLOOKS_DATABASE_URL` with a localhost-oriented default so developers could run the API directly against the metadata database.
- `deploy/compose/docker-compose.dev.yml` passed `FLOOKS_DATABASE_URL` into the API container and pointed it at the Compose `postgres` hostname.

Functional result:
- The same metadata schema could be reached from local Python processes and from containers.
- The API no longer depended on hidden local environment setup to find its metadata database.

Validation:
- `docker compose -f deploy/compose/docker-compose.dev.yml config`

## f1d47000 · Metadata persistence documentation alignment

Intent: document the delivered metadata slice and keep repository guidance in sync with the new backend baseline.

What changed:
- `README.md` documented the metadata bootstrap route, Alembic workflow, and updated running/validation guidance.
- `docs/architecture/overview.md` and `docs-ko/architecture/overview.md` changed the roadmap language so metadata persistence was marked as delivered and the next stage moved to governed query bootstrap.
- `AGENTS.md` and `.github/copilot-instructions.md` clarified backend style rules, especially that multi-line English module docstrings are acceptable for runtime modules when extra context helps.

Functional result:
- New contributors could see that metadata persistence was already live and understand how to migrate the schema.
- Repository instructions matched the coding style used in the backend slice.

## 98e4d5bf · Governed query bootstrap APIs

Intent: introduce a typed query contract so panels and future AI flows could ask for governed data without exposing raw SQL.

What changed:
- `apps/api/app/domain/query.py` defined the query contract: dataset manifests, dimension and metric declarations, filter operators, sorting, limits, QuerySpec requests, and preview-style validation responses.
- `apps/api/app/query/registry.py` introduced the in-memory starter manifest registry, including datasets such as `mart_commerce_daily` and `mart_channel_performance`.
- `apps/api/app/query/validator.py` implemented semantic validation, default filter merging, limit normalization, and execution preview generation.
- `apps/api/app/api/routes/query.py` exposed `GET /api/v1/query/bootstrap` and `POST /api/v1/query/validate`.
- `apps/api/app/api/router.py` registered the query routes, and `apps/api/app/api/routes/overview.py` surfaced the governed-query stage in the overview payload.
- `apps/api/tests/test_query.py` added route coverage for bootstrap and validation behavior, while `apps/api/tests/test_system.py` checked the updated overview state.
- `README.md`, `docs/architecture/overview.md`, `docs/architecture/query-spec.md`, and the Korean equivalents explained the QuerySpec model and the preview-only phase.

Functional result:
- The backend gained a governed query surface with typed manifests and request validation.
- Query callers could ask the server which datasets, fields, metrics, and limits were allowed before execution existed.
- The product now had a documented QuerySpec contract shared across API, docs, and tests.

Validation:
- `PYTHONPATH=apps/api python3 -m pytest apps/api/tests/test_query.py apps/api/tests/test_system.py`
- `python3 -m compileall apps/api/app apps/api/tests`
- Live requests to `/api/v1/query/bootstrap` and `/api/v1/query/validate`

## 8c4e3557 · Bootstrap API reference viewer

Intent: make the live API contract visible in the product itself instead of forcing users to read Swagger or source code.

What changed:
- `apps/api/app/domain/reference.py` added typed structures for a machine-readable API catalog.
- `apps/api/app/api/routes/reference.py` added `GET /api/v1/reference/apis`, including endpoint summaries, parameter definitions, response fields, and example payloads.
- `apps/api/app/api/router.py` registered the reference route, and `apps/api/app/api/routes/overview.py` updated counts and links so the shell could advertise the reference surface.
- `apps/web/src/App.tsx` started fetching the structured reference payload and rendering endpoint cards, parameter details, response field lists, and OpenAPI links.
- `apps/web/src/styles.css` added the layout and method-badge styles required for the new in-app documentation view.
- `docs/architecture/api-reference.md` and `docs-ko/architecture/api-reference.md` became the canonical written references, and `README.md` plus overview docs linked the new material.
- `apps/api/tests/test_system.py` gained checks that the structured reference endpoint was present and correctly shaped.

Functional result:
- The web shell could display live endpoint documentation alongside the runtime overview.
- The backend and the in-app docs shared one structured contract instead of separate hand-written descriptions.

Validation:
- `PYTHONPATH=apps/api python3 -m pytest apps/api/tests/test_query.py apps/api/tests/test_system.py`
- `python3 -m compileall apps/api/app apps/api/tests`
- `npm run build:web`

## f9b0d9d2 · Dashboard CRUD and version persistence

Intent: turn the metadata persistence baseline into real dashboard document APIs with version history.

What changed:
- `apps/api/app/domain/dashboard.py` added typed dashboard document, summary, version, create, and update models with camelCase API aliases.
- `apps/api/app/api/routes/dashboards.py` added the dashboard CRUD surface: list dashboards, create a dashboard with version 1, fetch the latest or a requested version, create new versions, and delete a dashboard.
- `apps/api/app/api/router.py` registered the dashboard routes.
- `apps/api/app/api/routes/reference.py`, `apps/api/app/domain/reference.py`, and `apps/api/app/api/routes/overview.py` were updated so the reference payload and live overview now acknowledged dashboard CRUD as an active stage.
- `apps/api/tests/test_dashboards.py` added route-level CRUD/version coverage using an in-memory SQLite override for metadata storage.
- `apps/api/tests/test_system.py` expanded its assertions so overview and reference responses reflected the dashboard APIs.
- `README.md`, `docs/architecture/overview.md`, `docs/architecture/api-reference.md`, and Korean counterparts documented the new dashboard stage and endpoints.
- `apps/web/src/App.tsx` and `apps/web/src/styles.css` received minor updates so the shell copy and reference panel reflected the live dashboard APIs.

Functional result:
- Dashboard documents became persistent, versioned API resources instead of only shared TypeScript seed data.
- The system could now create, update, inspect, and delete stored dashboards on top of the metadata schema.

Validation:
- `PYTHONPATH=apps/api python3 -m pytest apps/api/tests/test_dashboards.py apps/api/tests/test_system.py`
- `python3 -m compileall apps/api/app apps/api/tests`
- `npm run build:web`

## 0e896a8b · Governed query execution with POSTGRES connector

Intent: move the governed query system from validation-only into real execution against the first supported database connector.

What changed:
- `apps/api/app/domain/enums.py` renamed the connector enum from `LINKMERCE_POSTGRES` to `POSTGRES` so the contract was database-oriented rather than product-branded.
- `apps/api/app/query/registry.py` and `packages/dashboard-schema/src/index.ts` were updated so manifests and shared schema used the new `POSTGRES` connector naming.
- `apps/api/app/domain/query.py` added execution response models to represent rows, columns, row counts, and execution metadata.
- `apps/api/app/query/translator.py` implemented QuerySpec-to-SQL translation for dimensions, aggregates, filters, sorting, and limits.
- `apps/api/app/query/connector.py` executed translated SQL through the configured engine and returned structured results.
- `apps/api/app/api/routes/query.py` added `POST /api/v1/query/execute` and changed the query bootstrap rules from preview-only to execution-enabled.
- `apps/api/app/api/routes/overview.py` and `apps/api/app/api/routes/reference.py` surfaced the new execution capability.
- `apps/api/tests/test_query.py` and `apps/api/tests/test_system.py` updated connector naming and execution-related assertions.

Functional result:
- A validated QuerySpec could now produce live rows from a POSTGRES-backed dataset.
- The query layer stopped being only a contract preview and became the first usable data path for panels.

## b7e5fde6 · Query execution documentation alignment

Intent: remove stale documentation that still described query execution as future work after the feature had already landed.

What changed:
- `README.md` added `/api/v1/query/execute` to the running surfaces and removed the stale roadmap item that treated connector execution as unfinished.
- `docs/architecture/api-reference.md` and `docs-ko/architecture/api-reference.md` added the new endpoint to the summary table and documented its request and response fields.
- `docs/architecture/query-spec.md` and `docs-ko/architecture/query-spec.md` changed the bootstrap narrative from preview-only to validation-plus-execution and aligned connector naming with `POSTGRES`.

Functional result:
- The written API and architecture docs matched the live backend behavior.
- New readers no longer got contradictory guidance about whether query execution existed.

Validation:
- `PYTHONPATH=apps/api python3 -m pytest apps/api/tests/test_query.py apps/api/tests/test_system.py`

## 828d0d0e · Overview and query execution hardening

Intent: make the status surfaces truthful and make unsupported connector requests fail explicitly instead of relying on implicit assumptions.

What changed:
- `apps/api/app/api/routes/overview.py` updated the summary text, data source note, governed dataset note, live endpoint count, and service links so overview finally reflected the live `query/execute` route.
- `apps/api/tests/test_system.py` updated the overview assertions for the new endpoint count and the new service link.
- `apps/api/app/query/exceptions.py` introduced `UnsupportedQueryConnectorError` as a shared failure path.
- `apps/api/app/query/translator.py` and `apps/api/app/query/connector.py` now reject non-`POSTGRES` manifests explicitly instead of assuming all manifests are executable.
- `apps/api/app/api/routes/query.py` maps that unsupported-connector condition to HTTP `501 Not Implemented` with a typed API error response.
- `apps/api/tests/test_query.py` added direct tests for translator rejection, connector dispatch rejection, and the `501` route response.

Functional result:
- The overview payload stopped under-reporting live endpoints.
- Unsupported connector kinds now fail cleanly and predictably through the API contract.

Validation:
- `PYTHONPATH=apps/api python3 -m pytest apps/api/tests/test_query.py apps/api/tests/test_system.py`
- `python3 -m compileall apps/api/app apps/api/tests`

## b01dab69 · Live query panel preview

Intent: prove that the web shell could consume the live query execution API and render real runtime output instead of only metadata panels.

What changed:
- `apps/api/tests/test_query.py` added a `/query/execute` success-path smoke test using an in-memory SQLite engine so translation and execution could be exercised without a live analytics database.
- `apps/web/src/App.tsx` added a dedicated query execution request for a sample QuerySpec, isolated request state for that panel, and rendering for result metadata plus a data table.
- `apps/web/src/styles.css` added runtime card and table styles for the first visual data panel.

Functional result:
- The shell gained its first live data panel powered by `/query/execute`.
- Query execution failures were isolated to the runtime panel instead of breaking the whole application shell.

Validation:
- `PYTHONPATH=apps/api python3 -m pytest apps/api/tests/test_query.py`
- `npm run build:web`

## 4bdb878a · Starter panels driven from the dashboard document

Intent: stop hardcoding the panel runtime request in the web shell and move first-party panel definitions into the shared dashboard document contract.

What changed:
- `packages/dashboard-schema/src/index.ts` added shared types for panel query specs, metric aggregates, sort directions, scorecard config, and table config.
- `packages/dashboard-schema/src/index.ts` also updated `starterDashboard` so its panel library contained two scorecards and one table, each with its own query spec and display config.
- `apps/web/src/App.tsx` replaced the fixed query request with helpers that derive runtime panels from the dashboard document, execute each panel query, and render scorecards or tables based on the stored panel config.
- `apps/web/src/styles.css` made the runtime stats layout more reusable for document-driven panel rendering.

Functional result:
- The starter dashboard document became the source of truth for panel runtime behavior.
- The shell could now execute the same kinds of panel definitions that a stored dashboard would eventually carry.

Validation:
- `npm run build:web`

## e7bb4510 · Persisted dashboard runtime

Intent: let the runtime use the stored dashboard document from the backend when it exists, while keeping the starter seed as a safe fallback.

What changed:
- `apps/api/app/domain/dashboard.py` extended the persisted dashboard contract with panel query specs, metric specs, sort specs, scorecard display config, and table display config so the backend model matched the shared frontend shape.
- `apps/api/tests/test_dashboards.py` added assertions that dashboard create and update responses preserve the new panel runtime fields through CRUD round-trips.
- `apps/web/src/App.tsx` started loading `/dashboards/{slug}` for `starterDashboard.key`, storing the active dashboard document in state, showing whether the runtime came from persisted data or the starter seed, and falling back to the starter document when the persisted dashboard was missing or unavailable.
- `apps/web/src/App.tsx` also rerouted panel execution so scorecards and tables are driven from the active dashboard document instead of the starter seed alone.

Functional result:
- Persisted dashboard documents can now define the live panel runtime seen in the shell.
- The shell still remains usable before a stored dashboard exists because it falls back to the starter seed.

Validation:
- `PYTHONPATH=apps/api python3 -m pytest apps/api/tests/test_dashboards.py`
- `npm run build:web`

## 3980b021 · Canonical implementation work log

Intent: stop keeping implementation history only in chat responses or commit subjects and store a reusable engineering log inside the repository.

What changed:
- `docs/playbooks/work-log.md` was created as the canonical English implementation log for the FLooks bootstrap.
- `AGENTS.md` added repository-level rules that require future work logs to be saved in the repo, grouped by commit, and detailed enough to rebuild a similar result from a clean folder.
- `.github/copilot-instructions.md` added the same policy for Copilot-facing instructions so future completions do not fall back to thin commit-message summaries.

Functional result:
- The repository now has a persistent implementation history that explains delivered behavior commit by commit.
- Future work-log updates are constrained by repo instructions instead of depending on ad hoc chat behavior.

## f45f7ede · Full-history work-log expansion

Intent: fix the first saved work log so it no longer skipped the repository's earliest commits and so the heading format matched the stricter 8-character hash rule.

What changed:
- `docs/playbooks/work-log.md` was expanded backward to include the initial license commit, the first monorepo/bootstrap commit, the identity bootstrap API commit, and the early docs/style alignment commit.
- `docs/playbooks/work-log.md` also converted all section headings from 7-character hashes to 8-character hashes so the file used one consistent identifier length.
- `AGENTS.md` and `.github/copilot-instructions.md` were tightened again to require the 8-character hash format in future work-log headings.

Functional result:
- The canonical work log now starts at the real repository beginning instead of the metadata phase.
- Future log maintenance is less ambiguous because the expected hash width is part of the repository instructions.

## 5ae6e10d · Starter dashboard bootstrap for empty stores

Intent: remove the need for the web shell to fall back to a client-only starter document on first run by making the backend supply a persisted starter dashboard automatically when the metadata store is still empty.

What changed:
- `apps/api/app/domain/dashboard.py` added `STARTER_DASHBOARD_ID`, `STARTER_DASHBOARD_SLUG`, and `build_starter_dashboard_document()`, which mirrors the canonical `commerce-home` starter dashboard with its page layout, two scorecards, and one table panel.
- `apps/api/app/api/routes/dashboards.py` added lazy starter seeding for the dashboard list/detail read paths. When the metadata store is empty, the backend now inserts the starter dashboard before returning `/api/v1/dashboards` or `/api/v1/dashboards/commerce-home`.
- `apps/api/app/api/routes/dashboards.py` also tracks per-bind initialization so explicit CRUD activity, including delete, does not immediately resurrect the starter dashboard in the same runtime.
- `apps/api/tests/test_dashboards.py` added coverage for the new bootstrap behavior on empty stores and updated the dashboard fixture payload so the stored test document matches the current starter panel layout.
- `apps/api/app/api/routes/reference.py`, `docs/architecture/api-reference.md`, and `docs-ko/architecture/api-reference.md` now describe the lazy starter bootstrap behavior for dashboard list/detail reads.

Functional result:
- A fresh metadata database can now serve a persisted `commerce-home` dashboard without requiring a manual create step first.
- The web shell's persisted-dashboard path has a backend document to load on first run instead of dropping straight into the client fallback.
- Explicit delete behavior still behaves like a delete inside the active runtime instead of re-creating the dashboard on the very next read.

Validation:
- `PYTHONPATH=apps/api python3 -m pytest apps/api/tests/test_dashboards.py`
- `python3 -m compileall apps/api/app apps/api/tests`

## c6d49eb2 · Page-aware dashboard runtime

Intent: stop treating the first dashboard page as the only runtime surface so persisted dashboards with multiple pages can switch the active page inside the web shell.

What changed:
- `apps/web/src/App.tsx` added active page state and helper functions that resolve the selected dashboard page before deriving runtime panels.
- `apps/web/src/App.tsx` changed panel execution so scorecards and tables are loaded from the active page's placements instead of always reading `dashboardDocument.pages[0]`.
- `apps/web/src/App.tsx` also added active page metadata to the runtime header, rendered a page selector when the dashboard document has more than one page, and removed the remaining `pages[0]` assumption from the dashboard document preview.
- `apps/web/src/styles.css` added the toolbar and page-selector styles needed for the new active-page controls across desktop and mobile layouts.

Functional result:
- The live panel runtime can now follow the currently selected dashboard page rather than being pinned to the first page in the document.
- Persisted multi-page dashboards can expose different panel groups in the existing shell without changing the backend API contract.
- The dashboard document preview now reflects the full page list instead of silently describing only page 1.

Validation:
- `npm run build:web`

## f200b7b3 · Placement-aware runtime panel rendering

Intent: stop dropping active-page layout information after panel execution so the shell can render more than one table panel and keep the runtime aligned with the selected page's stored placements.

What changed:
- `apps/web/src/App.tsx` replaced the panel-selection helper with a placement-aware runtime entry helper that keeps both the active page placement metadata and the linked panel definition together.
- `apps/web/src/App.tsx` now initializes query runtime state and executes panel queries from that runtime entry list, so the execution path stays aligned with the same active-page ordering used for rendering.
- `apps/web/src/App.tsx` removed the separate `dashboardScorecardPanels` and first-`dashboardTablePanel` render split and now renders each active-page runtime entry in order, including multiple table panels when present.
- `apps/web/src/App.tsx` also leaves unsupported panel kinds visible as placeholder cards instead of silently omitting them from the page preview.
- `apps/web/src/styles.css` added the grid and full-width card rules for the new runtime panel list so scorecards and table-style panels still read cleanly in the shell.

Functional result:
- The active dashboard page can now render all supported scorecard and table panels instead of only the first table plus a scorecard group.
- The runtime preview follows stored placement order more closely, which makes multi-panel pages easier to inspect from the existing shell.
- Newly introduced panel kinds are at least visible as placeholders until a dedicated renderer is added.

Validation:
- `npm run build:web`

## e2a32c51 · Layout-aware runtime preview

Intent: make the active dashboard page preview reflect stored placement coordinates more directly instead of only showing panels in placement order.

What changed:
- `apps/web/src/App.tsx` added runtime grid helpers that derive column count, row count, and preview row sizing from the active page's `snapGrid`, width, and height.
- `apps/web/src/App.tsx` now converts each panel placement into grid start and span values, then passes those values into the runtime preview as CSS custom properties.
- `apps/web/src/App.tsx` keeps the existing active-page runtime execution flow but now renders each panel card inside a layout-aware canvas so the preview is closer to the stored page arrangement.
- `apps/web/src/styles.css` added the runtime canvas/grid rules that consume the placement custom properties on desktop and collapse back to a safe single-column stack on smaller screens.

Functional result:
- The active page preview now uses stored `x`, `y`, `width`, and `height` values to approximate the original dashboard layout.
- Multi-panel pages are easier to inspect because the runtime shell no longer treats every panel as the same generic card slot.
- Mobile rendering stays readable because the preview still falls back to a stacked layout below the desktop breakpoint.

Validation:
- `npm run build:web`

## 66f5c89f · Dashboard-like runtime canvas

Intent: make the active dashboard page preview feel closer to a stored dashboard canvas instead of only showing positioned cards on a neutral grid.

What changed:
- `apps/web/src/App.tsx` added canvas metadata and sizing helpers that derive a readable preview height and canvas label from the active page dimensions plus its `snapGrid`.
- `apps/web/src/App.tsx` now wraps the runtime preview in a dedicated canvas frame and surfaces page-level metadata such as the original canvas size, snap dimensions, and cell count above the rendered panels.
- `apps/web/src/styles.css` added a framed canvas surface with gradients, grid lines, and stronger panel chrome so the runtime preview reads more like an actual dashboard page.
- `apps/web/src/styles.css` also keeps the mobile breakpoint safe by overriding the canvas aspect-ratio and collapsing the preview back to a one-column stack on smaller screens.

Functional result:
- The web shell now presents the active dashboard page as a clearer page-like canvas instead of a plain card list.
- Stored page dimensions and grid structure are visible in the runtime preview, which makes layout inspection easier during bootstrap work.
- Mobile behavior stays readable because the preview still abandons the desktop canvas layout below the responsive breakpoint.

Validation:
- `npm run build:web`

## 7b8211d1 · Runtime canvas view controls

Intent: make large dashboard pages easier to inspect in the bootstrap shell without changing stored layout data or losing the fit-to-width view.

What changed:
- `apps/web/src/App.tsx` added a `runtimeCanvasScaleMode` state with `fit` and `detail` presets for the active page preview.
- `apps/web/src/App.tsx` updated the runtime canvas sizing helper so the chosen view mode changes canvas width, preview height, and row sizing while keeping the same placement-driven layout model.
- `apps/web/src/App.tsx` also wrapped the preview canvas in a scrollable container and surfaced the active view mode in the canvas header.
- `apps/web/src/styles.css` added pill-style view controls plus the canvas header and horizontal scroller styling needed for detail-mode inspection.

Functional result:
- The runtime preview can now stay fit to the panel width by default or switch into a larger detail view for closer inspection.
- Larger dashboard pages can be panned horizontally in detail mode instead of forcing every preview to remain compressed.
- The stored dashboard layout model remains unchanged because the controls only affect preview scaling in the shell.

Validation:
- `npm run build:web`

## b424d0d1 · Runtime canvas zoom reset

Intent: make the runtime canvas controls more usable by adding stepwise zoom adjustments and a single action that restores the default fit view.

What changed:
- `apps/web/src/App.tsx` added a `runtimeCanvasZoomPercent` state and layered it on top of the existing `fit` and `detail` base scale modes.
- `apps/web/src/App.tsx` updated the runtime canvas sizing helper so zoom changes affect the effective canvas width, preview height, and row sizing without changing the placement-driven layout model.
- `apps/web/src/App.tsx` also added `-`, `Reset`, and `+` controls to the runtime toolbar and surfaced the current zoom percentage in the canvas header.
- `apps/web/src/styles.css` added explicit disabled-state styling for the zoom buttons so the controls stay visually consistent at the zoom limits.

Functional result:
- The runtime preview can now be nudged in smaller zoom steps instead of relying only on the coarse `fit` and `detail` presets.
- One reset action returns the shell to the default fit view, which makes large-page inspection less sticky after manual zooming.
- The underlying stored dashboard layout is still unchanged because zoom only affects the preview scale in the shell.

Validation:
- `npm run build:web`

## 70bdc1f5 · Runtime canvas zoom shortcuts

Intent: make runtime canvas inspection faster by adding direct keyboard and pointer shortcuts on top of the existing zoom controls.

What changed:
- `apps/web/src/App.tsx` added zoom helper functions that reuse the existing zoom/reset state path instead of introducing a separate shortcut-only code path.
- `apps/web/src/App.tsx` made the runtime canvas scroller focusable and added keyboard shortcuts for `+`, `-`, and `0` so zoom in, zoom out, and reset are available without clicking the toolbar buttons.
- `apps/web/src/App.tsx` also added `Alt + wheel` zoom handling on the canvas scroller and surfaced the shortcut hint inside the runtime preview.
- `apps/web/src/styles.css` added a visible focus ring for the focusable canvas scroller so the keyboard shortcut target is discoverable.

Functional result:
- The runtime preview can now be inspected faster from the keyboard instead of relying only on the zoom buttons.
- Large pages can be zoomed with `Alt + wheel` while staying inside the existing runtime canvas surface.
- Reset behavior remains consistent because the shortcut path reuses the same fit/reset state used by the toolbar controls.

Validation:
- `npm run build:web`

## 05c16167 · Mixed panel runtime previews

Intent: close the remaining visible gap in the runtime canvas by rendering the stored non-table panel kinds instead of falling back to placeholders.

What changed:
- `apps/web/src/App.tsx` added lightweight runtime renderers for `line`, `bar`, `pie`, and `notice` panels by reusing the existing governed query execution path and deriving chart inputs from the first dimension and metric in each panel query.
- `apps/web/src/App.tsx` also updated the empty-state messaging so the runtime canvas now speaks in terms of placed panels rather than only scorecards and tables.
- `apps/web/src/styles.css` added the chart and notice card presentation needed for inline line previews, bar tracks, pie legends, and notice fact tiles inside the existing canvas layout.
- `packages/dashboard-schema/src/index.ts` expanded the shared starter dashboard document with mixed panel placements and new `bar`, `pie`, `line`, and `notice` library entries so new bootstrap documents exercise the richer renderer path.
- `apps/api/app/domain/dashboard.py` mirrored the shared starter dashboard expansion in the backend bootstrap document builder, and `apps/api/tests/test_dashboards.py` updated the dashboard CRUD/bootstrap fixtures and assertions to cover the new panel mix while preserving the original panel ordering contract.

Functional result:
- The runtime preview can now render mixed dashboard pages with basic chart and notice surfaces instead of showing generic unsupported-kind placeholders.
- Freshly bootstrapped dashboard documents now include a broader panel mix, which makes the shared starter experience closer to a real dashboard canvas.
- The backend starter document and the frontend shared schema stay aligned for the expanded panel mix, and dashboard route tests continue to enforce that compatibility.

Validation:
- `npm run build:web`
- `PYTHONPATH=apps/api python3 -m pytest apps/api/tests/test_dashboards.py`

## fe3140d5 · Refresh legacy starter dashboard seed

Intent: make the richer starter dashboard seed actually appear for existing bootstrap environments without overwriting starter dashboards that users have already taken over.

What changed:
- `apps/api/app/api/routes/dashboards.py` changed the starter seeding helper so it now looks for an existing `commerce-home` record before deciding whether to seed, skip, or refresh the starter dashboard.
- `apps/api/app/api/routes/dashboards.py` added an auto-managed starter check that only refreshes starter histories whose versions were all created by `system-bootstrap` with known bootstrap summaries, which prevents the API from overwriting user-managed starter dashboards.
- `apps/api/app/api/routes/dashboards.py` also appends a new starter dashboard revision when the stored auto-managed starter document no longer matches the current canonical seed, preserving the older bootstrap revision as version history instead of mutating it in place.
- `apps/api/tests/test_dashboards.py` added focused coverage for both sides of the guard: legacy auto-managed starter dashboards now refresh to the mixed-panel seed, while user-managed legacy starter dashboards remain unchanged.

Functional result:
- Existing environments that still have the original system-bootstrap starter dashboard can now pick up the newer mixed-panel starter document automatically.
- The refresh path is conservative because it only touches starter histories that are still fully bootstrap-managed.
- Older starter revisions remain queryable through the versioned dashboard API, so the automatic refresh does not erase the original stored document.

Validation:
- `PYTHONPATH=apps/api python3 -m pytest apps/api/tests/test_dashboards.py`

## 0651c2d5 · Starter refresh route

Intent: give operators a deliberate backfill path for the canonical starter dashboard seed instead of relying only on implicit refresh behavior during normal dashboard reads.

What changed:
- `apps/api/app/api/routes/dashboards.py` added `POST /api/v1/dashboards/{slug}/refresh-starter`, a starter-only route that can explicitly seed `commerce-home` into an already initialized metadata store or return the current starter detail when the canonical seed is already current.
- `apps/api/app/api/routes/dashboards.py` also refactored the starter bootstrap helpers so the explicit route can reuse the same create, auto-managed refresh, and user-managed protection logic as the implicit starter path.
- `apps/api/app/api/routes/overview.py` added the starter refresh surface to the live service links and updated the endpoint count so the overview payload stays aligned with the runnable API surface.
- `apps/api/app/api/routes/reference.py` documented the new starter refresh endpoint in the structured API reference and switched the dashboard document example to the canonical `build_starter_dashboard_document()` output so the web-visible docs stay aligned with the current starter seed.
- `apps/api/tests/test_dashboards.py` and `apps/api/tests/test_system.py` added coverage for explicit starter seeding into an initialized store, rejection of user-managed starter refresh requests, the new overview service link, and the new API reference entry.

Functional result:
- Operators can now explicitly create or recheck the canonical starter dashboard even after the metadata store already contains other dashboards.
- The explicit route stays conservative because user-managed starter dashboards still return a conflict instead of being overwritten by the bootstrap seed.
- The web-visible bootstrap docs now advertise the route and show a current starter dashboard example instead of drifting behind the canonical seed.

Validation:
- `PYTHONPATH=apps/api python3 -m pytest apps/api/tests/test_dashboards.py apps/api/tests/test_system.py`

## 84cba30a · Starter refresh shell action

Intent: expose the new starter refresh route directly in the web shell so operators can backfill the canonical starter dashboard without leaving the runtime preview surface.

What changed:
- `apps/web/src/App.tsx` extracted the dashboard document fetch path into a reusable helper so the initial load path and later manual refresh path share the same fallback and notice behavior.
- `apps/web/src/App.tsx` added a `Refresh starter` action in the live panel runtime toolbar that calls `POST /api/v1/dashboards/commerce-home/refresh-starter` and keeps the button disabled while the request is in flight.
- `apps/web/src/App.tsx` also applies the refreshed dashboard payload directly to the active shell state so page selection, panel runtime loading, and source labeling move to the newest persisted starter version immediately after the action completes.
- `apps/web/src/App.tsx` surfaces success and failure outcomes through the existing dashboard notice area so operators can tell whether the starter dashboard was created, refreshed, or rejected by the backend guard.

Functional result:
- The web shell can now trigger starter dashboard backfill from the same surface that previews the dashboard runtime.
- Environments that only had the in-memory starter fallback can switch to the persisted canonical starter document without leaving the UI.
- The frontend path stays consistent because both initial load and manual refresh reuse the same dashboard loading logic and notice surface.

Validation:
- `npm run build:web`

## 5170959e · Starter refresh guard status UI

Intent: make the starter refresh action safer and more understandable by showing the current starter ownership state before operators click the button.

What changed:
- `apps/web/src/App.tsx` extended the dashboard detail state to keep the persisted starter version, owner key, and notice tone alongside the existing dashboard document.
- `apps/web/src/App.tsx` added derived starter status messaging in the runtime toolbar so the shell now distinguishes between in-memory starter fallback, bootstrap-managed persisted starter dashboards, and user-managed starter dashboards.
- `apps/web/src/App.tsx` also disables the `Refresh starter` action proactively when the persisted starter dashboard is user-managed and upgrades the notice area to render success and error outcomes with different visual tones.
- `apps/web/src/styles.css` added starter status pill styling plus a success callout treatment so the new operator-facing state is readable inside the existing runtime panel surface.

Functional result:
- Operators can now tell from the shell whether starter refresh will persist a seed, recheck a bootstrap-managed starter, or be blocked by the backend guard.
- The UI now prevents the most obvious invalid refresh attempt locally instead of waiting for a backend `409` response.
- Starter refresh outcomes are easier to scan because success and failure notices no longer share the same neutral callout styling.

Validation:
- `npm run build:web`

## 57f45a74 · Starter refresh result details

Intent: make the starter refresh surface more operationally useful by showing the current persisted starter metadata and the outcome of the last refresh action directly in the runtime toolbar.

What changed:
- `apps/web/src/App.tsx` expanded the dashboard response typing and local state so the shell now keeps the persisted starter `updatedAt` timestamp and latest version status in addition to version number and owner key.
- `apps/web/src/App.tsx` added derived toolbar metadata that shows the persisted starter version status, last update time, and current owner key whenever the shell is looking at a persisted starter dashboard.
- `apps/web/src/App.tsx` also records the last successful starter refresh outcome as `Created`, `Refreshed`, or `Already aligned`, then surfaces that result as a separate status pill instead of only burying it in the notice text.
- `apps/web/src/styles.css` added the small layout and badge styling needed for the richer starter metadata header inside the existing runtime toolbar.

Functional result:
- Operators can now tell not only whether starter refresh is allowed, but also when the persisted starter last changed and what the most recent refresh action actually did.
- The runtime toolbar now distinguishes between newly created starter persistence, real seed refreshes, and no-op alignment checks without requiring the user to parse a longer notice sentence.
- Persisted starter ownership, status, and freshness are visible together in one place, which reduces the need to inspect the API response manually.

Validation:
- `npm run build:web`

## d64ff17e · Starter action history

Intent: make the starter refresh surface easier to operate over time by leaving a short in-session trail of recent refresh outcomes instead of only showing the latest badge and notice.

What changed:
- `apps/web/src/App.tsx` added a small session-local starter action history state and helper so each refresh success or failure is recorded with a summary, detail line, timestamp, and tone.
- `apps/web/src/App.tsx` now records success entries for created, refreshed, and already-aligned starter checks, and records failure entries when the refresh request returns an error.
- `apps/web/src/App.tsx` renders the recent starter action list directly under the existing starter status block so operators can review the last few refresh attempts without leaving the runtime surface.
- `apps/web/src/styles.css` added compact card styling for the recent action list, including a separate error presentation so failed refresh attempts stand out from successful ones.

Functional result:
- Operators can now see a short recent history of starter refresh attempts instead of only the most recent notice text.
- The shell preserves enough context to distinguish successful creation, real refreshes, no-op alignment checks, and failed attempts during the current session.
- Recent refresh history stays close to the starter status metadata, which makes the operator workflow easier to follow from one place in the toolbar.

Validation:
- `npm run build:web`

## 9bc8fdb2 · Persist starter action history

Intent: keep the recent starter action trail useful across browser reloads by preserving it for the lifetime of the current browser session instead of rebuilding it from scratch every time the shell mounts.

What changed:
- `apps/web/src/App.tsx` added a small `sessionStorage` persistence layer for the starter action history, including guarded JSON parsing so invalid or missing stored data falls back cleanly to an empty list.
- `apps/web/src/App.tsx` now hydrates the recent starter action history from browser session storage on mount and writes the latest trimmed history back whenever the list changes.
- `apps/web/src/App.tsx` also labels the recent action block as browser-session persistent so operators know the trail survives a page reload without implying long-term backend retention.
- `apps/web/src/styles.css` added the compact summary row styling needed for the new persistence caption above the recent action cards.

Functional result:
- Operators can refresh the shell and still see the most recent starter refresh attempts from the current browser session.
- The recent action trail now behaves more like a lightweight operator log while still remaining explicitly session-scoped.
- The UI makes the persistence boundary clear, which reduces confusion between session-local history and backend version history.

Validation:
- `npm run build:web`

## 79284f60 · Clear starter action history

Intent: let operators explicitly reset the recent starter action trail when they want a clean session-local view instead of waiting for the browser session to end.

What changed:
- `apps/web/src/App.tsx` added a dedicated clear-history handler that empties the recent starter action list, resets the current starter refresh outcome badge, and replaces the runtime notice with a local confirmation message.
- `apps/web/src/App.tsx` now computes a separate disabled state and tooltip for clearing history so the action is unavailable while a refresh is running or when there is nothing to clear.
- `apps/web/src/App.tsx` renders a `Clear history` control next to `Refresh starter` inside the existing starter action toolbar.

Functional result:
- Operators can now reset the session-persistent starter action trail without reloading the page or waiting for a fresh browser session.
- Clearing the trail also removes the current outcome pill, which keeps the starter status surface internally consistent after the history has been wiped.
- The action stays safely disabled during refresh execution and when no stored history exists.

Validation:
- `npm run build:web`

## 64da4184 · Confirm clear starter history

Intent: reduce accidental loss of the session-local starter action trail by requiring a lightweight explicit confirmation before the shell clears it.

What changed:
- `apps/web/src/App.tsx` added a small armed-state toggle for the clear-history control so the first click switches the button into a confirmation state instead of immediately wiping the recent action trail.
- `apps/web/src/App.tsx` now reuses the existing active runtime-control styling for the armed confirmation state and swaps the button label to `Confirm clear` while the action is pending confirmation.
- `apps/web/src/App.tsx` also disarms the confirmation state automatically when starter history changes or a refresh starts, which avoids leaving a stale destructive action armed after surrounding state updates.

Functional result:
- Operators now get a lightweight second step before the shell removes the session-persisted starter action trail.
- The confirmation state stays inside the existing toolbar and does not require a modal or broader layout change.
- Refresh and history updates automatically collapse the armed clear state, which keeps the destructive control aligned with the current runtime context.

Validation:
- `npm run build:web`

## a95f05cd · Timeout clear history confirmation

Intent: make the armed clear-history state safer and less sticky by automatically collapsing the destructive confirmation after a short idle window.

What changed:
- `apps/web/src/App.tsx` introduced a small confirmation timeout constant for the clear-history control and an effect that automatically disarms the pending confirmation state after a short delay.
- `apps/web/src/App.tsx` now updates the clear-history tooltip to explain that the second confirmation click must happen within the timeout window.
- `apps/web/src/App.tsx` also updates the armed button label to show the short-lived confirmation window directly in the control itself.

Functional result:
- Operators no longer have to worry about leaving the destructive clear-history action armed indefinitely while they continue using the runtime shell.
- The clear-history interaction still stays lightweight and inline, but the shell now automatically reverts it to the safer idle state after a few seconds.
- The button itself now makes the temporary confirmation window visible, which reduces ambiguity around how long the armed state lasts.

Validation:
- `npm run build:web`

## 554034f3 · Enrich starter action history context

Intent: make the recent starter action trail more operationally useful by attaching compact persisted-dashboard context to each entry instead of relying on the summary and detail sentence alone.

What changed:
- `apps/web/src/App.tsx` extended the starter history entry shape with compact context labels and updated the session-storage hydration logic so older stored entries still load safely while newer entries preserve those labels.
- `apps/web/src/App.tsx` now derives small history labels from the current starter dashboard context, including persisted version, version status, and owner principal key.
- `apps/web/src/App.tsx` records those labels for both successful refresh attempts and failed refresh attempts, then renders them inline under each recent history entry.
- `apps/web/src/styles.css` added compact pill styling for the per-entry starter context labels.

Functional result:
- Operators can now scan the recent starter action trail and immediately see which persisted version, status, and owner context each action belonged to.
- The recent history surface carries more of the starter state on its own, which reduces the need to cross-reference the separate status metadata block.
- Older session-stored history remains backward-compatible because missing context labels still hydrate as empty entries.

Validation:
- `npm run build:web`

## d7302b84 · Badge starter action history

Intent: make the recent starter action trail easier to scan by separating the action category from the freeform summary line and rendering it as an explicit visual badge.

What changed:
- `apps/web/src/App.tsx` introduced an explicit starter history action-kind field for `created`, `refreshed`, `aligned`, and `failed` entries.
- `apps/web/src/App.tsx` now infers that action kind when older session-stored entries are missing the field, which keeps the existing browser-session history backward-compatible.
- `apps/web/src/App.tsx` records the action kind for new refresh success and failure entries, then renders a dedicated badge next to each recent history summary.
- `apps/web/src/styles.css` added compact inline badge styling and action-specific color variants for created, refreshed, aligned, and failed history entries.

Functional result:
- Operators can now distinguish starter creates, real refreshes, no-op alignment checks, and failures at a glance without parsing the whole summary sentence.
- Older browser-session history continues to load because action kinds are inferred when they were not stored yet.
- The recent history surface now separates status category from supporting detail, which makes the trail faster to scan during repeated starter operations.

Validation:
- `npm run build:web`

## Same commit · Shorter starter history summaries

Intent: now that action badges already carry the action category, shorten each recent starter history summary into a denser subject line so the trail is faster to scan.

What changed:
- `apps/web/src/App.tsx` added a small summary helper that derives shorter starter history subject lines from the existing action kind.
- `apps/web/src/App.tsx` now records compact summaries such as `Starter persistence`, `Starter seed`, `Starter alignment`, and `Starter refresh` instead of repeating the full action phrase in the summary text.
- `apps/web/src/App.tsx` also keeps backward-compatible action-kind inference for both the older long summaries and the new shorter summaries so existing browser-session history still renders correctly.

Functional result:
- The recent starter action trail is denser because the badge carries the action category and the summary line now focuses on the affected starter surface.
- Existing browser-session history continues to load because action-kind inference understands both the earlier summary wording and the shorter wording introduced here.
- Repeated starter operations are easier to scan without losing the detailed explanation line underneath each entry.

Validation:
- `npm run build:web`