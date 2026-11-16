import json
import re

_DECODER = json.JSONDecoder()


def _objects(text: str) -> list:
    """Every top-level JSON object in `text`, in order (text between them is skipped)."""
    found, i = [], text.find("{")
    while i != -1:
        try:
            obj, end = _DECODER.raw_decode(text, i)
        except json.JSONDecodeError:
            i = text.find("{", i + 1)
            continue
        if isinstance(obj, dict):
            found.append(obj)
        i = text.find("{", end)
    return found


def _merge(objs: list[dict]) -> dict:
    """Pieces of one answer split over several blocks → one object (a key's first non-empty value wins)."""
    merged: dict = {}
    for obj in objs:
        for k, v in obj.items():
            if k not in merged or merged[k] in ("", None, [], {}):
                merged[k] = v
    return merged


def extract_json(text: str) -> dict:
    """Parse a JSON object from an LLM reply (tolerates <think> blocks, ``` fences, and an answer split over
    several fenced blocks or several objects — those are merged)."""
    text = re.sub(r"<think>.*?</think>", "", text or "", flags=re.S)
    text = re.sub(r"<think>.*\Z", "", text, flags=re.S).strip()  # thinking that never closed (cut-off reply)
    fences = re.findall(r"```(?:json)?\s*(.*?)```", text, flags=re.S)
    if fences:
        objs = [o for f in fences for o in _objects(f)]
        if objs:
            return objs[0] if len(objs) == 1 else _merge(objs)
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("No JSON object in model reply")
    try:
        return json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        objs = _objects(text[start : end + 1])
        if len(objs) > 1:
            return _merge(objs)
        raise
