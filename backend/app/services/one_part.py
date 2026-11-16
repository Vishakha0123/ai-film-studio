"""Write only one part of a film the creator already has: its story, its screenplay (with dialogue), or its songs.

Faster and cheaper than planning the whole film. The film's memory then holds just that part, with "only" set,
so the studio shows that one section and offers to make the rest later."""

ONLY_PARTS = ("story", "screenplay", "lyrics")

# Which memory fields each part fills (the rest of the film stays empty)
PART_FIELDS = {
    "story": ("title", "genre", "tone", "logline", "story"),
    "screenplay": ("title", "genre", "tone", "logline", "characters", "screenplay", "dialogue"),
    "lyrics": ("title", "genre", "tone", "lyrics", "songs"),
}

PART_NAMES = {"story": "the story", "screenplay": "the screenplay, with its dialogue", "lyrics": "the songs (lyrics)"}

_CHARACTER = ('{"id": "1", "name": string, "age": string, "gender": "female" | "male", "role": string, '
              '"personality": string, "appearance": string, "family": string, "language": string}')
_SONG = ('{"title": string, "style": string, "moment": string, "singer": string, '
         '"verse": string, "preChorus": string, "chorus": string, "bridge": string}')

SCHEMAS = {
    "story": """{
  "title": string,            // the film's title (the creator's, if they gave one)
  "genre": string, "tone": string,
  "logline": string,          // one sentence
  "story": string             // the full story: 5-8 paragraphs separated by \\n\\n, beginning to end
}""",
    "screenplay": f"""{{
  "title": string, "genre": string, "tone": string,
  "logline": string,
  "characters": [ {_CHARACTER} ],   // everyone who speaks
  "screenplay": string,       // the screenplay in standard format: TITLE, FADE IN:, INT./EXT. headings,
                              // CHARACTER names in caps on their own line, (parentheticals), dialogue, CUT TO:
  "dialogue": [ {{"character": string, "text": string, "tone": string, "scene": number,
                 "language": string, "subtitle": string}} ]   // every spoken line of the screenplay, in order
}}""",
    "lyrics": f"""{{
  "title": string,            // the film's title (the creator's, if they gave one)
  "genre": string, "tone": string,
  "lyrics": {_SONG},          // the first / main song
  "songs": [ {_SONG} ]        // the other songs: brief.songs minus 1 ([] when brief.songs is 1 or missing)
}}""",
}

INSTRUCTIONS = {
    "story": "STORY: a complete, moving story with a clear beginning, middle and end — the hero's goal, what stands in "
             "the way, the turning points and how it ends. Paragraphs, not bullet points.",
    "screenplay": "SCREENPLAY: a real screenplay of the whole film in scenes — headings, action lines and dialogue. Every "
                  "line of dialogue also goes in \"dialogue\" (character, text, the scene number). If a character speaks "
                  "another language (a family's own language), write their lines in that language with \"language\" set "
                  "to its code (en, hi, ta, te, kn, ml, bn, mr, gu, pa) and \"subtitle\" in the film's language.",
    "lyrics": "SONGS: singable, rhyming where natural, each with verse (4 lines), preChorus (2), chorus (4) and bridge "
              "(2-4), lines separated by \\n. Fit each song to a moment of the creator's film (\"moment\" says where it "
              "plays, e.g. \"Opening\", \"When Meera leaves home\") and give each a different mood and style. "
              "\"singer\" = the character who sings it, or \"\" for a background song. Write brief.songs songs in all "
              "(1 if missing).",
}

FORMAT_NOTES = {
    "screenplay": " In the screenplay only the format words (INT., EXT., FADE IN:, CUT TO:) may stay in English.",
}


def keep_part(memory: dict, part: str) -> dict:
    """Only the fields of one part (used when the rest of the film is made around it)."""
    return {k: memory[k] for k in PART_FIELDS.get(part, ()) if k in memory and memory[k] not in ("", None, [])}


# ── Reading the model's reply ────────────────────────────────────────────────────────────────────────────────
# Models don't always use the exact keys asked for: songs come back as one list, under "song"/"otherSongs",
# lines as lists, "pre_chorus" instead of "preChorus", or a single song with no wrapper at all. Gather them.

