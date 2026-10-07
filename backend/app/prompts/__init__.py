"""Versioned prompt templates (report: keep prompt versions traceable)."""

from pathlib import Path

_DIR = Path(__file__).parent

PLAN_FILM = "plan_film.v1"
EDIT = "edit.v1"


def render(name: str, **values: object) -> str:
    text = (_DIR / f"{name}.md").read_text(encoding="utf-8")
    for key, value in values.items():
        text = text.replace("{" + key + "}", str(value))
    return text
