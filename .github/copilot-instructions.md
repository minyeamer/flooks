# Copilot Instructions for FLooks

## Core priorities

1. Respect governed data access above convenience.
2. Treat dashboard documents as versioned contracts, not loose JSON blobs.
3. Keep AI features tool-based and authorization-aware.
4. Prefer additive extension points over hard-coded special cases.

## Working rules

- For UI work, use `packages/dashboard-schema` as the source of truth for persisted dashboard state.
- For API work, keep route-level authorization explicit and separate from business logic.
- For API work, prefer explicit type annotations for public functions, response models, and domain contracts.
- For API work, prefer absolute imports rooted at `app` instead of relative imports unless a technical constraint requires otherwise.
- Add an English module docstring when creating or substantially editing backend runtime modules. Multi-line module docstrings are preferred when extra context helps.
- Keep two blank lines between top-level Python definitions, one blank line between methods, and a trailing newline at the end of Python files.
- Do not introduce raw HTML or JavaScript execution in the host app without sandboxing.
- Prefer minimal, composable changes that preserve future connector and panel plugin boundaries.
- Keep canonical project and AI-reference documents in `docs/` written in English only.
- Place Korean user-facing or operator-facing documents under `docs-ko/`.

## Validation

- Run `npm run build:web` after web changes.
- Run `python3 -m compileall apps/api/app apps/api/tests` after API changes.
- Run `docker compose -f deploy/compose/docker-compose.dev.yml config` after Compose changes.
- Plan `ruff`-based static checks for backend import, typing, and module conventions during infra hardening.

## Commit messages

- Use `type: summary` or `type(scope): summary` on the first line.
- Keep scopes explicit for focused changes, with preferred values such as `frontend`, `backend`, and `infra`.
- Prefer a single scope per commit. If work spans multiple scopes, checkpoint and split it into separate commits when practical.
- When a commit body uses list items, start each item with a capital letter and end it with a period.
- Use backticks for file paths, variables, environment variables, commands, and identifiers inside the message body.
- If the user requests only a draft message, do not create the commit.

## Work log output

- Save the canonical English implementation log in `docs/playbooks/work-log.md`.
- After committed work, append or update one entry per commit in `docs/playbooks/work-log.md` before closing the task when practical.
- Use 8-character short commit hashes in work-log headings.
- Each entry must be detailed enough that another engineer could reproduce a similar result from a clean folder: include intent, key files or modules, concrete behavior changes, and validation.
- A commit message by itself is not an acceptable substitute for the work log. Rewrite the implementation in clear English.
- Keep the log concise and changelog-like, but preserve the technical detail needed to rebuild the feature.
- If work is still local and uncommitted, separate it clearly as pending work instead of mixing it into committed history.