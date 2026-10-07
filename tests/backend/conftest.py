import os
import sys
import tempfile
from pathlib import Path

import pytest

_tmp = tempfile.mkdtemp(prefix="cineai-test-")
os.environ.update({
    "APP_ENV": "test",
    "DATABASE_URL": f"sqlite:///{_tmp}/test.db",
    "AUTH_MODE": "dev",
    "LOCAL_MEDIA_DIR": f"{_tmp}/media",
    "REDIS_URL": "",
    "STORY_PROVIDER": "mock", "IMAGE_PROVIDER": "mock", "VIDEO_PROVIDER": "mock", "TTS_PROVIDER": "mock",
})
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))

from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def auth(email: str = "director@cinema.ai") -> dict:
    return {"Authorization": f"Bearer dev:{email}"}
