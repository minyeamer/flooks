"""Initial SQLAlchemy models for FLooks metadata persistence.

The first schema is intentionally narrow. It stores versioned dashboard
documents, generic resource ACL entries, and dataset grants so the current
product plan can move from bootstrap contracts to relational persistence.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, JSON, String, Text, UniqueConstraint, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.domain.identity import DatasetGrantAxis, ResourceAclTarget
from app.domain.persistence import DashboardVersionStatus, PrincipalKind, ResourcePermission


def _enum_values(enum_cls: type[object]) -> list[str]:
    return [str(member.value) for member in enum_cls]  # type: ignore[attr-defined]


class TimestampMixin:
    """Common timestamp columns for mutable metadata records."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class DashboardRecord(TimestampMixin, Base):
    """Top-level dashboard metadata without embedding every document revision."""

    __tablename__ = "dashboard"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    owner_principal_kind: Mapped[PrincipalKind] = mapped_column(
        Enum(PrincipalKind, name="principal_kind", values_callable=_enum_values),
        nullable=False,
    )
    owner_principal_key: Mapped[str] = mapped_column(String(120), nullable=False)
    latest_version_number: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    versions: Mapped[list[DashboardVersionRecord]] = relationship(
        back_populates="dashboard",
        cascade="all, delete-orphan",
    )


class DashboardVersionRecord(Base):
    """Immutable dashboard document revisions tied to a dashboard record."""

    __tablename__ = "dashboard_version"
    __table_args__ = (
        UniqueConstraint("dashboard_id", "version_number", name="uq_dashboard_version_dashboard_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    dashboard_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("dashboard.id", ondelete="CASCADE"),
        nullable=False,
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[DashboardVersionStatus] = mapped_column(
        Enum(
            DashboardVersionStatus,
            name="dashboard_version_status",
            values_callable=_enum_values,
        ),
        default=DashboardVersionStatus.DRAFT,
        nullable=False,
    )
    document: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[str] = mapped_column(String(120), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    dashboard: Mapped[DashboardRecord] = relationship(back_populates="versions")


class ResourceAclEntry(Base):
    """Generic ACL entries for dashboards and other reusable resources."""

    __tablename__ = "resource_acl_entry"
    __table_args__ = (
        UniqueConstraint(
            "resource_type",
            "resource_key",
            "principal_kind",
            "principal_key",
            "permission",
            name="uq_resource_acl_entry_resource_type",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    resource_type: Mapped[ResourceAclTarget] = mapped_column(
        Enum(ResourceAclTarget, name="resource_acl_target", values_callable=_enum_values),
        nullable=False,
    )
    resource_key: Mapped[str] = mapped_column(String(160), nullable=False)
    principal_kind: Mapped[PrincipalKind] = mapped_column(
        Enum(PrincipalKind, name="principal_kind", values_callable=_enum_values),
        nullable=False,
    )
    principal_key: Mapped[str] = mapped_column(String(160), nullable=False)
    permission: Mapped[ResourcePermission] = mapped_column(
        Enum(ResourcePermission, name="resource_permission", values_callable=_enum_values),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class DatasetGrantRecord(Base):
    """Dataset visibility grants for users, teams, departments, roles, and workspaces."""

    __tablename__ = "dataset_grant"
    __table_args__ = (
        UniqueConstraint("dataset_key", "grant_axis", "subject_key", name="uq_dataset_grant_dataset_key"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    dataset_key: Mapped[str] = mapped_column(String(160), nullable=False)
    grant_axis: Mapped[DatasetGrantAxis] = mapped_column(
        Enum(DatasetGrantAxis, name="dataset_grant_axis", values_callable=_enum_values),
        nullable=False,
    )
    subject_key: Mapped[str] = mapped_column(String(160), nullable=False)
    granted_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )