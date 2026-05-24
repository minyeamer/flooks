# Playbook: Adding a connector

1. Define the connector boundary in the backend as a new `DataSourceKind` and driver abstraction.
2. Keep query execution behind dataset manifests and QuerySpec translation.
3. Record authentication, network, and caching constraints in `docs/architecture/query-spec.md` or a new connector-specific document.
4. Add route-level authorization before surfacing the connector to users.
5. Verify that AI tools only see datasets exposed through the connector's governed manifest.
