"""Catches text the story model wrote in the wrong language (e.g. an English screenplay in a Punjabi film).

Indian languages each have their own script, so a field that is mostly Latin letters when the film is in
Punjabi, Tamil, Hindi… was written in English. Scene headings and transitions (INT., EXT., FADE IN:, CUT TO:)
are allowed to stay in English and are not counted.
"""

import re

# Unicode block of each film language's script
SCRIPTS: dict[str, tuple[int, int]] = {
    "hi": (0x0900, 0x097F), "mr": (0x0900, 0x097F),  # Devanagari
    "bn": (0x0980, 0x09FF), "pa": (0x0A00, 0x0A7F), "gu": (0x0A80, 0x0AFF),
    "ta": (0x0B80, 0x0BFF), "te": (0x0C00, 0x0C7F), "kn": (0x0C80, 0x0CFF), "ml": (0x0D00, 0x0D7F),
}

_FORMAT_LINE = re.compile(r"^\s*(INT\.|EXT\.|INT/EXT|EXT/INT|I/E|FADE |FADE$|FADE IN|FADE OUT|CUT TO|SMASH CUT|DISSOLVE|MATCH CUT|THE END)", re.I)

# Fields whose words should be in the film's language (shots/visual prompts are excluded on purpose)
CHECKED = ("logline", "story", "screenplay", "dialogue", "lyrics", "scenes", "characters")


def _text_of(key: str, value) -> str:
    if isinstance(value, str):
        if key == "screenplay":
            return "\n".join(line for line in value.splitlines() if not _FORMAT_LINE.match(line))
        return value
    if key == "dialogue" and isinstance(value, list):
        return " ".join(str(l.get("text", "")) for l in value if isinstance(l, dict))
    if key == "lyrics" and isinstance(value, dict):
        return " ".join(str(value.get(k, "")) for k in ("verse", "preChorus", "chorus", "bridge"))
    if key == "scenes" and isinstance(value, list):
        return " ".join(str(s.get("description", "")) for s in value if isinstance(s, dict))
    if key == "characters" and isinstance(value, list):
        return " ".join(f"{c.get('personality', '')} {c.get('arc', '')}" for c in value if isinstance(c, dict))
    return ""


def in_language(text: str, language: str) -> bool:
    """True when most letters are in the language's script (or there's too little text to tell)."""
    block = SCRIPTS.get(language)
    if not block:
        return True  # English and unknown codes: nothing to check
    lo, hi = block
    letters = [ch for ch in text if ch.isalpha()]
    if len(letters) < 30:
        return True
    native = sum(1 for ch in letters if lo <= ord(ch) <= hi)
    return native / len(letters) >= 0.5


def wrong_language_fields(memory: dict, language: str, only: tuple[str, ...] = CHECKED) -> list[str]:
    """The parts of the film written in another language than the film's."""
    if language not in SCRIPTS:
        return []
    return [k for k in only if k in memory and not in_language(_text_of(k, memory[k]), language)]
