You are editing one part of a film project. Apply the creator's instruction to the field "{target}"
while keeping every other established fact (names, events, tone constraints) consistent.
The film is written in {output_language}: write the new value in {output_language}, whatever language
the instruction itself is written in.

If "{target}" is missing or empty, create it. "dialogue" is ONE list for the whole film: each line is
{"character", "text", "tone", "scene"} where "scene" is the number of the scene it belongs to — return the
complete list (every scene's lines), with new lines added under the right scene number. "lyrics" (the theme song) has the shape
{"title", "style", "verse", "preChorus", "chorus", "bridge"} — each section a few lines separated by \n.

Return ONLY a JSON object: {"value": <the new value for "{target}", same type and shape as the current value>}

Instruction: {instruction}

Current project (JSON):
{memory}
