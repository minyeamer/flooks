"""Persistence-oriented domain enums for dashboard and access-control storage.

These enums define the relational states that back the FLooks metadata store.
They intentionally stay small so the initial schema can persist versioned
dashboards and authorization grants without locking the project into a more
complex identity model too early.
"""

from __future__ import annotations

from enum import StrEnum


class PrincipalKind(StrEnum):
    USER = "user"
    TEAM = "team"
    DEPARTMENT = "department"
    ROLE = "role"
    WORKSPACE = "workspace"


class ResourcePermission(StrEnum):
    VIEW = "view"
    EDIT = "edit"
    MANAGE = "manage"


class DashboardVersionStatus(StrEnum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"