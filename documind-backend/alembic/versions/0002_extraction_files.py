"""store original uploads in extraction_files

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-13

The app also runs Base.metadata.create_all() on startup, which creates this table on its
own - so this migration only creates it when it is missing.
"""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if sa.inspect(op.get_bind()).has_table("extraction_files"):
        return
    op.create_table(
        "extraction_files",
        sa.Column("extraction_id", sa.String(length=36), sa.ForeignKey("extractions.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("content_type", sa.String(length=100), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("data", sa.LargeBinary(), nullable=False),
    )
    op.create_index("ix_extraction_files_user_id", "extraction_files", ["user_id"])


def downgrade() -> None:
    if not sa.inspect(op.get_bind()).has_table("extraction_files"):
        return
    op.drop_index("ix_extraction_files_user_id", table_name="extraction_files")
    op.drop_table("extraction_files")