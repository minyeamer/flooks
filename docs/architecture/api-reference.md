# API Reference

This document explains the currently implemented bootstrap APIs in FLooks, with a focus on which input parameters each endpoint accepts and which response fields it returns.

The canonical machine-readable version of this document is served by `GET /api/v1/reference/apis`. The web shell also renders that payload so the current API contract can be reviewed without opening Swagger first.

## Viewers

- Swagger UI: `/docs`
- ReDoc: `/redoc`
- Structured reference payload: `/api/v1/reference/apis`

## Endpoint summary

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/health` | Fast smoke test for the running API container. |
| `GET` | `/api/v1/system` | Bootstrap metadata for app name, version, roles, modules, and data sources. |
| `GET` | `/api/v1/overview` | Runtime overview consumed by the web shell. |
| `GET` | `/api/v1/identity/bootstrap` | Identity, approval, and permission baseline contract. |
| `GET` | `/api/v1/metadata/bootstrap` | Metadata persistence baseline and expected Alembic revision. |
| `GET` | `/api/v1/dashboards` | List dashboard metadata and latest revision status. |
| `POST` | `/api/v1/dashboards` | Create a dashboard and its first document revision. |
| `GET` | `/api/v1/dashboards/{slug}` | Read the latest or requested dashboard document version. |
| `PUT` | `/api/v1/dashboards/{slug}` | Create a new dashboard document version. |
| `DELETE` | `/api/v1/dashboards/{slug}` | Delete a dashboard and all stored versions. |
| `GET` | `/api/v1/query/bootstrap` | Starter dataset manifest registry and governed-query rules. |
| `POST` | `/api/v1/query/validate` | QuerySpec semantic validation and normalized execution preview. |
| `GET` | `/api/v1/reference/apis` | Structured human-readable documentation for the implemented APIs. |

## Endpoint details

### `GET /api/v1/health`

Input parameters:

- none

Response fields:

- `status`: health result string. The current implementation returns `ok`.
- `service`: service identifier string. The current implementation returns `flooks-api`.

### `GET /api/v1/system`

Input parameters:

- none

Response fields:

- `name`: API service name.
- `version`: deployed backend version.
- `environment`: runtime environment name.
- `apiPrefix`: versioned API prefix.
- `roles[]`: system-wide roles exposed to clients.
- `dataSources[]`: supported or planned data source kinds.
- `modules[]`: platform module keys.

### `GET /api/v1/overview`

Input parameters:

- none

Response fields:

- `product`: product name shown in the shell.
- `environment`: current runtime environment.
- `headline`: live hero headline.
- `summary`: current bootstrap summary sentence.
- `metrics[]`: cards with `label`, `value`, and `note`.
- `execution_plan[]`: roadmap steps with `id`, `title`, `status`, and `outcome`.
- `service_links[]`: reachable links with `label`, `href`, and `description`.

### `GET /api/v1/identity/bootstrap`

Input parameters:

- none

Response fields:

- `identity.authentication_methods[]`: login methods supported by the current bootstrap.
- `identity.approval_stages[]`: approval stages applied after sign-up.
- `identity.email_verification_required`: whether email verification is mandatory.
- `identity.admin_approval_required`: whether admin approval is mandatory.
- `identity.self_signup_enabled`: whether self-sign-up is enabled.
- `identity.default_role`: default system role assigned to new users.
- `identity.session_policy.*`: access-token transport and token TTL settings.
- `permissions.system_roles[]`: global system roles.
- `permissions.resource_acl_targets[]`: resource types covered by ACL rules.
- `permissions.dataset_grant_axes[]`: grant axes used when evaluating dataset visibility.
- `permissions.hidden_resource_behavior.*`: behavior applied when access is denied in discovery, editor, and AI contexts.

### `GET /api/v1/metadata/bootstrap`

Input parameters:

- none

Response fields:

- `dialect`: active database dialect.
- `driver`: active database driver.
- `host`: database host when available.
- `database`: database name when available.
- `expected_revision`: Alembic revision expected by the API.
- `tables[]`: metadata table list, each with `name`.

### `GET /api/v1/dashboards`

Input parameters:

- none

Response fields:

- `[].id`: dashboard metadata UUID.
- `[].slug`: dashboard slug.
- `[].title`: latest dashboard title.
- `[].description`: dashboard description when present.
- `[].ownerPrincipalKind`: owner principal kind.
- `[].ownerPrincipalKey`: owner principal key.
- `[].latestVersionNumber`: latest stored document revision number.
- `[].latestVersionStatus`: latest revision status.
- `[].createdAt`: dashboard creation time.
- `[].updatedAt`: dashboard metadata update time.

### `POST /api/v1/dashboards`

Input body parameters:

- `slug`: dashboard slug.
- `description`: optional dashboard description.
- `ownerPrincipalKind`: owner principal kind.
- `ownerPrincipalKey`: owner principal key.
- `createdBy`: author of the first revision.
- `summary`: optional summary for the first revision.
- `status`: optional first revision status. Defaults to `draft`.
- `document`: dashboard document payload. The backend normalizes its `key` and `version` to match the stored dashboard record.

Success response fields:

- `id`: dashboard metadata UUID.
- `slug`: dashboard slug.
- `title`: current dashboard title.
- `description`: stored dashboard description.
- `ownerPrincipalKind`: owner principal kind.
- `ownerPrincipalKey`: owner principal key.
- `latestVersionNumber`: latest revision number.
- `latestVersionStatus`: latest revision status.
- `document`: current dashboard document.
- `versions[]`: revision history entries with `versionNumber`, `status`, `summary`, `createdBy`, and `createdAt`.

Conflict response fields:

- `detail.field`: failing field, currently `slug`.
- `detail.message`: human-readable conflict message.

### `GET /api/v1/dashboards/{slug}`

Input parameters:

- `slug`: dashboard identifier in the path.
- `version`: optional query parameter. When omitted, the latest revision is returned.

Response fields:

- `id`: dashboard metadata UUID.
- `slug`: dashboard slug.
- `title`: dashboard title.
- `document`: selected dashboard document revision.
- `versions[]`: full version history for the dashboard.

### `PUT /api/v1/dashboards/{slug}`

Input body parameters:

- `createdBy`: author of the new revision.
- `summary`: optional revision summary.
- `status`: optional revision status.
- `description`: optional dashboard description update.
- `document`: next dashboard document payload.

Success response fields:

- `latestVersionNumber`: updated revision number.
- `latestVersionStatus`: updated revision status.
- `document`: newly stored latest dashboard document.
- `versions[]`: full revision history including the new version.

### `DELETE /api/v1/dashboards/{slug}`

Input parameters:

- `slug`: dashboard identifier in the path.

Response fields:

- none. The endpoint returns HTTP `204 No Content` when deletion succeeds.

### `GET /api/v1/query/bootstrap`

Input parameters:

- none

Response fields:

- `datasets[]`: manifest list.
- `datasets[].key`: stable dataset identifier.
- `datasets[].label`: display label.
- `datasets[].description`: dataset purpose summary.
- `datasets[].source.kind`: connector kind.
- `datasets[].source.relation`: backing relation or view.
- `datasets[].dimensions[]`: allowed grouping fields, including `key`, `label`, `dataType`, and `filterOperators`.
- `datasets[].metrics[]`: allowed metrics, including `key`, `label`, `defaultAggregate`, and `supportedAggregates`.
- `datasets[].defaultFilters[]`: enforced baseline filters.
- `datasets[].sorts[]`: allowed sort fields.
- `datasets[].visibility.*`: dataset grant policy.
- `datasets[].cache.*`: cache TTL and stale-while-revalidate policy.
- `datasets[].masking.maskedFields[]`: masked field list.
- `datasets[].limitPolicy.*`: default and maximum row limits.
- `rules.rawSqlAllowed`: whether raw SQL is allowed.
- `rules.datasetManifestRequired`: whether manifest-backed datasets are required.
- `rules.executionPreviewOnly`: whether the current phase only returns execution previews.

### `POST /api/v1/query/validate`

Input body parameters:

- `datasetKey`: target dataset manifest key.
- `dimensions[]`: optional grouping dimensions.
- `metrics[].key`: metric key to select.
- `metrics[].aggregate`: aggregate applied to the metric.
- `filters[].field`: optional filter target field.
- `filters[].op`: optional filter operator.
- `filters[].value`: optional filter value. `between` expects a two-item list.
- `sort[].field`: optional sort field.
- `sort[].direction`: optional sort direction.
- `limit`: optional row limit. The server normalizes this to the dataset maximum when needed.

Success response fields:

- `valid`: `true` when validation succeeds.
- `manifest`: the manifest used for validation.
- `normalizedSpec`: the normalized QuerySpec after default filters and limit enforcement are applied.
- `normalizedSpec.filters[]`: final filters after manifest defaults are merged.
- `normalizedSpec.limit`: final enforced row limit.
- `executionPlan.datasetKey`: dataset key used for preview generation.
- `executionPlan.connectorKind`: target connector kind.
- `executionPlan.relation`: target relation name.
- `executionPlan.enforcedLimit`: final row limit after normalization.
- `executionPlan.defaultFilterCount`: number of manifest default filters merged into the request.
- `executionPlan.selectedDimensionCount`: selected dimension count.
- `executionPlan.selectedMetricCount`: selected metric count.

Validation error response fields:

- `detail.field`: payload area that failed validation.
- `detail.message`: human-readable validation failure message.

## Notes

- Swagger and ReDoc remain the fastest way to explore the generated OpenAPI schema.
- The structured reference endpoint is the source used by the web shell, so the in-app documentation stays aligned with the backend contract.
- Dashboard CRUD and versioned document persistence are now live on top of the metadata schema.
- Query validation still stops at semantic validation and execution preview generation; connector-backed SQL execution is the next backend step.