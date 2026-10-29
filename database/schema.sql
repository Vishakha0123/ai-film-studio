BEGIN;

CREATE TABLE alembic_version (
    version_num VARCHAR(32) NOT NULL, 
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

-- Running upgrade  -> 0001

CREATE TABLE usage_events (
    id VARCHAR(36) NOT NULL, 
    user_id VARCHAR(64) NOT NULL, 
    project_id VARCHAR(36) NOT NULL, 
    provider VARCHAR(60) NOT NULL, 
    model VARCHAR(120) NOT NULL, 
    usage JSONB NOT NULL, 
    cost FLOAT NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    PRIMARY KEY (id)
);

CREATE INDEX ix_usage_events_project_id ON usage_events (project_id);

CREATE INDEX ix_usage_events_user_id ON usage_events (user_id);

CREATE TABLE users (
    id VARCHAR(64) NOT NULL, 
    email VARCHAR(320) NOT NULL, 
    profile JSONB NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    PRIMARY KEY (id)
);

CREATE TABLE projects (
    id VARCHAR(36) NOT NULL, 
    user_id VARCHAR(64) NOT NULL, 
    title VARCHAR(300) NOT NULL, 
    genre VARCHAR(200) NOT NULL, 
    language VARCHAR(20) NOT NULL, 
    status VARCHAR(40) NOT NULL, 
    brief JSONB NOT NULL, 
    memory JSONB NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX ix_projects_user_id ON projects (user_id);

CREATE TABLE ai_jobs (
    id VARCHAR(36) NOT NULL, 
    project_id VARCHAR(36) NOT NULL, 
    user_id VARCHAR(64) NOT NULL, 
    task VARCHAR(40) NOT NULL, 
    params JSONB NOT NULL, 
    provider VARCHAR(60) NOT NULL, 
    status VARCHAR(20) NOT NULL, 
    stage VARCHAR(60) NOT NULL, 
    progress INTEGER NOT NULL, 
    result JSONB NOT NULL, 
    cost FLOAT NOT NULL, 
    error TEXT NOT NULL, 
    retry_count INTEGER NOT NULL, 
    idempotency_key VARCHAR(120), 
    created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE, 
    UNIQUE (idempotency_key)
);

CREATE INDEX ix_ai_jobs_project_id ON ai_jobs (project_id);

CREATE INDEX ix_ai_jobs_user_id ON ai_jobs (user_id);

CREATE TABLE assets (
    id VARCHAR(36) NOT NULL, 
    project_id VARCHAR(36) NOT NULL, 
    type VARCHAR(40) NOT NULL, 
    ref VARCHAR(80) NOT NULL, 
    url TEXT NOT NULL, 
    provider VARCHAR(60) NOT NULL, 
    model VARCHAR(120) NOT NULL, 
    version INTEGER NOT NULL, 
    status VARCHAR(30) NOT NULL, 
    dependencies JSONB NOT NULL, 
    meta JSONB NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE
);

CREATE INDEX ix_assets_project_id ON assets (project_id);

CREATE TABLE workflow_steps (
    id VARCHAR(36) NOT NULL, 
    project_id VARCHAR(36) NOT NULL, 
    step_type VARCHAR(40) NOT NULL, 
    status VARCHAR(20) NOT NULL, 
    note TEXT NOT NULL, 
    version INTEGER NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE
);

CREATE INDEX ix_workflow_steps_project_id ON workflow_steps (project_id);

INSERT INTO alembic_version (version_num) VALUES ('0001') RETURNING alembic_version.version_num;

-- Running upgrade 0001 -> 0002

CREATE TABLE project_documents (
    id VARCHAR(36) NOT NULL, 
    project_id VARCHAR(36) NOT NULL, 
    filename VARCHAR(255) NOT NULL, 
    type VARCHAR(20) NOT NULL, 
    content_type VARCHAR(120) NOT NULL, 
    size INTEGER NOT NULL, 
    file_url TEXT NOT NULL, 
    extracted_text TEXT NOT NULL, 
    source_reference VARCHAR(255) NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE
);

CREATE INDEX ix_project_documents_project_id ON project_documents (project_id);

UPDATE alembic_version SET version_num='0002' WHERE alembic_version.version_num = '0001';

-- Running upgrade 0002 -> 0003

ALTER TABLE projects ADD COLUMN chat JSONB DEFAULT '[]' NOT NULL;

UPDATE alembic_version SET version_num='0003' WHERE alembic_version.version_num = '0002';

-- Running upgrade 0003 -> 0004

CREATE TABLE film_productions (
    id VARCHAR(36) NOT NULL, 
    project_id VARCHAR(36) NOT NULL, 
    target_seconds INTEGER NOT NULL, 
    shot_seconds INTEGER NOT NULL, 
    quality VARCHAR(10) NOT NULL, 
    status VARCHAR(20) NOT NULL, 
    story_bible JSONB NOT NULL, 
    budget_cap FLOAT NOT NULL, 
    spent FLOAT NOT NULL, 
    pause_requested BOOLEAN NOT NULL, 
    error TEXT NOT NULL, 
    final_asset_id VARCHAR(36), 
    created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX ix_film_productions_project_id ON film_productions (project_id);

CREATE TABLE film_scenes (
    id VARCHAR(36) NOT NULL, 
    production_id VARCHAR(36) NOT NULL, 
    number INTEGER NOT NULL, 
    act INTEGER NOT NULL, 
    title VARCHAR(300) NOT NULL, 
    summary TEXT NOT NULL, 
    location VARCHAR(300) NOT NULL, 
    characters JSONB NOT NULL, 
    target_seconds INTEGER NOT NULL, 
    script TEXT NOT NULL, 
    continuity TEXT NOT NULL, 
    status VARCHAR(20) NOT NULL, 
    error TEXT NOT NULL, 
    preview_asset_id VARCHAR(36), 
    created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(production_id) REFERENCES film_productions (id) ON DELETE CASCADE, 
    CONSTRAINT uq_film_scene_number UNIQUE (production_id, number)
);

CREATE INDEX ix_film_scenes_production_id ON film_scenes (production_id);

CREATE TABLE film_shots (
    id VARCHAR(36) NOT NULL, 
    scene_id VARCHAR(36) NOT NULL, 
    number INTEGER NOT NULL, 
    description TEXT NOT NULL, 
    camera VARCHAR(120) NOT NULL, 
    movement VARCHAR(120) NOT NULL, 
    characters JSONB NOT NULL, 
    dialogue JSONB NOT NULL, 
    seconds FLOAT NOT NULL, 
    status VARCHAR(20) NOT NULL, 
    attempts INTEGER NOT NULL, 
    error TEXT NOT NULL, 
    video_asset_id VARCHAR(36), 
    audio_asset_id VARCHAR(36), 
    frame_asset_id VARCHAR(36), 
    created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(scene_id) REFERENCES film_scenes (id) ON DELETE CASCADE, 
    CONSTRAINT uq_film_shot_number UNIQUE (scene_id, number)
);

CREATE INDEX ix_film_shots_scene_id ON film_shots (scene_id);

UPDATE alembic_version SET version_num='0004' WHERE alembic_version.version_num = '0003';

COMMIT;

