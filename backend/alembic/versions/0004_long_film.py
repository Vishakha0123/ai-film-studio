"""long film: productions, scenes and shots

Revision ID: 0004
Revises: 0003
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None

JSON = sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql')


def upgrade() -> None:
    op.create_table('film_productions',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('project_id', sa.String(length=36), nullable=False),
        sa.Column('target_seconds', sa.Integer(), nullable=False),
        sa.Column('shot_seconds', sa.Integer(), nullable=False),
        sa.Column('quality', sa.String(length=10), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('story_bible', JSON, nullable=False),
        sa.Column('budget_cap', sa.Float(), nullable=False),
        sa.Column('spent', sa.Float(), nullable=False),
        sa.Column('pause_requested', sa.Boolean(), nullable=False),
        sa.Column('error', sa.Text(), nullable=False),
        sa.Column('final_asset_id', sa.String(length=36), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_film_productions_project_id', 'film_productions', ['project_id'], unique=True)
    op.create_table('film_scenes',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('production_id', sa.String(length=36), nullable=False),
        sa.Column('number', sa.Integer(), nullable=False),
        sa.Column('act', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=300), nullable=False),
        sa.Column('summary', sa.Text(), nullable=False),
        sa.Column('location', sa.String(length=300), nullable=False),
        sa.Column('characters', JSON, nullable=False),
        sa.Column('target_seconds', sa.Integer(), nullable=False),
        sa.Column('script', sa.Text(), nullable=False),
        sa.Column('continuity', sa.Text(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('error', sa.Text(), nullable=False),
        sa.Column('preview_asset_id', sa.String(length=36), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['production_id'], ['film_productions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('production_id', 'number', name='uq_film_scene_number'),
    )
    op.create_index('ix_film_scenes_production_id', 'film_scenes', ['production_id'])
    op.create_table('film_shots',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('scene_id', sa.String(length=36), nullable=False),
        sa.Column('number', sa.Integer(), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('camera', sa.String(length=120), nullable=False),
        sa.Column('movement', sa.String(length=120), nullable=False),
        sa.Column('characters', JSON, nullable=False),
        sa.Column('dialogue', JSON, nullable=False),
        sa.Column('seconds', sa.Float(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('attempts', sa.Integer(), nullable=False),
        sa.Column('error', sa.Text(), nullable=False),
        sa.Column('video_asset_id', sa.String(length=36), nullable=True),
        sa.Column('audio_asset_id', sa.String(length=36), nullable=True),
        sa.Column('frame_asset_id', sa.String(length=36), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['scene_id'], ['film_scenes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('scene_id', 'number', name='uq_film_shot_number'),
    )
    op.create_index('ix_film_shots_scene_id', 'film_shots', ['scene_id'])


def downgrade() -> None:
    op.drop_index('ix_film_shots_scene_id', table_name='film_shots')
    op.drop_table('film_shots')
    op.drop_index('ix_film_scenes_production_id', table_name='film_scenes')
    op.drop_table('film_scenes')
    op.drop_index('ix_film_productions_project_id', table_name='film_productions')
    op.drop_table('film_productions')
