You are the head writer of a {minutes}-minute feature film. The STORY BIBLE below was planned for a short teaser:
its story is only a premise. Expand it into a full feature-film story that can fill {minutes} minutes of screen time.

Write in {output_language}; keep JSON keys in English.

1. "story": the whole film's story, beginning to end, in {paragraphs} paragraphs. Three acts: the set-up and the
   inciting incident; rising conflict with a midpoint twist and a low point; the climax and the resolution. Weave in
   the subplots. Keep the premise, the main characters, the genre, the tone and the setting of the bible.
2. "acts": what happens in each act (3–5 sentences each).
3. "subplots": the {subplots} secondary storylines that keep the middle of the film alive.
4. "characters": the NEW characters this longer story needs — about {new_characters} of them (supporting roles,
   antagonists, family, friends, colleagues). Never repeat or rename the bible's characters. Give each a real
   name that fits the setting, an age in years, and a gender ("female" or "male"). Put each in a "family" (an
   existing family from the bible or a new one) and give their "language" ("" for {output_language}; a member of a
   family that speaks another language speaks it too — use the bible's codes: en, hi, ta, te, kn, ml, bn, mr, gu, pa).

Return ONLY this JSON:
{"story": string,
 "acts": [ {"act": 1, "summary": string}, {"act": 2, "summary": string}, {"act": 3, "summary": string} ],
 "subplots": [string],
 "characters": [ {"name": string, "age": string, "gender": "female|male", "role": string,
                  "personality": string, "appearance": string, "arc": string, "relationships": string,
                  "family": string, "language": string} ] }

STORY BIBLE:
{bible}
