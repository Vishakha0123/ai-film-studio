"""Film languages the studio writes in (matches the language picker in the app)."""

LANGUAGES: dict[str, tuple[str, str]] = {
    "en": ("English", "English"),
    "hi": ("Hindi", "हिन्दी"),
    "ta": ("Tamil", "தமிழ்"),
    "te": ("Telugu", "తెలుగు"),
    "kn": ("Kannada", "ಕನ್ನಡ"),
    "ml": ("Malayalam", "മലയാളം"),
    "bn": ("Bengali", "বাংলা"),
    "mr": ("Marathi", "मराठी"),
    "gu": ("Gujarati", "ગુજરાતી"),
    "pa": ("Punjabi", "ਪੰਜਾਬੀ"),
}


def is_supported(code: str) -> bool:
    return code in LANGUAGES


def describe(code: str) -> str:
    """'Tamil (தமிழ், ta)' — explicit enough for the story model; unknown codes pass through."""
    if code not in LANGUAGES:
        return code
    name, native = LANGUAGES[code]
    return name if code == "en" else f"{name} ({native}, {code})"


def native_name(code: str) -> str:
    return LANGUAGES.get(code, (code, code))[1]
