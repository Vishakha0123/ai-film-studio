"""Ten reusable reference portraits (5 female, 5 male, child → elderly), matched to each character automatically.

When a film is planned, every character gets the closest portrait for their age and gender (`portraitRef`).
The app shows it as the character's picture until a generated portrait exists, and the image provider gets it
as a visual reference when it makes one. Matching never changes a character's details — it only picks a picture.

Files live in REFERENCE_PORTRAITS_DIR (default backend/portraits/) as <id>.webp / .jpg / .jpeg / .png, e.g.
female-senior.webp. Missing files are skipped: the nearest available portrait is used instead, and with none at
all the character simply has no reference.

    python -m app.services.reference_portraits      # which of the 10 files are present
"""

import re
import zlib
from dataclasses import dataclass
from pathlib import Path

from app.config import get_settings
from app.services.portraits import age_band

EXTENSIONS = (".webp", ".jpg", ".jpeg", ".png")
DEFAULT_AGE = 35  # no age anywhere → an adult


@dataclass(frozen=True)
class Reference:
    id: str
    gender: str
    age: int  # the age the portrait looks
    label: str

    @property
    def band(self) -> str:
        return age_band(self.age)


REFERENCES: tuple[Reference, ...] = (
    Reference("female-child", "female", 7, "Girl, about 7"),
    Reference("female-teen", "female", 15, "Teenage girl, about 15"),
    Reference("female-young", "female", 26, "Young woman, about 26"),
    Reference("female-adult", "female", 45, "Woman, about 45"),
    Reference("female-senior", "female", 72, "Elderly woman, about 72"),
    Reference("male-child", "male", 7, "Boy, about 7"),
    Reference("male-teen", "male", 15, "Teenage boy, about 15"),
    Reference("male-young", "male", 26, "Young man, about 26"),
    Reference("male-adult", "male", 45, "Man, about 45"),
    Reference("male-senior", "male", 72, "Elderly man, about 72"),
)
BY_ID = {r.id: r for r in REFERENCES}


def portraits_dir() -> Path:
    return Path(get_settings().REFERENCE_PORTRAITS_DIR)


def available() -> dict[str, Path]:
    """Reference id → file, for the portraits that are actually there."""
    folder = portraits_dir()
    found: dict[str, Path] = {}
    for r in REFERENCES:
        for ext in EXTENSIONS:
            path = folder / f"{r.id}{ext}"
            if path.is_file() and path.stat().st_size > 0:
                found[r.id] = path
                break
    return found


# ---------- Reading age and gender ----------

_DIGIT_ZEROS = (0x0966, 0x09E6, 0x0A66, 0x0AE6, 0x0B66, 0x0BE6, 0x0C66, 0x0CE6, 0x0D66)
_AGE_WORDS = (  # used only when no number is given
    (r"\b(baby|infant|toddler)\b", 3), (r"\b(child|kid|little (girl|boy)|schoolgirl|schoolboy)\b", 8),
    (r"\b(teen|teenage|teenager|adolescent)\b", 15), (r"\b(young|college|student|twenties)\b", 24),
    (r"\b(middle[- ]aged|forties|fifties)\b", 48),
    (r"\b(old (?:man|woman|lady|person)|elderly|aged|senior|grandmother|grandfather|granny|grandpa|grandma|paati|thatha|dadi|dada|nani|nana|ajji|ajja)\b", 72),
)
_FEMALE = re.compile(r"\b(she|her|hers|woman|women|girl|lady|mother|mom|mum|amma|wife|daughter|sister|aunt|grandmother|"
                     r"granny|grandma|paati|ammamma|dadi|nani|ajji|queen|princess|bride|actress|heroine|widow)\b", re.I)
_MALE = re.compile(r"\b(he|him|his|man|men|boy|gentleman|father|dad|appa|husband|son|brother|uncle|grandfather|grandpa|"
                   r"thatha|dada|nana|ajja|king|prince|groom|actor|hero|widower)\b", re.I)


def _ascii_digits(text: str) -> str:
    out = []
    for ch in text:
        zero = next((z for z in _DIGIT_ZEROS if z <= ord(ch) <= z + 9), None)
        out.append(str(ord(ch) - zero) if zero is not None else ch)
    return "".join(out)


def parse_age(value: object) -> int | None:
    """'78', '9 years', 'early 30s', '੫੫' → a number; 'elderly', 'teenager' → a typical age; nothing → None."""
    text = _ascii_digits(str(value or "")).lower()
    if m := re.search(r"\d{1,3}", text):
        return int(m.group())
    for pattern, age in _AGE_WORDS:
        if re.search(pattern, text):
            return age
    return None


def gender_from_text(text: str) -> str:
    f, m = len(_FEMALE.findall(text or "")), len(_MALE.findall(text or ""))
    return "female" if f > m else "male" if m > f else ""


def character_gender(c: dict) -> str:
    if c.get("gender") in ("female", "male"):
        return c["gender"]
    return gender_from_text(" ".join(str(c.get(k, "")) for k in ("role", "appearance", "personality", "relationships", "name")))


