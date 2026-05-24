# ADR 0001: FLooks platform baseline

## Status

Accepted

## Context

FLooks starts as an internal enterprise dashboard platform for Linkmerce analytics, but it must avoid dead ends that block later open-source adoption.

The platform must support:

- strict user, team, and department access controls
- reusable chart and table objects with data visibility rules
- pixel-based dashboard editing with a code-first document model
- sandboxed custom panels
- a collaboration module for notices and data requests
- a governed AI assistant that respects data permissions

## Decision

We adopt the following baseline:

1. Single-organization architecture for V1.
2. System roles: `OWNER`, `ADMIN`, `EDITOR`, `VIEWER`.
3. Resource ownership and dataset visibility are enforced separately.
4. Linkmerce PostgreSQL marts are the only first-class V1 data source.
5. Dashboard layout is persisted as a versioned document with pixel coordinates.
6. Custom panels must run through a sandboxed SDK boundary.
7. AI chat uses server-side governed tools instead of direct model access to data stores.
8. Docker Compose is the primary delivery model, with Helm-ready boundaries kept in mind.

## Consequences

### Positive

- Faster implementation for a one-person team.
- Clear security boundaries for dashboards, panels, and AI.
- Shared contracts between UI editing and code-first editing.
- Future connector and extension work can remain additive.

### Negative

- V1 intentionally delays multi-tenant SaaS concerns.
- SSO and SAML remain future work.
- Some early abstractions are more explicit than a quick prototype would require.
