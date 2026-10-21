# Reference portraits (10 files)

Each character in a film automatically gets the closest of these portraits for their age and gender. The app
shows it as the character's picture until an AI portrait is generated, and the image model receives it as a
visual reference when one is generated. Nobody picks portraits by hand.

Put exactly these files here (`.webp`, `.jpg`, `.jpeg` or `.png`):

| File | Used for |
|---|---|
| `female-child.webp`  | girls under 13 |
| `female-teen.webp`   | girls 13–19 |
| `female-young.webp`  | women 20–34 |
| `female-adult.webp`  | women 35–54 |
| `female-senior.webp` | women 55+ |
| `male-child.webp`    | boys under 13 |
| `male-teen.webp`     | boys 13–19 |
| `male-young.webp`    | men 20–34 |
| `male-adult.webp`    | men 35–54 |
| `male-senior.webp`   | men 55+ |

- Use photorealistic portraits (head and shoulders), one different person per file.
- Matching: same gender → same age group → nearest age. A missing file falls back to the nearest available one;
  with none, characters simply have no picture (planning is never blocked).
- No age in the prompt → treated as an adult (35). No gender → read from the description ("grandmother", "his"…),
  otherwise a stable pick per character.
- Ages written in the prompt for named characters ("Paati, a 78-year-old grandmother") are kept exactly.
- Check which files are present: `python -m app.services.reference_portraits` (in `backend/`).
- Another folder: set `REFERENCE_PORTRAITS_DIR` in `backend/.env`.
