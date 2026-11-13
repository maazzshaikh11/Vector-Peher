"""Semantic cache table (Fix 2): query_cache.

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-12
"""
import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "query_cache",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("scope", sa.Text(), nullable=False),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("question_embedding", Vector(384), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column("sources", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_query_cache_scope", "query_cache", ["scope"])
    # HNSW index for cosine search (cheap on an empty table).
    op.execute(
        "CREATE INDEX ix_query_cache_question_embedding_hnsw "
        "ON query_cache USING hnsw (question_embedding vector_cosine_ops) "
        "WITH (m = 16, ef_construction = 64)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_query_cache_question_embedding_hnsw")
    op.drop_index("ix_query_cache_scope", table_name="query_cache")
    op.drop_table("query_cache")
