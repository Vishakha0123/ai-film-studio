"""Long film, step 1: the story bible and the scene outline.

The bible comes from the film the creator already planned (characters with their looks and reference portraits,
logline, genre, tone, language, visual style). The outline is written in batches of scenes, each batch seeing
the story so far, so a 2-hour film (~80 scenes) never needs one impossible reply.
"""

from sqlalchemy.orm import Session

from app.models import AIJob, FilmScene, Project
from app.providers import story_provider
from app.services import reference_portraits
from app.services.film_production import (OUTLINE_BATCH, BudgetReached, check_budget, production_of, scene_count,
                                          story_call_cost)
from app.services.pipeline import NeedsReview, record_usage, set_progress, validate_film, with_retry


def story_bible(project: Project) -> dict:
    """The stable reference every scene and shot is written and drawn from."""
    m = project.memory or {}
    chars = reference_portraits.assign({"characters": m.get("characters", [])})["characters"]
    return {
        "title": m.get("title", project.title), "logline": m.get("logline", ""), "genre": m.get("genre", project.genre),
        "tone": m.get("tone", ""), "story": m.get("story", ""), "language": project.language or "en",
        "visualStyle": m.get("visualStyle", ""),
        "characters": [{**{k: c.get(k) for k in ("name", "age", "gender", "role", "appearance", "personality", "family", "language") if c.get(k)},
                        "portraitRef": c.get("portraitRef")}  # the matched reference photo (None when none is installed)
                       for c in chars],
        "spokenLanguages": sorted({c.get("language") for c in chars if c.get("language")}),
        "locations": sorted({s.get("location", "") for s in m.get("scenes", []) if s.get("location")}),
    }


def _clean_scene(raw: object, number: int, bible_names: list[str]) -> dict:
    s = raw if isinstance(raw, dict) else {}
    chars = [str(c) for c in (s.get("characters") or []) if str(c).strip()] if isinstance(s.get("characters"), list) else []
    try:
        seconds = float(s.get("seconds") or 0)
    except (TypeError, ValueError):
        seconds = 0
    try:
        act = int(s.get("act") or 0)
    except (TypeError, ValueError):
        act = 0
    return {"number": number, "act": act, "title": str(s.get("title") or f"Scene {number}")[:300],
            "summary": str(s.get("summary") or ""), "location": str(s.get("location") or "")[:300],
            "characters": chars or bible_names[:1], "seconds": seconds}


def _fit_to_target(scenes: list[dict], target: int, shot_seconds: int) -> None:
    """Scale scene lengths so the film adds up to the target (each scene at least one shot long)."""
    n = len(scenes)
    weights = [s["seconds"] if s["seconds"] > 0 else target / n for s in scenes]
    total = sum(weights)
    for s, w in zip(scenes, weights):
        s["seconds"] = max(shot_seconds, round(target * w / total))
    drift = target - sum(s["seconds"] for s in scenes)  # rounding: settle on the longest scene
    longest = max(scenes, key=lambda s: s["seconds"])
    longest["seconds"] = max(shot_seconds, longest["seconds"] + drift)
    acts = (max(1, round(n * 0.25)), max(2, round(n * 0.75)))
    for s in scenes:
        if s["act"] not in (1, 2, 3):
            s["act"] = 1 if s["number"] <= acts[0] else 2 if s["number"] <= acts[1] else 3


def _new_characters(raw: object, existing: list[dict]) -> list[dict]:
    """The supporting cast the feature story asked for: named, not already in the film, at most 12."""
    taken = {str(c.get("name", "")).strip().lower() for c in existing}
    out = []
    for c in raw if isinstance(raw, list) else []:
        if not isinstance(c, dict) or not str(c.get("name", "")).strip():
            continue
        name = str(c["name"]).strip()[:120]
        if name.lower() in taken:
            continue
        taken.add(name.lower())
        out.append({"name": name, **{k: str(c.get(k) or "")[:2000] for k in
                                     ("age", "gender", "role", "personality", "appearance", "arc", "relationships", "family", "language")}})
    return out[:12]


