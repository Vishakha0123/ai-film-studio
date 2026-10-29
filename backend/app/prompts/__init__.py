"""Versioned prompt templates (report: keep prompt versions traceable)."""

from pathlib import Path

_DIR = Path(__file__).parent

PLAN_FILM = "plan_film.v2"  # v2: writes in the chosen film language whatever the prompt language
EDIT = "edit.v2"
TRANSLATE_FILM = "translate_film.v1"
FILM_OUTLINE = "film_outline.v1"      # long film: scenes in batches
SCENE_BREAKDOWN = "scene_breakdown.v1"
FILM_TREATMENT = "film_treatment.v1"  # long film: one scene → script + shots


def render(name: str, **values: object) -> str:
    text = (_DIR / f"{name}.md").read_text(encoding="utf-8")
    for key, value in values.items():
        text = text.replace("{" + key + "}", str(value))
    return text
