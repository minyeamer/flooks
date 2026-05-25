# FLooks Work Log

This file is the canonical English implementation log for the FLooks bootstrap.
Each entry is written after the relevant work lands so another engineer can understand what was built, why it was built, which files carried the behavior, and which checks were used to validate it.

## 9bf7378 · Metadata persistence baseline

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

## d39aaa6 · Metadata database defaults

Intent: make the new metadata persistence layer runnable in both direct local execution and the compose stack without manual environment patching.

What changed:
- `.env.example` added `FLOOKS_DATABASE_URL` with a localhost-oriented default so developers could run the API directly against the metadata database.
- `deploy/compose/docker-compose.dev.yml` passed `FLOOKS_DATABASE_URL` into the API container and pointed it at the Compose `postgres` hostname.

Functional result:
- The same metadata schema could be reached from local Python processes and from containers.
- The API no longer depended on hidden local environment setup to find its metadata database.

Validation:
- `docker compose -f deploy/compose/docker-compose.dev.yml config`

## f1d4700 · Metadata persistence documentation alignment

Intent: document the delivered metadata slice and keep repository guidance in sync with the new backend baseline.

What changed:
- `README.md` documented the metadata bootstrap route, Alembic workflow, and updated running/validation guidance.
- `docs/architecture/overview.md` and `docs-ko/architecture/overview.md` changed the roadmap language so metadata persistence was marked as delivered and the next stage moved to governed query bootstrap.
- `AGENTS.md` and `.github/copilot-instructions.md` clarified backend style rules, especially that multi-line English module docstrings are acceptable for runtime modules when extra context helps.

Functional result:
- New contributors could see that metadata persistence was already live and understand how to migrate the schema.
- Repository instructions matched the coding style used in the backend slice.

## 98e4d5b · Governed query bootstrap APIs

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

## 8c4e355 · Bootstrap API reference viewer

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

## f9b0d9d · Dashboard CRUD and version persistence

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

## 0e896a8 · Governed query execution with POSTGRES connector

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

## b7e5fde · Query execution documentation alignment

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

## 828d0d0 · Overview and query execution hardening

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

## b01dab6 · Live query panel preview

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

## 4bdb878 · Starter panels driven from the dashboard document

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

## e7bb451 · Persisted dashboard runtime

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