# Query Spec

This document explains why FLooks is designed around governed queries instead of raw SQL exposure, and it defines the core QuerySpec contract.

For the broader stack rationale, see [platform-dossier.md](./platform-dossier.md).

## 1. Intent

Panels and AI tools in FLooks do not execute arbitrary SQL directly. They submit a QuerySpec that operates on top of a curated dataset contract.

This is not merely a convenience restriction. It is one of the core security and operating principles of the platform.

## Bootstrap status

The current backend bootstrap already exposes the first governed query surfaces.

- `GET /api/v1/query/bootstrap` returns the in-memory starter dataset manifest registry.
- `POST /api/v1/query/validate` validates a `QuerySpec` payload against the manifest contract and returns a normalized execution preview.

This phase validates the contract only. Connector-backed execution against Linkmerce PostgreSQL marts is the next backend step.

## 2. Why FLooks does not expose raw SQL by default

If an enterprise dashboard platform opens raw SQL as a default surface, several problems emerge quickly.

1. Data access validation gets fragmented across screens and features.
2. Connector-specific SQL dialect differences leak directly to users.
3. Panels, AI, and exports start using different query paths.
4. Cache invalidation, audit logging, and row or column masking become difficult to apply consistently.
5. Custom panels and AI lose the ability to share one governed data contract.

For that reason, FLooks keeps the default model as follows.

- the user selects a dataset
- a panel or AI tool builds a QuerySpec
- the API validates the QuerySpec against the dataset manifest and policy rules
- the server converts it into a safe execution plan

## 3. Core contracts

### 3.1 Dataset manifest

Each dataset is more than a physical table name. It is a governed contract.

- `key`: a stable identifier such as `mart_commerce_daily`
- `source`: the connector and physical table or view mapping
- `dimensions`: fields allowed for grouping
- `metrics`: allowed aggregates
- `defaultFilters`: enforced baseline predicates
- `sorts`: allowed sort fields
- `joins`: allowed joins or lookup boundaries
- `visibility`: grant policy by user, team, department, role, or workspace
- `cache`: TTL, invalidation, and stale-while-revalidate policy
- `masking`: row and column masking rules

### 3.2 QuerySpec

QuerySpec is the shared request format used by both panels and AI tools.

- dataset key
- dimensions
- metrics
- filters
- sort
- limit
- optional time range, pagination, and comparison window

## 4. QuerySpec shape

```json
{
  "datasetKey": "mart_commerce_daily",
  "dimensions": ["order_date", "channel_name"],
  "metrics": [
    { "key": "revenue", "aggregate": "sum" },
    { "key": "gmv", "aggregate": "sum" }
  ],
  "filters": [
    {
      "field": "order_date",
      "op": "between",
      "value": ["2026-05-01", "2026-05-24"]
    }
  ],
  "sort": [
    { "field": "revenue", "direction": "desc" }
  ],
  "limit": 500
}
```

## 5. Execution flow

```mermaid
flowchart LR
  P[Panel or AI Tool] --> Q[QuerySpec]
  Q --> V[API validator]
  V --> G[Grant evaluation]
  G --> M[Dataset manifest lookup]
  M --> X[Execution planner]
  X --> D[Connector execution]
  D --> C[Cache and audit]
  C --> R[Result]
```

The execution order is:

1. the caller submits a QuerySpec
2. the API confirms that the dataset key exists in a real manifest
3. the caller's system role, resource ACL, and dataset grant are evaluated together
4. dimensions, metrics, filters, and sorts are validated against the manifest
5. row limits, pagination, and timeout policy are normalized by the server
6. the request is converted into a connector-specific execution plan
7. the result is returned within the cache and audit boundary

The current bootstrap stops after semantic validation and execution preview generation. It does not execute connector SQL yet.

## 6. Why this model matters for FLooks

### 6.1 Panel reuse

Users can reuse objects created by other users on their own dashboards. If a panel internally carries raw SQL, visibility and permission validation become inconsistent panel by panel. A QuerySpec-based model allows the same governance rules to be applied even to reusable panel objects.

### 6.2 AI safety

The AI assistant must be able to explain datasets and propose strategies, but it must not bypass data visibility boundaries. When AI uses the same QuerySpec and dataset manifest system, it stays inside the same security boundary as panels.

### 6.3 Connector extensibility

V1 supports Linkmerce PostgreSQL marts first, but BigQuery, ClickHouse, JDBC, and CSV connectors may follow. QuerySpec allows the backend translator to change without changing how the frontend or AI requests data.

### 6.4 Audit and cache coherence

In an enterprise product, it matters to know what data was exposed to whom and under which conditions. A QuerySpec-based model makes audit logging and cache-key design much easier to standardize.

## 7. Rules

1. The API validates the dataset key before any execution step.
2. Every dimension, metric, filter, and sort must be declared in the manifest.
3. Row limits and timeouts are always capped by the server.
4. Cache keys include both dataset policy and caller visibility context.
5. AI tools may generate or mutate QuerySpec objects, but they do not submit raw SQL directly.
6. New connectors must extend the system without breaking the QuerySpec contract.

## 8. Planned extensions

The following capabilities may be added later on top of QuerySpec.

- comparison windows
- pivot or matrix projection
- derived metric references
- export presets
- saved filter bundles
- parameterized date macros

Even those extensions should be modeled as QuerySpec fields rather than as raw SQL exposure.