def character_age(c: dict) -> int | None:
    return parse_age(c.get("age")) or parse_age(f"{c.get('role', '')} {c.get('appearance', '')}")


# ---------- What the prompt itself says ----------

_NAME = r"([A-Z][\w'’-]{1,30})"
_PROMPT_AGE_PATTERNS = (
    re.compile(_NAME + r"\s*\(\s*(\d{1,3})\s*\)"),                                                     # Arjun (9)
    re.compile(_NAME + r",?\s+(?:a|an|the|who is|aged?)?\s*(\d{1,3})[- ]?(?:years?|yrs?)?[- ]?old\b"),   # Paati, a 78-year-old
    re.compile(_NAME + r",\s*aged?\s+(\d{1,3})\b"),                                                     # Divya, aged 22
    re.compile(_NAME + r",\s*(\d{1,3})\s*[,;)]"),                                                       # Divya, 22,
    re.compile(r"(\d{1,3})[- ]?(?:years?|yrs?)[- ]?old\s+(?:[a-z-]+\s+){0,3}?(?:named|called)\s+" + _NAME),  # a 70-year-old fisherman named Ravi
)


def prompt_facts(prompt: str) -> dict[str, dict]:
    """Ages and genders the creator gave named characters in the prompt: {'paati': {'age': 78, 'gender': 'female'}}."""
    text = prompt or ""
    found: list[tuple[int, int, str, int]] = []  # (start of match, start of name, name, age)
    for i, pattern in enumerate(_PROMPT_AGE_PATTERNS):
        for m in pattern.finditer(text):
            name_group, age_group = (2, 1) if i == len(_PROMPT_AGE_PATTERNS) - 1 else (1, 2)
            name = m.group(name_group)
            if name.lower() in ("a", "an", "the", "and", "with", "her", "his", "she", "he"):
                continue
            found.append((m.start(), m.start(name_group), name, int(m.group(age_group))))
    found.sort()
    facts: dict[str, dict] = {}
    for n, (start, name_at, name, age) in enumerate(found):
        # this person's words: up to the next ";" / sentence end, or where the next named person starts
        end = found[n + 1][0] if n + 1 < len(found) else len(text)
        clause = re.split(r"[;.]", text[start:end], maxsplit=1)[0]
        gender = gender_from_text(clause) or gender_from_text("".join(text[:name_at].split()[-1:]))  # the word just before: "grandfather Kannan"
        facts.setdefault(name.lower(), {"age": age, "gender": gender})
    return facts


def apply_prompt_facts(memory: dict, prompt: str) -> dict:
    """Where the prompt states a named character's age (or gender), that's what the character keeps."""
    facts = prompt_facts(prompt)
    if not facts:
        return memory
    chars = []
    for c in memory.get("characters", []):
        c = dict(c)
        first = str(c.get("name", "")).split()[0].lower() if c.get("name") else ""
        fact = facts.get(first) or facts.get(str(c.get("name", "")).lower())
        if fact:
            c["age"] = str(fact["age"])
            if fact["gender"]:
                c["gender"] = fact["gender"]
        chars.append(c)
    return {**memory, "characters": chars}


# ---------- Choosing the portrait ----------

def choose_reference(age: int | None, gender: str, key: str = "", files: dict[str, Path] | None = None) -> str:
    """The closest available portrait: same gender, then same age band, then nearest age. "" if none exist."""
    files = available() if files is None else files
    if not files:
        return ""
    target = age if age is not None else DEFAULT_AGE
    band = age_band(target)
    if gender not in ("female", "male"):  # unknown → a stable choice per character, so a cast isn't all one gender
        gender = ("female", "male")[zlib.crc32(key.encode()) % 2]
    order = [gender, "male" if gender == "female" else "female"]
    for g in order:
        refs = [r for r in REFERENCES if r.gender == g and r.id in files]
        if refs:
            return min(refs, key=lambda r: (r.band != band, abs(r.age - target))).id
    return ""


def assign(memory: dict, files: dict[str, Path] | None = None) -> dict:
    """Give every character its closest reference portrait (only `portraitRef` changes)."""
    files = available() if files is None else files
    chars = []
    for c in memory.get("characters", []):
        ref = choose_reference(character_age(c), character_gender(c), str(c.get("name") or c.get("id")), files)
        chars.append({**c, "portraitRef": ref})
    return {**memory, "characters": chars}


def reference_bytes(ref_id: str) -> bytes | None:
    path = available().get(ref_id)
    return path.read_bytes() if path else None


def reference_url(ref_id: str) -> str | None:
    path = available().get(ref_id)
    return f"{get_settings().PUBLIC_BASE_URL.rstrip('/')}/portraits/{path.name}" if path else None


if __name__ == "__main__":
    have = available()
    print(f"Reference portraits in {portraits_dir().resolve()}: {len(have)} of {len(REFERENCES)}")
    for r in REFERENCES:
        print(f"  {'✓' if r.id in have else '–'} {r.id:<14} {r.label:<24} {have[r.id].name if r.id in have else f'add {r.id}.webp (or .jpg/.png)'}")