_SONG_PARTS = ("verse", "preChorus", "chorus", "bridge")
_SONG_ALIASES = {"pre_chorus": "preChorus", "prechorus": "preChorus", "pre-chorus": "preChorus", "hook": "chorus",
                 "refrain": "chorus", "verse1": "verse", "verse_1": "verse", "stanza": "verse", "name": "title",
                 "song_title": "title", "songTitle": "title", "where": "moment", "situation": "moment",
                 "placement": "moment", "genre": "style", "mood": "style"}


def _text(value) -> str:
    if isinstance(value, list):
        return "\n".join(_text(v) for v in value if v not in (None, ""))
    if isinstance(value, dict):
        return "\n".join(_text(v) for v in value.values() if v not in (None, ""))
    return "" if value is None else str(value).strip()


def _as_song(value) -> dict | None:
    """A song dict with verse/chorus text, or None if this isn't a song."""
    if not isinstance(value, dict):
        return None
    song: dict = {}
    extra_verses = []
    for key, v in value.items():
        k = _SONG_ALIASES.get(key, _SONG_ALIASES.get(key.lower(), key))
        if k in ("verse2", "verse_2", "verse3", "verse_3"):
            extra_verses.append(_text(v))
        elif k in _SONG_PARTS:
            song[k] = (song.get(k, "") + "\n" + _text(v)).strip() if song.get(k) else _text(v)
        elif k in ("title", "style", "moment", "singer"):
            song[k] = _text(v)
        elif k == "lyrics" and (isinstance(v, str) or (isinstance(v, list) and all(isinstance(x, str) for x in v))):
            # the whole song as one text (not a list of songs)
            song["verse"] = (song.get("verse", "") + "\n" + _text(v)).strip()
    if extra_verses:
        song["verse"] = "\n\n".join([song.get("verse", ""), *extra_verses]).strip()
    return song if any(song.get(p) for p in _SONG_PARTS) else None


def _songs_in(value) -> list[dict]:
    if isinstance(value, list):
        return [s for s in (_as_song(v) for v in value) if s]
    song = _as_song(value)
    if song:
        return [song]
    if isinstance(value, dict):  # {"song1": {...}, "song2": {...}}
        return [s for s in (_as_song(v) for v in value.values()) if s]
    return []


def _unwrap(data: dict) -> dict:
    """{"film": {...}} / {"result": {...}} → the inner object."""
    while isinstance(data, dict) and len(data) == 1:
        (only_value,) = data.values()
        if not isinstance(only_value, dict):
            break
        data = only_value
    return data if isinstance(data, dict) else {}


def normalize_part(part: str, data) -> dict:
    """The model's reply for one part, in the FilmProject shape (keys from PART_FIELDS)."""
    data = _unwrap(data if isinstance(data, dict) else {})
    out = {k: data[k] for k in ("title", "genre", "tone", "logline") if isinstance(data.get(k), str)}
    if part == "lyrics":
        songs: list[dict] = []
        if _as_song(data):  # one song, no wrapper
            songs.append(_as_song(data))
            out.pop("genre", None)
        for key, value in data.items():
            if key in ("lyrics", "songs", "song", "otherSongs", "other_songs", "moreSongs", "additionalSongs") or \
                    "song" in key.lower() or "lyric" in key.lower():
                songs += _songs_in(value)
        if songs:
            out["lyrics"], out["songs"] = songs[0], songs[1:]
        return out
    if part == "story":
        story = data.get("story") or data.get("fullStory") or data.get("full_story") or data.get("synopsis")
        if story:
            out["story"] = "\n\n".join(_text(p) for p in story) if isinstance(story, list) else _text(story)
        return out
    # screenplay
    play = data.get("screenplay") or data.get("script") or data.get("screenPlay")
    if play:
        out["screenplay"] = _text(play)
    if isinstance(data.get("characters"), list):
        out["characters"] = data["characters"]
    if isinstance(data.get("dialogue") or data.get("dialogues"), list):
        out["dialogue"] = data.get("dialogue") or data.get("dialogues")
    return out
