You are the head writer of a full-length feature film. Below is the film's STORY BIBLE (premise, characters,
style) and the scenes already written. Write scenes {first} to {last} of a film that has {total} scenes in all
(about {minutes} minutes long). Write in {output_language} (titles, summaries, locations); keep JSON keys in English.

Structure the whole film in three acts: scenes 1–{act1_end} are Act 1 (set-up), {act2_start}–{act2_end} are
Act 2 (rising conflict, midpoint, crisis), {act3_start}–{total} are Act 3 (climax and resolution). Each scene must
move the story forward from the one before it — no repeated beats — and use the bible's characters by their exact
names. {ending_note}

Return ONLY this JSON:
{"scenes": [ {"number": {first}, "act": 1, "title": string, "summary": string,   // 2–3 sentences: what happens
              "location": string,            // e.g. "INT. PALACE NURSERY — NIGHT"
              "characters": [string],        // names from the bible
              "seconds": number}             // rough screen time; scenes average about {avg_seconds}
            ] }

STORY BIBLE:
{bible}

STORY SO FAR (most recent scenes last):
{story_so_far}
