"""project chat column

The AI Director conversation gets its own column instead of living inside the brief, so saving the
chat can never overwrite the film idea being saved at the same moment.

Revision ID: 0003
Revises: 0002
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('projects', sa.Column('chat', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'),
                                        nullable=False, server_default='[]'))


def downgrade() -> None:
    op.drop_column('projects', 'chat')
