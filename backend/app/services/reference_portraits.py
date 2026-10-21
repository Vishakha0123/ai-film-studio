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


BACKEND_DIR = Path(__file__).resolve().parents[2]


def portraits_dir() -> Path:
    """backend/portraits by default — the same folder whichever directory the server is started from."""
    configured = get_settings().REFERENCE_PORTRAITS_DIR
    if not configured:
        return BACKEND_DIR / "portraits"
    path = Path(configured)
    return path if path.is_absolute() else (BACKEND_DIR / path).resolve()


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


# The same words in the film languages (Hindi/Marathi, Tamil, Telugu, Kannada, Malayalam, Bengali, Gujarati, Punjabi).
# Matched inside words, so female words are counted first and removed (ಅಜ್ಜಿ "grandmother" contains ಅಜ್ಜ "grandfather").
_FEMALE_INDIC = (
    "महिला", "स्त्री", "मुलगी", "लड़की", "लडकी", "आजी", "दादी", "नानी", "आई", "माँ", "मां", "पत्नी", "बायको", "बहीण", "बहन",
    "बेटी", "काकू", "मावशी", "आत्या", "राणी", "रानी", "नायिका", "वहिनी", "ताई", "बाई",
    "பெண்", "அம்மா", "பாட்டி", "மகள்", "அக்கா", "தங்கை", "மனைவி", "சிறுமி",
    "అమ్మాయి", "అమ్మమ్మ", "అమ్మ", "భార్య", "కూతురు", "అక్క", "చెల్లి", "స్త్రీ",
    "ಹುಡುಗಿ", "ಅಜ್ಜಿ", "ಅಮ್ಮ", "ಹೆಂಡತಿ", "ಮಗಳು", "ಮಹಿಳೆ",
    "പെൺ", "അമ്മ", "മുത്തശ്ശി", "ഭാര്യ", "മകൾ", "സ്ത്രീ",
    "মেয়ে", "মহিলা", "দিদিমা", "ঠাকুমা", "স্ত্রী",
    "સ્ત્રી", "છોકરી", "માતા", "દાદી", "પત્ની",
    "ਔਰਤ", "ਕੁੜੀ", "ਮਾਂ", "ਦਾਦੀ", "ਪਤਨੀ",
)
_MALE_INDIC = (
    "पुरुष", "मुलगा", "लड़का", "लडका", "आजोबा", "दादा", "नाना", "बाबा", "वडील", "पिता", "पती", "नवरा", "भाऊ", "भाई", "बेटा",
    "काका", "मामा", "राजा", "नायक",
    "ஆண்", "அப்பா", "தாத்தா", "மகன்", "அண்ணன்", "தம்பி", "கணவன்", "சிறுவன்",
    "అబ్బాయి", "నాన్న", "తాత", "భర్త", "కొడుకు", "అన్న", "తమ్ముడు", "పురుషుడు",
    "ಹುಡುಗ", "ಅಜ್ಜ", "ಅಪ್ಪ", "ಗಂಡ", "ಮಗ", "ಪುರುಷ",
    "ആൺ", "അച്ഛൻ", "മുത്തച്ഛൻ", "ഭർത്താവ്", "മകൻ",
    "ছেলে", "পুরুষ", "বাবা", "দাদু",
    "પુરુષ", "છોકરો", "પિતા", "દાદા", "પતિ",
    "ਆਦਮੀ", "ਮੁੰਡਾ", "ਪਿਤਾ", "ਦਾਦਾ", "ਪਤੀ",
)
# Hindi/Marathi words that change with gender: लपवणारी / लपवणारा, घरवाली / घरवाला, रहती है / रहता है
_FEMALE_ENDINGS = re.compile(r"(णारी|वाली|ती है|ती हैं|लेली)(?=[\s,.;:!?)]|$)")
_MALE_ENDINGS = re.compile(r"(णारा|वाला|ता है|ता हैं|लेला)(?=[\s,.;:!?)]|$)")


def gender_from_text(text: str) -> str:
    text = text or ""
    f, m = len(_FEMALE.findall(text)), len(_MALE.findall(text))
    rest = text
    for word in _FEMALE_INDIC:
        f += rest.count(word)
        rest = rest.replace(word, " ")
    m += sum(rest.count(word) for word in _MALE_INDIC)
    f += len(_FEMALE_ENDINGS.findall(text))
    m += len(_MALE_ENDINGS.findall(text))
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
    found: list[tuple[int, int, str, int, int]] = []  # (match start, name start, name, age, match end)
    for i, pattern in enumerate(_PROMPT_AGE_PATTERNS):
        for m in pattern.finditer(text):
            name_group, age_group = (2, 1) if i == len(_PROMPT_AGE_PATTERNS) - 1 else (1, 2)
            name = m.group(name_group)
            if name.lower() in ("a", "an", "the", "and", "with", "her", "his", "she", "he"):
                continue
            found.append((m.start(), m.start(name_group), name, int(m.group(age_group)), m.end()))
    found.sort()
    facts: dict[str, dict] = {}
    for n, (start, name_at, name, age, end_at) in enumerate(found):
        # this person's words: up to the next ";" / sentence end, or where the next named person starts
        end = found[n + 1][0] if n + 1 < len(found) else len(text)
        clause = re.split(r"[;.]", text[start:end], maxsplit=1)[0]
        right_after = " ".join(re.split(r"[,;.]", text[end_at:], maxsplit=1)[0].split()[:3])  # "14-year-old girl"
        gender = (gender_from_text(right_after) or gender_from_text(clause)
                  or gender_from_text("".join(text[:name_at].split()[-1:])))  # or the word just before: "grandfather Kannan"
        facts.setdefault(name.lower(), {"age": age, "gender": gender})
    return facts


def apply_prompt_facts(memory: dict, prompt: str) -> dict:
    """Where the prompt states a named character's age (or gender), that's what the character keeps."""
    facts = prompt_facts(prompt)
    if not facts:
        return memory
    chars = [dict(c) for c in memory.get("characters", [])]
    used: set[str] = set()
    unmatched = []
    for c in chars:
        first = str(c.get("name", "")).split()[0].lower() if c.get("name") else ""
        key = first if first in facts else str(c.get("name", "")).lower()
        if key in facts:
            _apply(c, facts[key])
            used.add(key)
        else:
            unmatched.append(c)
    # A film in another language writes the names in its own script ("Kamala" → "कमला"): match those by age instead,
    # when exactly one remaining character has the age the prompt gave exactly one remaining person.
    left = {k: f for k, f in facts.items() if k not in used}
    for c in unmatched:
        age = parse_age(c.get("age"))
        same = [k for k, f in left.items() if f["age"] == age]
        if age is not None and len(same) == 1 and sum(parse_age(o.get("age")) == age for o in unmatched) == 1:
            _apply(c, left.pop(same[0]))
    return {**memory, "characters": chars}


def _apply(c: dict, fact: dict) -> None:
    c["age"] = str(fact["age"])
    if fact["gender"]:
        c["gender"] = fact["gender"]


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
