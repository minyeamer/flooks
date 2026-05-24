# Domain Model

## Core entities

### Identity and access

- `User`: authenticated actor with system role and profile state
- `Department`: primary organizational grouping for visibility rules
- `Team`: collaboration unit for workspace and dashboard sharing
- `Workspace`: bounded area for dashboards, datasets, and requests
- `Membership`: relation between user and workspace/team/department
- `RoleAssignment`: explicit privilege assignment above baseline role rules

### Data governance

- `DataSource`: physical connection descriptor
- `Dataset`: governed logical dataset exposed to panels and AI tools
- `DatasetGrant`: visibility rule bound to users, teams, departments, or roles
- `QuerySpec`: constrained request shape for aggregations, filters, sorting, and limits

### Content system

- `LibraryItem`: reusable by-reference content definition
- `Dashboard`: container for pages, ownership, sharing, and lifecycle state
- `DashboardVersion`: immutable snapshot for versioning and rollback
- `PersonalViewOverride`: per-user overlay for filters, sorts, and personal layout tweaks
- `PanelInstance`: placement of a library or inline panel on a dashboard page

### Collaboration and AI

- `DiscussionThread`: notice, request, or support conversation
- `RequestTicket`: workflow metadata for dataset and cache requests
- `AiProviderConfig`: model provider connection policy
- `AiConversation`: chat session metadata and audit boundary
- `AuditLog`: security and operational event stream

## Relationship highlights

1. `Dashboard` belongs to a `Workspace` and has an owner.
2. `PanelInstance` points to a `LibraryItem` or embeds an inline definition.
3. `DatasetGrant` determines whether datasets, panels, or dashboards are visible.
4. `DiscussionThread` can optionally link to `Dataset`, `Dashboard`, or `RequestTicket`.
5. `AiConversation` operates inside the caller's workspace and grant boundary.
