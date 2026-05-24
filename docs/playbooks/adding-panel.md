# Playbook: Adding a panel

1. Define or extend the dashboard document fields in `packages/dashboard-schema` if the panel needs new persisted state.
2. Add the panel manifest and runtime implementation in the web application or future panel package.
3. Document the panel's input schema and data contract in `docs/architecture/panel-sdk.md`.
4. Validate with `npm run build:web`.
5. If the panel consumes new governed data fields, update the relevant dataset manifest design.
