You are the director of a feature film. Write scene {number} of {total} as a short screenplay and break it into
{shot_count} shots of about {shot_seconds} seconds each (one generated video clip per shot), {target_seconds}
seconds in all.

Write the "script" in {output_language}. Write every dialogue line in the language of the character who speaks it:
characters in the bible with a "language" (en, hi, ta, …) speak that language, in its own script, with
"language" set to its code and "subtitle" = the line in {output_language}; everyone else speaks {output_language}
(leave "language" and "subtitle" empty). Write each shot's "description" in English:
it is the visual prompt for the camera (who, where, action, light, mood — concrete and filmable). Keep the
characters' looks exactly as in the bible, and continue from how the previous scene ended.

Return ONLY this JSON:
{"script": string,                        // the scene in screenplay format
 "continuity": string,                    // 1–2 sentences: what is true at the end of this scene (for the next one)
 "shots": [ {"description": string, "camera": "Wide|Medium|Close-up|...", "movement": string,
             "characters": [string],      // names from the bible
             "dialogue": [ {"character": string, "text": string, "language": string, "subtitle": string} ],   // spoken in this shot (may be empty)
             "seconds": number } ] }

STORY BIBLE:
{bible}

THIS SCENE (from the outline):
{scene}

HOW THE PREVIOUS SCENE ENDED:
{previous}

NEXT SCENE (so this one leads into it):
{next}

THE CREATOR'S DIRECTION FOR THIS SCENE (follow it exactly; where it differs from the outline, it wins):
{direction}
