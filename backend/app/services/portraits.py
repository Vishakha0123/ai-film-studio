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
    """A live-action casting photo of a unique, fictional person with the character's recorded details.

    Keeps the character's age, gender, background, look, clothing, personality and place in the story;
    the camera/lighting part asks for a real photograph (the negative prompt is sent separately).
    """
    band = age_band(char.get("age"))
    gender = char.get("gender", "") if char.get("gender") in ("female", "male") else ""
    who = _WHO[(band, gender)]
    age = str(char.get("age", "")).strip()
    memory = project.memory or {}
    language = (project.language or "en")
    parts = [
        f"Photorealistic close-up portrait photograph of {who}" + (f", exactly {age} years old" if age else "")
        + f", a fictional character named {char['name']} in a live-action feature film",
        f"Role in the story: {char['role']}" if char.get("role") else "",
        f"Appearance, hair and clothing: {char['appearance']}" if char.get("appearance") else "",
        f"Personality to show in the expression: {char['personality']}" if char.get("personality") else "",
        f"Story world: {memory['logline']}" if memory.get("logline") else "",
        f"Film: {memory.get('genre', '')}, {memory.get('tone', '')}".strip(", ") if memory.get("genre") or memory.get("tone") else "",
        f"Background and culture fit a film made in {language_name(language)}" if language != "en" else "",
        _AGE_DETAIL[band],
        "A unique, fictional individual with their own distinct face (not a celebrity or a real person). "
        "Realistic facial anatomy and natural asymmetry, real skin texture with visible pores and fine lines, "
        "believable individual hair strands, natural eyes with catchlights. Shot like a casting photograph on a "
        "full-frame cinema camera, 85mm lens at f/2, soft key light with gentle fill, natural colour, shallow depth "
        "of field, head and shoulders, softly blurred neutral background",
    ]
    return ". ".join(p for p in parts if p) + "."


def negative_prompt() -> str:
    return get_settings().PORTRAIT_NEGATIVE_PROMPT


_AGE_DETAIL = {
    "child": "Age-appropriate child features: soft rounded face, small nose, baby teeth or a gap-toothed smile where natural",
    "teen": "Age-appropriate teenage features: youthful skin, still-maturing face, natural teenage expression",
    "young": "Age-appropriate young-adult features: smooth skin with natural texture, defined jawline",
    "adult": "Age-appropriate adult features: early fine lines and laugh lines, mature face",
    "senior": "Age-appropriate elderly features: natural deep wrinkles, crow's feet, age spots, thinning or grey hair, "
              "softened jawline, expressive, knowing eyes",
}


def language_name(code: str) -> str:
    from app.services.languages import LANGUAGES
    return LANGUAGES.get(code, (code, code))[0]


def real_images_available() -> bool:
    """Real portraits need a real image model; the offline mock would only make placeholders."""
    s = get_settings()
    return s.IMAGE_PROVIDER != "mock" or s.ALLOW_MOCK_PORTRAITS


def portraits_enabled() -> bool:
    """Make portraits automatically (after planning, or when a character is added or changes)."""
    return get_settings().AUTO_PORTRAITS and real_images_available()
