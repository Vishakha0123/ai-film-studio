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

COMMIT;