async def expand_story(db: Session, job: AIJob, project: Project, prod) -> dict:
    """The teaser's premise grown into a feature-length story, with the extra characters it needs.
    New characters join the film's cast (Characters section), each with its matched reference portrait."""
    bible = story_bible(project)
    check_budget(prod, story_call_cost())
    res = await with_retry(lambda: story_provider().write_treatment(bible, minutes=round(prod.target_seconds / 60),
                                                                    language=bible["language"]), job, db)
    record_usage(db, job, res)
    prod.spent = round(prod.spent + res.cost, 4)
    data = res.data if isinstance(res.data, dict) else {}
    memory = dict(project.memory)
    chars = list(memory.get("characters", []))
    added = _new_characters(data.get("characters"), chars)
    if added:
        next_id = max([int(c["id"]) for c in chars if str(c.get("id", "")).isdigit()] + [0]) + 1
        chars += [{"id": str(next_id + i), **c} for i, c in enumerate(added)]
        memory = reference_portraits.assign(validate_film({**memory, "characters": chars}))
        project.memory = memory
        db.commit()
    bible = story_bible(project)
    feature = str(data.get("story") or "").strip()
    if feature:
        bible["premise"], bible["story"] = bible["story"], feature
    bible["acts"] = [a for a in data.get("acts") or [] if isinstance(a, dict)][:3]
    bible["subplots"] = [str(x) for x in data.get("subplots") or [] if str(x).strip()][:5]
    bible["newCharacters"] = [c["name"] for c in added]
    return bible


async def task_film_plan(db: Session, job: AIJob, project: Project) -> dict:
    prod = production_of(db, project.id)
    if prod is None or not project.memory:
        raise NeedsReview("Plan the film's story first, then make the full-length version.")
    prod.status, prod.error = "planning", ""
    for old in list(prod.scenes):  # a new plan replaces the old outline (nothing generated is kept from it)
        db.delete(old)
    db.commit()
    set_progress(db, job, "Writing the feature-length story and cast", 3)
    try:
        bible = await expand_story(db, job, project, prod)
    except BudgetReached as e:
        prod.status, prod.error = "budget_reached", str(e)
        db.commit()
        raise NeedsReview(str(e)) from e
    prod.story_bible = bible
    db.commit()
    total, names = scene_count(prod.target_seconds), [c["name"] for c in bible["characters"]]
    written: list[dict] = []
    provider = story_provider()
    for _ in range(total):  # one batch per round; a short reply just means more rounds
        first = len(written) + 1
        if first > total:
            break
        last = min(total, first + OUTLINE_BATCH - 1)
        set_progress(db, job, f"Outlining scenes {first}–{last} of {total}", 5 + int(85 * len(written) / total))
        try:
            check_budget(prod, story_call_cost())
        except BudgetReached as e:
            prod.status, prod.error = "budget_reached", str(e)
            db.commit()
            raise NeedsReview(str(e)) from e
        res = await with_retry(lambda: provider.outline_scenes(bible, first=first, last=last, total=total,
                                                               target_seconds=prod.target_seconds, story_so_far=written,
                                                               language=bible["language"]), job, db)
        record_usage(db, job, res)
        prod.spent = round(prod.spent + res.cost, 4)
        got = (res.data or {}).get("scenes") if isinstance(res.data, dict) else res.data
        got = [x for x in (got or []) if isinstance(x, dict)][: last - first + 1]
        if not got:
            raise NeedsReview(f"The story model returned no scenes for {first}–{last}. Try again.")
        written += [_clean_scene(x, len(written) + i + 1, names) for i, x in enumerate(got)]
    if len(written) < total:
        raise NeedsReview(f"Only {len(written)} of {total} scenes could be outlined. Try again.")
    _fit_to_target(written, prod.target_seconds, prod.shot_seconds)
    for s in written:
        db.add(FilmScene(production_id=prod.id, number=s["number"], act=s["act"], title=s["title"], summary=s["summary"],
                         location=s["location"], characters=s["characters"], target_seconds=s["seconds"]))
    prod.status = "planned"
    db.commit()
    return {"scenes": total, "targetSeconds": prod.target_seconds}
