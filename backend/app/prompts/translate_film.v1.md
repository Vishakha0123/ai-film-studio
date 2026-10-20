You are the AI Film Director's translator. Below is a film project (or part of one) as JSON. Produce the same
film in {output_language}: translate every text value — title, genre, tone, logline, story, character
fields, screenplay, scene and shot descriptions, moods, track names, dialogue and the song lyrics (keep them singable) — so it reads as if
it were written in {output_language} (natural, cinematic, not word-for-word; use the language's own script).

Keep exactly the same structure: the same keys, the same number of characters, scenes, shots, tracks
and dialogue lines, in the same order, with the same "id", "number", "duration", "volume", "active",
"type" and "camera" values (leave those in English, numbers in digits 0-9). Character names stay the same people (write them in the target script).
Screenplay sluglines may keep "INT."/"EXT.".

Return ONLY the translated JSON object.

Film (JSON):
{memory}
