"""Create the initial metadata persistence tables for FLooks.

Revision ID: 20260524_0001
Revises:
Create Date: 2026-05-24 16:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260524_0001"
down_revision = None
branch_labels = None
depends_on = None


principal_kind = postgresql.ENUM(
    "user",
    "team",
    "department",
    "role",
    "workspace",
    name="principal_kind",
    create_type=False,
)
resource_acl_target = postgresql.ENUM(
    "dashboard",
    "library-item",
    "discussion",
    "request",
    name="resource_acl_target",
    create_type=False,
)
resource_permission = postgresql.ENUM(
    "view",
    "edit",
    "manage",
    name="resource_permission",
    create_type=False,
)
dashboard_version_status = postgresql.ENUM(
    "draft",
    "published",
    "archived",
    name="dashboard_version_status",
    create_type=False,
)
dataset_grant_axis = postgresql.ENUM(
    "user",
    "team",
    "department",
    "role",
    "workspace",
    name="dataset_grant_axis",
    create_type=False,
)


def upgrade() -> None:
    principal_kind.create(op.get_bind(), checkfirst=True)
    resource_acl_target.create(op.get_bind(), checkfirst=True)
    resource_permission.create(op.get_bind(), checkfirst=True)
    dashboard_version_status.create(op.get_bind(), checkfirst=True)
    dataset_grant_axis.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "dashboard",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("slug", sa.String(length=120), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("owner_principal_kind", principal_kind, nullable=False),
        sa.Column("owner_principal_key", sa.String(length=120), nullable=False),
        sa.Column("latest_version_number", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_dashboard")),
    )
    op.create_index(op.f("ix_dashboard_slug"), "dashboard", ["slug"], unique=True)

    op.create_table(
        "dashboard_version",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("dashboard_id", sa.Uuid(), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("status", dashboard_version_status, nullable=False),
        sa.Column("document", sa.JSON(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("created_by", sa.String(length=120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["dashboard_id"],
            ["dashboard.id"],
            name=op.f("fk_dashboard_version_dashboard_id_dashboard"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_dashboard_version")),
        sa.UniqueConstraint("dashboard_id", "version_number", name="uq_dashboard_version_dashboard_id"),
    )

    op.create_table(
        "resource_acl_entry",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("resource_type", resource_acl_target, nullable=False),
        sa.Column("resource_key", sa.String(length=160), nullable=False),
        sa.Column("principal_kind", principal_kind, nullable=False),
        sa.Column("principal_key", sa.String(length=160), nullable=False),
        sa.Column("permission", resource_permission, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_resource_acl_entry")),
        sa.UniqueConstraint(
            "resource_type",
            "resource_key",
            "principal_kind",
            "principal_key",
            "permission",
            name="uq_resource_acl_entry_resource_type",
        ),
    )

    op.create_table(
        "dataset_grant",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("dataset_key", sa.String(length=160), nullable=False),
        sa.Column("grant_axis", dataset_grant_axis, nullable=False),
        sa.Column("subject_key", sa.String(length=160), nullable=False),
        sa.Column("granted_by", sa.String(length=120), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_dataset_grant")),
        sa.UniqueConstraint("dataset_key", "grant_axis", "subject_key", name="uq_dataset_grant_dataset_key"),
    )


def downgrade() -> None:
    op.drop_table("dataset_grant")
    op.drop_table("resource_acl_entry")
    op.drop_table("dashboard_version")
    op.drop_index(op.f("ix_dashboard_slug"), table_name="dashboard")
    op.drop_table("dashboard")

    dataset_grant_axis.drop(op.get_bind(), checkfirst=True)
    dashboard_version_status.drop(op.get_bind(), checkfirst=True)
    resource_permission.drop(op.get_bind(), checkfirst=True)
    resource_acl_target.drop(op.get_bind(), checkfirst=True)
    principal_kind.drop(op.get_bind(), checkfirst=True)