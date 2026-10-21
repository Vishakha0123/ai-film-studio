"""Photorealistic AI portraits of the film's characters (real-looking people, by age and gender).

Portraits are made right after a film is planned (and when a character is added or their age, gender or
look changes), separately from the teaser, so the cast has real faces from the start.
"""

import re

from app.config import get_settings

PORTRAIT_SIZE = "1024x1536"  # tall, head-and-shoulders

_DIGIT_ZEROS = (0x0966, 0x09E6, 0x0A66, 0x0AE6, 0x0B66, 0x0BE6, 0x0C66, 0x0CE6, 0x0D66)


def _ascii_digits(text: str) -> str:
    out = []
    for ch in text:
        c = ord(ch)
        zero = next((z for z in _DIGIT_ZEROS if z <= c <= z + 9), None)
        out.append(str(c - zero) if zero is not None else ch)
    return "".join(out)


def age_band(age: object) -> str:
    """child (<13) · teen (13–19) · young (20–34) · adult (35–54) · senior (55+) — same rules as the app."""
    text = _ascii_digits(str(age or "")).lower()
    if m := re.search(r"\d+", text):
        n = int(m.group())
        return "child" if n < 13 else "teen" if n < 20 else "young" if n < 35 else "adult" if n < 55 else "senior"
    if re.search(r"baby|toddler|child|kid|little", text):
        return "child"
    if "teen" in text:
        return "teen"
    if re.search(r"old|elder|senior|aged|grand", text):
        return "senior"
    if re.search(r"young|twenties", text):
        return "young"
    return "adult"


_WHO = {
    ("child", "female"): "a little girl", ("child", "male"): "a little boy", ("child", ""): "a child",
    ("teen", "female"): "a teenage girl", ("teen", "male"): "a teenage boy", ("teen", ""): "a teenager",
    ("young", "female"): "a young woman", ("young", "male"): "a young man", ("young", ""): "a young adult",
    ("adult", "female"): "a woman", ("adult", "male"): "a man", ("adult", ""): "an adult",
    ("senior", "female"): "an elderly woman", ("senior", "male"): "an elderly man", ("senior", ""): "an elderly person",
}


def portrait_prompt(project, char: dict) -> str:
    """A photograph-style prompt: a real-looking person of the right age and gender, in the film's world."""
    band = age_band(char.get("age"))
    who = _WHO[(band, char.get("gender", "") if char.get("gender") in ("female", "male") else "")]
    age = str(char.get("age", "")).strip()
    memory = project.memory or {}
    parts = [
        f"Photorealistic portrait photograph of {who}" + (f", age {age}" if age else "") + f", playing {char['name']}",
        f"role: {char['role']}" if char.get("role") else "",
        f"look: {char['appearance']}" if char.get("appearance") else "",
        f"film: {memory.get('genre', '')}, {memory.get('tone', '')}".strip(", ") if memory.get("genre") or memory.get("tone") else "",
        "A real human being photographed on a cinema camera: natural skin texture and pores, real hair, "
        "realistic eyes, head and shoulders, looking slightly off camera, soft cinematic key light, shallow depth "
        "of field, 85mm lens, plain dark background. Not a drawing, not a cartoon, not 3D, no text, no watermark.",
    ]
    return ". ".join(p for p in parts if p)


def real_images_available() -> bool:
    """Real portraits need a real image model; the offline mock would only make placeholders."""
    s = get_settings()
    return s.IMAGE_PROVIDER != "mock" or s.ALLOW_MOCK_PORTRAITS


def portraits_enabled() -> bool:
    """Make portraits automatically (after planning, or when a character is added or changes)."""
    return get_settings().AUTO_PORTRAITS and real_images_available()
