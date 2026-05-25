"""Query execution exceptions shared across translation and connector dispatch."""

from __future__ import annotations

from app.domain.enums import DataSourceKind


class UnsupportedQueryConnectorError(ValueError):
    """Raised when a dataset manifest references a connector without an execution path."""

    def __init__(self, connector_kind: DataSourceKind) -> None:
        self.connector_kind = connector_kind
        super().__init__(
            f"Connector '{connector_kind}' is not supported by the current query execution path."
        )


class QueryExecutionError(RuntimeError):
    """Raised when a connector cannot execute a governed query safely."""

    def __init__(self, field: str, message: str, status_code: int) -> None:
        self.field = field
        self.status_code = status_code
        super().__init__(message)