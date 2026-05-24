# FLooks Agent Guide

## Product intent

FLooks is an internal-first enterprise dashboard platform. Prioritize governed data access, reusable content, code-first dashboard editing, and safe AI extensibility over premature SaaS concerns.

## Repository map

- `apps/web`: React UI shell and future dashboard editor/runtime
- `apps/api`: FastAPI service for auth, permissions, content, AI orchestration, and requests
- `packages/dashboard-schema`: shared versioned dashboard document contract
- `docs/architecture`: source of truth for domain and extension contracts

## Implementation rules

1. Do not bypass dataset manifests or QuerySpec with ad hoc SQL surfaces.
2. Keep system roles, resource ACL, and dataset grants separate in both code and documentation.
3. Any dashboard document change must update `packages/dashboard-schema` first.
4. Custom panels must stay behind a sandbox boundary.
5. AI-related changes must preserve server-side authorization before model invocation.

## Validation rules

- Web changes: run `npm run build:web`
- API changes: run `python3 -m compileall apps/api/app apps/api/tests`
- Compose or deployment changes: run `docker compose -f deploy/compose/docker-compose.dev.yml config`

## Commit message rules

- Use `type: summary` or `type(scope): summary` on the first line.
- Keep the title style concise and prefer explicit scopes such as `frontend`, `backend`, or `infra` when the work is focused.
- Prefer one scope per commit. If a change crosses scopes, split the work with intermediate commits when practical.
- When the body uses list items, start each item with a capital letter and end it with a period.
- Wrap file paths, variables, environment variables, commands, and identifiers in backticks inside the message body.
- If the user asks for a draft only, provide the message without creating the commit.

## Documentation rules

- Capture architectural decisions in `docs/adr`
- Keep extension contracts in `docs/architecture`
- Add workflow steps to `docs/playbooks` when a new extension path appears
- Keep `docs/` English-only as the canonical project documentation path
- Put Korean user-facing documents under `docs-ko/` only
