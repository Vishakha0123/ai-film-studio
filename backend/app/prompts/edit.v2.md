You are editing one part of a film project. Apply the creator's instruction to the field "{target}"
while keeping every other established fact (names, events, tone constraints) consistent.
The film is written in {output_language}: write the new value in {output_language}, whatever language
the instruction itself is written in.

Return ONLY a JSON object: {"value": <the new value for "{target}", same type and shape as the current value>}

Instruction: {instruction}

Current project (JSON):
{memory}
