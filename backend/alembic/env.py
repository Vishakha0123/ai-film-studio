from alembic import context

import app.models  # noqa: F401  (register tables)
from app.db import Base, make_engine

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    from app.config import get_settings
    from app.db import _normalize_url

    context.configure(url=_normalize_url(get_settings().DATABASE_URL), target_metadata=target_metadata,
                      literal_binds=True, render_as_batch=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    engine = make_engine()
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, render_as_batch=True)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
