"""Shared domain enumerations for the FLooks API."""

from __future__ import annotations

from enum import StrEnum


class SystemRole(StrEnum):
    OWNER = "OWNER"
    ADMIN = "ADMIN"
    EDITOR = "EDITOR"
    VIEWER = "VIEWER"


class DataSourceKind(StrEnum):
    LINKMERCE_POSTGRES = "LINKMERCE_POSTGRES"
    BIGQUERY = "BIGQUERY"
    CLICKHOUSE = "CLICKHOUSE"
    JDBC = "JDBC"
    CSV = "CSV"


class ModuleKey(StrEnum):
    AUTH = "auth"
    DASHBOARDS = "dashboards"
    DATA_CATALOG = "data-catalog"
    DISCUSSIONS = "discussions"
    AI = "ai"
