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
