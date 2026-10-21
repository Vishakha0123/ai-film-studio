# Character library portraits

One **AI-generated, photorealistic** portrait per character in `src/data/characterLibrary.json`, saved here as
`<ID>.webp` (1024×1536). The app shows a portrait only when its own file is here; a character
without one shows "Portrait not added yet". No drawings, avatars, stand-ins or stock photos.

## Generating them

Portraits are made by an image model through `npm run characters:generate` (in `frontend/`). It needs an API key:

```
# backend/.env  (or frontend/.env.local)
OPENAI_API_KEY=sk-...                 # required — platform.openai.com → API keys
CHARACTER_IMAGE_MODEL=gpt-image-1     # optional — a GPT Image model that can return WebP
CHARACTER_IMAGE_QUALITY=high          # optional — low | medium | high (higher costs more per image)
CHARACTER_NEGATIVE_PROMPT=...         # optional — replaces the default negative prompt below
```

```
npm run characters:generate -- --dry-run          # see exactly what will be sent (no calls, no files)
npm run characters:generate -- --only=CHR-0045    # one portrait first (Paati) to check the look
npm run characters:generate                       # every character still missing
npm run characters:generate -- --force --only=CHR-0007   # replace one you don't like
npm run characters:check                          # generated and verified / unverified / invalid / missing
```

Each image is checked before it's saved — a real WebP of the right size, not identical to another character's —
and recorded in `manifest.json` (model, time, checksum, prompt checksum). Files added by hand are reported as
**unverified**. Add another provider in `scripts/characters-generate.mjs` (`PROVIDERS`).

**Negative prompt** (what portraits must never look like): cartoon, illustration, drawing, sketch, anime, manga, comic, 3D render, CGI, video-game character, doll, plastic or waxy skin, airbrushed skin, painting, watercolor, digital art, avatar, emoji, caricature, distorted or asymmetric eyes, extra fingers, deformed face, text, watermark, logo, frame, collage, duplicate face

## Characters

| ID | File | Age | Group | Gender | Background | Portrait |
|---|---|---|---|---|---|---|
| CHR-0001 | `CHR-0001.webp` | 3 | Children | female | Tamil | — |
| CHR-0002 | `CHR-0002.webp` | 5 | Children | female | Kenyan | — |
| CHR-0003 | `CHR-0003.webp` | 7 | Children | female | Navajo | — |
| CHR-0004 | `CHR-0004.webp` | 9 | Children | female | Marathi | — |
| CHR-0005 | `CHR-0005.webp` | 11 | Children | female | Bengali | — |
| CHR-0006 | `CHR-0006.webp` | 13 | Teenagers | female | Italian | — |
| CHR-0007 | `CHR-0007.webp` | 15 | Teenagers | female | Vietnamese | — |
| CHR-0008 | `CHR-0008.webp` | 17 | Teenagers | female | Irish | — |
| CHR-0009 | `CHR-0009.webp` | 19 | Young adults | female | Jamaican | — |
| CHR-0010 | `CHR-0010.webp` | 22 | Young adults | female | Telugu | — |
| CHR-0011 | `CHR-0011.webp` | 26 | Young adults | female | Mexican | — |
| CHR-0012 | `CHR-0012.webp` | 29 | Young adults | female | Korean | — |
| CHR-0013 | `CHR-0013.webp` | 31 | Adults | female | Brazilian | — |
| CHR-0014 | `CHR-0014.webp` | 38 | Adults | female | Japanese | — |
| CHR-0015 | `CHR-0015.webp` | 45 | Adults | female | Malayali | — |
| CHR-0016 | `CHR-0016.webp` | 52 | Adults | female | Ethiopian | — |
| CHR-0017 | `CHR-0017.webp` | 58 | Adults | female | Nigerian | — |
| CHR-0018 | `CHR-0018.webp` | 62 | Seniors | female | Filipino | — |
| CHR-0019 | `CHR-0019.webp` | 68 | Seniors | female | Chinese | — |
| CHR-0020 | `CHR-0020.webp` | 75 | Seniors | female | Punjabi | — |
| CHR-0021 | `CHR-0021.webp` | 83 | Seniors | female | Lebanese | — |
| CHR-0022 | `CHR-0022.webp` | 92 | Seniors | female | Gujarati | — |
| CHR-0023 | `CHR-0023.webp` | 4 | Children | male | Korean | — |
| CHR-0024 | `CHR-0024.webp` | 6 | Children | male | Brazilian | — |
| CHR-0025 | `CHR-0025.webp` | 8 | Children | male | Japanese | — |
| CHR-0026 | `CHR-0026.webp` | 10 | Children | male | Malayali | — |
| CHR-0027 | `CHR-0027.webp` | 12 | Children | male | Ethiopian | — |
| CHR-0028 | `CHR-0028.webp` | 14 | Teenagers | male | Nigerian | — |
| CHR-0029 | `CHR-0029.webp` | 16 | Teenagers | male | Filipino | — |
| CHR-0030 | `CHR-0030.webp` | 17 | Teenagers | male | Chinese | — |
| CHR-0031 | `CHR-0031.webp` | 18 | Young adults | male | Punjabi | — |
| CHR-0032 | `CHR-0032.webp` | 21 | Young adults | male | Lebanese | — |
| CHR-0033 | `CHR-0033.webp` | 24 | Young adults | male | Gujarati | — |
| CHR-0034 | `CHR-0034.webp` | 28 | Young adults | male | Tamil | — |
| CHR-0035 | `CHR-0035.webp` | 33 | Adults | male | Kenyan | — |
| CHR-0036 | `CHR-0036.webp` | 40 | Adults | male | Navajo | — |
| CHR-0037 | `CHR-0037.webp` | 47 | Adults | male | Marathi | — |
| CHR-0038 | `CHR-0038.webp` | 55 | Adults | male | Bengali | — |
| CHR-0039 | `CHR-0039.webp` | 59 | Adults | male | Italian | — |
| CHR-0040 | `CHR-0040.webp` | 61 | Seniors | male | Vietnamese | — |
| CHR-0041 | `CHR-0041.webp` | 66 | Seniors | male | Irish | — |
| CHR-0042 | `CHR-0042.webp` | 72 | Seniors | male | Jamaican | — |
| CHR-0043 | `CHR-0043.webp` | 80 | Seniors | male | Telugu | — |
| CHR-0044 | `CHR-0044.webp` | 90 | Seniors | male | Mexican | — |
| CHR-0045 | `CHR-0045.webp` | 78 | Seniors | female | Tamil (Paati) | — |

## Prompts

### CHR-0001 — 3, female, Tamil

`CHR-0001.webp`

> Photorealistic close-up portrait photograph of a 3-year-old Tamil girl. Brown skin tone, black hair in pigtails, dark brown eyes, freckles. Wearing a striped t-shirt. Age-appropriate child features: soft rounded face, small nose, baby-fine hair, small milk teeth. A unique, fictional person with their own distinct face, not a celebrity. Realistic facial anatomy with natural asymmetry, real skin texture with visible pores and fine vellus hair, believable individual hair strands, natural eyes with catchlights. Casting photograph for a live-action feature film: full-frame cinema camera, 85mm lens at f/2, soft window key light with gentle fill, natural colour grading, shallow depth of field, head and shoulders, softly blurred warm-grey background.

### CHR-0002 — 5, female, Kenyan

`CHR-0002.webp`

> Photorealistic close-up portrait photograph of a 5-year-old Kenyan girl. Dark skin tone, black tightly coiled hair with a headband, dark brown eyes, rosy cheeks. Wearing a cotton frock. Age-appropriate child features: soft rounded face, small nose, baby-fine hair, small milk teeth. A unique, fictional person with their own distinct face, not a celebrity. Realistic facial anatomy with natural asymmetry, real skin texture with visible pores and fine vellus hair, believable individual hair strands, natural eyes with catchlights. Casting photograph for a live-action feature film: full-frame cinema camera, 85mm lens at f/2, soft window key light with gentle fill, natural colour grading, shallow depth of field, head and shoulders, softly blurred warm-grey background.

### CHR-0003 — 7, female, Navajo

`CHR-0003.webp`

> Photorealistic close-up portrait photograph of a 7-year-old Navajo girl. Tan skin tone, black hair in pigtails, dark brown eyes, freckles. Wearing a yellow raincoat. Age-appropriate child features: soft rounded face, small nose, baby-fine hair, small milk teeth. A unique, fictional person with their own distinct face, not a celebrity. Realistic facial anatomy with natural asymmetry, real skin texture with visible pores and fine vellus hair, believable individual hair strands, natural eyes with catchlights. Casting photograph for a live-action feature film: full-frame cinema camera, 85mm lens at f/2, soft window key light with gentle fill, natural colour grading, shallow depth of field, head and shoulders, softly blurred warm-grey background.

### CHR-0004 — 9, female, Marathi

`CHR-0004.webp`

> Photorealistic close-up portrait photograph of a 9-year-old Marathi girl. Tan skin tone, black wavy hair with a headband, dark brown eyes, rosy cheeks. Wearing a hand-knit sweater. Age-appropriate child features: soft rounded face, small nose, baby-fine hair, small milk teeth. A unique, fictional person with their own distinct face, not a celebrity. Realistic facial anatomy with natural asymmetry, real skin texture with visible pores and fine vellus hair, believable individual hair strands, natural eyes with catchlights. Casting photograph for a live-action feature film: full-frame cinema camera, 85mm lens at f/2, soft window key light with gentle fill, natural colour grading, shallow depth of field, head and shoulders, softly blurred warm-grey background.

### CHR-0005 — 11, female, Bengali

`CHR-0005.webp`

> Photorealistic close-up portrait photograph of a 11-year-old Bengali girl. Tan skin tone, black hair in pigtails, dark brown eyes, freckles. Wearing a school uniform shirt. Age-appropriate child features: soft rounded face, small nose, baby-fine hair, small milk teeth. A unique, fictional person with their own distinct face, not a celebrity. Realistic facial anatomy with natural asymmetry, real skin texture with visible pores and fine vellus hair, believable individual hair strands, natural eyes with catchlights. Casting photograph for a live-action feature film: full-frame cinema camera, 85mm lens at f/2, soft window key light with gentle fill, natural colour grading, shallow depth of field, head and shoulders, softly blurred warm-grey background.

### CHR-0006 — 13, female, Italian

`CHR-0006.webp`

> Photorealistic close-up portrait photograph of a 13-year-old teenage Italian girl. Medium-light skin tone, wavy brown hair worn loose, hazel eyes, a thoughtful expression. Wearing a school uniform shirt. Age-appropriate teenage features: youthful skin with natural texture, still-maturing face. A unique, fictional person with their own distinct face, not a celebrity. Realistic facial anatomy with natural asymmetry, real skin texture with visible pores and fine vellus hair, believable individual hair strands, natural eyes with catchlights. Casting photograph for a live-action feature film: full-frame cinema camera, 85mm lens at f/2, soft window key light with gentle fill, natural colour grading, shallow depth of field, head and shoulders, softly blurred warm-grey background.

### CHR-0007 — 15, female, Vietnamese

`CHR-0007.webp`

> Photorealistic close-up portrait photograph of a 15-year-old teenage Vietnamese girl. Medium-light skin tone, long straight black hair, dark brown eyes, a confident look. Wearing a hoodie. Age-appropriate teenage features: youthful skin with natural texture, still-maturing face. A unique, fictional person with their own distinct face, not a celebrity. Realistic facial anatomy with natural asymmetry, real skin texture with visible pores and fine vellus hair, believable individual hair strands, natural eyes with catchlights. Casting photograph for a live-action feature film: full-frame cinema camera, 85mm lens at f/2, soft window key light with gentle fill, natural colour grading, shallow depth of field, head and shoulders, softly blurred warm-grey background.

### CHR-0008 — 17, female, Irish

`CHR-0008.webp`

> Photorealistic close-up portrait photograph of a 17-year-old teenage Irish girl. Light skin tone, wavy blonde hair worn loose, green eyes, a thoughtful expression. Wearing a graphic t-shirt. Age-appropriate teenage features: youthful skin with natural texture, still-maturing face. A unique, fictional person with their own distinct face, not a celebrity. Realistic facial anatomy with natural asymmetry, real skin texture with visible pores and fine vellus hair, believable individual hair strands, natural eyes with catchlights. Casting photograph for a live-action feature film: full-frame cinema camera, 85mm lens at f/2, soft window key light with gentle fill, natural colour grading, shallow depth of field, head and shoulders, softly blurred warm-grey background.

### CHR-0009 — 19, female, Jamaican

`CHR-0009.webp`

> Photorealistic close-up portrait photograph of a 19-year-old young Jamaican woman. Brown skin tone, a soft hijab, dark brown eyes, a calm expression. Wearing a plain black t-shirt. Age-appropriate young-adult features: smooth skin with natural texture and pores, defined jawline. A unique, fictional person with their own distinct face, not a celebrity. Realistic facial anatomy with natural asymmetry, real skin texture with visible pores and fine vellus hair, believable individual hair strands, natural eyes with catchlights. Casting photograph for a live-action feature film: full-frame cinema camera, 85mm lens at f/2, soft window key light with gentle fill, natural colour grading, shallow depth of field, head and shoulders, softly blurred warm-grey background.

### CHR-0010 — 22, female, Telugu

`CHR-0010.webp`

> Photorealistic close-up portrait photograph of a 22-year-old young Telugu woman. Brown skin tone, voluminous straight black hair, dark brown eyes, an easy smile, a small bindi. Wearing a cotton kurta. Age-appropriate young-adult features: smooth skin with natural texture and pores, defined jawline. A unique, fictional person with their own distinct face, not a celebrity. Realistic facial anatomy with natural asymmetry, real skin texture with visible pores and fine vellus hair, believable individual hair strands, natural eyes with catchlights. Casting photograph for a live-action feature film: full-frame cinema camera, 85mm lens at f/2, soft window key light with gentle fill, natural colour grading, shallow depth of field, head and shoulders, softly blurred warm-grey background.

### CHR-0011 — 26, female, Mexican

`CHR-0011.webp`

> Photorealistic close-up portrait photograph of a 26-year-old young Mexican woman. Tan skin tone, long wavy black hair, brown eyes, a calm expression. Wearing a denim jacket. Age-appropriate young-adult features: smooth skin with natural texture and pores, defined jawline. A unique, fictional person with their own distinct face, not a celebrity. Realistic facial anatomy with natural asymmetry, real skin texture with visible pores and fine vellus hair, believable individual hair strands, natural eyes with catchlights. Casting photograph for a live-action feature film: full-frame cinema camera, 85mm lens at f/2, soft window key light with gentle fill, natural colour grading, shallow depth of field, head and shoulders, softly blurred warm-grey background.

### CHR-0012 — 29, female, Korean

`CHR-0012.webp`

> Photorealistic close-up portrait photograph of a 29-year-old young Korean woman. Light skin tone, voluminous straight black hair, dark brown eyes, an easy smile. Wearing a linen shirt. Age-appropriate young-adult features: smooth skin with natural texture and pores, defined jawline. A unique, fictional person with their own distinct face, not a celebrity. Realistic facial anatomy with natural asymmetry, real skin texture with visible pores and fine vellus hair, believable individual hair strands, natural eyes with catchlights. Casting photograph for a live-action feature film: full-frame cinema camera, 85mm lens at f/2, soft window key light with gentle fill, natural colour grading, shallow depth of field, head and shoulders, softly blurred warm-grey background.

### CHR-0013 — 31, female, Brazilian

`CHR-0013.webp`

> Photorealistic close-up portrait photograph of a 31-year-old Brazilian woman. Medium skin tone, shoulder-length curly black hair, brown eyes, reading glasses. Wearing a knit cardigan. Age-appropriate adult features: early fine lines, laugh lines, mature bone structure. A unique, fictional person with their own distinct face, not a celebrity. Realistic facial anatomy with natural asymmetry, real skin texture with visible pores and fine vellus hair, believable individual hair strands, natural eyes with catchlights. Casting photograph for a live-action feature film: full-frame cinema camera, 85mm lens at f/2, soft window key light with gentle fill, natural colour grading, shallow depth of field, head and shoulders, softly blurred warm-grey background.

### CHR-0014 — 38, female, Japanese

`CHR-0014.webp`

> Photorealistic close-up portrait photograph of a 38-year-old Japanese woman. Light skin tone, a patterned headscarf, dark brown eyes, faint crow's feet. Wearing a collared shirt. Age-appropriate adult features: early fine lines, laugh lines, mature bone structure. A unique, fictional person with their own distinct face, not a celebrity. Realistic facial anatomy with natural asymmetry, real skin texture with visible pores and fine vellus hair, believable individual hair strands, natural eyes with catchlights. Casting photograph for a live-action feature film: full-frame cinema camera, 85mm lens at f/2, soft window key light with gentle fill, natural colour grading, shallow depth of field, head and shoulders, softly blurred warm-grey background.

### CHR-0015 — 45, female, Malayali

`CHR-0015.webp`

> Photorealistic close-up portrait photograph of a 45-year-old Malayali woman. Dark skin tone, shoulder-length curly black hair, dark brown eyes, reading glasses. Wearing a wool blazer. Age-appropriate adult features: early fine lines, laugh lines, mature bone structure. A unique, fictional person with their own distinct face, not a celebrity. Realistic facial anatomy with natural asymmetry, real skin texture with visible pores and fine vellus hair, believable individual hair strands, natural eyes with catchlights. Casting photograph for a live-action feature film: full-frame cinema camera, 85mm lens at f/2, soft window key light with gentle fill, natural colour grading, shallow depth of field, head and shoulders, softly blurred warm-grey background.

### CHR-0016 — 52, female, Ethiopian

`CHR-0016.webp`

> Photorealistic close-up portrait photograph of a 52-year-old Ethiopian woman. Brown skin tone, a patterned headscarf, dark brown eyes, faint crow's feet. Wearing a collared shirt. Age-appropriate adult features: early fine lines, laugh lines, mature bone structure. A unique, fictional person with their own distinct face, not a celebrity. Realistic facial anatomy with natural asymmetry, real skin texture with visible pores and fine vellus hair, believable individual hair strands, natural eyes with catchlights. Casting photograph for a live-action feature film: full-frame cinema camera, 85mm lens at f/2, soft window key light with gentle fill, natural colour grading, shallow depth of field, head and shoulders, softly blurred warm-grey background.

### CHR-0017 — 58, female, Nigerian

`CHR-0017.webp`

> Photorealistic close-up portrait photograph of a 58-year-old Nigerian woman. Dark skin tone, shoulder-length tightly coiled salt-and-pepper hair, dark brown eyes, reading glasses. Wearing a collared shirt. Age-appropriate adult features: early fine lines, laugh lines, mature bone structure. A unique, fictional person with their own distinct face, not a celebrity. Realistic facial anatomy with natural asymmetry, real skin texture with visible pores and fine vellus hair, believable individual hair strands, natural eyes with catchlights. Casting photograph for a live-action feature film: full-frame cinema camera, 85mm lens at f/2, soft window key light with gentle fill, natural colour grading, shallow depth of field, head and shoulders, softly blurred warm-grey background.

### CHR-0018 — 62, female, Filipino

`CHR-0018.webp`

> Photorealistic close-up portrait photograph of a 62-year-old elderly Filipino woman. Tan skin tone, long grey hair in a loose plait, brown eyes, age spots and kind eyes. Wearing a shawl over a sweater. Age-appropriate elderly features: natural deep wrinkles, crow's feet, age spots, softened jawline, expressive knowing eyes. A unique, fictional person with their own distinct face, not a celebrity. Realistic facial anatomy with natural asymmetry, real skin texture with visible pores and fine vellus hair, believable individual hair strands, natural eyes with catchlights. Casting photograph for a live-action feature film: full-frame cinema camera, 85mm lens at f/2, soft window key light with gentle fill, natural colour grading, shallow depth of field, head and shoulders, softly blurred warm-grey background.

### CHR-0019 — 68, female, Chinese

`CHR-0019.webp`

> Photorealistic close-up portrait photograph of a 68-year-old elderly Chinese woman. Medium-light skin tone, short grey hair, dark brown eyes, laugh wrinkles around the eyes. Wearing a tweed jacket. Age-appropriate elderly features: natural deep wrinkles, crow's feet, age spots, softened jawline, expressive knowing eyes. A unique, fictional person with their own distinct face, not a celebrity. Realistic facial anatomy with natural asymmetry, real skin texture with visible pores and fine vellus hair, believable individual hair strands, natural eyes with catchlights. Casting photograph for a live-action feature film: full-frame cinema camera, 85mm lens at f/2, soft window key light with gentle fill, natural colour grading, shallow depth of field, head and shoulders, softly blurred warm-grey background.

### CHR-0020 — 75, female, Punjabi

`CHR-0020.webp`

> Photorealistic close-up portrait photograph of a 75-year-old elderly Punjabi woman. Medium skin tone, long white hair in a loose plait, brown eyes, age spots and kind eyes, a small bindi. Wearing a white kurta. Age-appropriate elderly features: natural deep wrinkles, crow's feet, age spots, softened jawline, expressive knowing eyes. A unique, fictional person with their own distinct face, not a celebrity. Realistic facial anatomy with natural asymmetry, real skin texture with visible pores and fine vellus hair, believable individual hair strands, natural eyes with catchlights. Casting photograph for a live-action feature film: full-frame cinema camera, 85mm lens at f/2, soft window key light with gentle fill, natural colour grading, shallow depth of field, head and shoulders, softly blurred warm-grey background.

### CHR-0021 — 83, female, Lebanese

`CHR-0021.webp`

> Photorealistic close-up portrait photograph of a 83-year-old elderly Lebanese woman. Medium-light skin tone, short white hair, brown eyes, laugh wrinkles around the eyes. Wearing a wool cardigan. Age-appropriate elderly features: natural deep wrinkles, crow's feet, age spots, softened jawline, expressive knowing eyes. A unique, fictional person with their own distinct face, not a celebrity. Realistic facial anatomy with natural asymmetry, real skin texture with visible pores and fine vellus hair, believable individual hair strands, natural eyes with catchlights. Casting photograph for a live-action feature film: full-frame cinema camera, 85mm lens at f/2, soft window key light with gentle fill, natural colour grading, shallow depth of field, head and shoulders, softly blurred warm-grey background.

### CHR-0022 — 92, female, Gujarati

`CHR-0022.webp`

> Photorealistic close-up portrait photograph of a 92-year-old elderly Gujarati woman. Medium skin tone, long white hair in a loose plait, brown eyes, age spots and kind eyes, a small bindi. Wearing a wool cardigan. Age-appropriate elderly features: natural deep wrinkles, crow's feet, age spots, softened jawline, expressive knowing eyes. A unique, fictional person with their own distinct face, not a celebrity. Realistic facial anatomy with natural asymmetry, real skin texture with visible pores and fine vellus hair, believable individual hair strands, natural eyes with catchlights. Casting photograph for a live-action feature film: full-frame cinema camera, 85mm lens at f/2, soft window key light with gentle fill, natural colour grading, shallow depth of field, head and shoulders, softly blurred warm-grey background.

### CHR-0023 — 4, male, Korean

`CHR-0023.webp`

> Photorealistic close-up portrait photograph of a 4-year-old Korean boy. Light skin tone, neat side-parted black hair, dark brown eyes, rosy cheeks. Wearing a yellow raincoat. Age-appropriate child features: soft rounded face, small nose, baby-fine hair, small milk teeth. A unique, fictional person with their own distinct face, not a celebrity. Realistic facial anatomy with natural asymmetry, real skin texture with visible pores and fine vellus hair, believable individual hair strands, natural eyes with catchlights. Casting photograph for a live-action feature film: full-frame cinema camera, 85mm lens at f/2, soft window key light with gentle fill, natural colour grading, shallow depth of field, head and shoulders, softly blurred warm-grey background.

### CHR-0024 — 6, male, Brazilian

`CHR-0024.webp`

> Photorealistic close-up portrait photograph of a 6-year-old Brazilian boy. Medium skin tone, curly black hair, brown eyes, freckles. Wearing a yellow raincoat. Age-appropriate child features: soft rounded face, small nose, baby-fine hair, small milk teeth. A unique, fictional person with their own distinct face, not a celebrity. Realistic facial anatomy with natural asymmetry, real skin texture with visible pores and fine vellus hair, believable individual hair strands, natural eyes with catchlights. Casting photograph for a live-action feature film: full-frame cinema camera, 85mm lens at f/2, soft window key light with gentle fill, natural colour grading, shallow depth of field, head and shoulders, softly blurred warm-grey background.

### CHR-0025 — 8, male, Japanese

`CHR-0025.webp`

> Photorealistic close-up portrait photograph of a 8-year-old Japanese boy. Light skin tone, neat side-parted black hair, dark brown eyes, rosy cheeks. Wearing a yellow raincoat. Age-appropriate child features: soft rounded face, small nose, baby-fine hair, small milk teeth. A unique, fictional person with their own distinct face, not a celebrity. Realistic facial anatomy with natural asymmetry, real skin texture with visible pores and fine vellus hair, believable individual hair strands, natural eyes with catchlights. Casting photograph for a live-action feature film: full-frame cinema camera, 85mm lens at f/2, soft window key light with gentle fill, natural colour grading, shallow depth of field, head and shoulders, softly blurred warm-grey background.

### CHR-0026 — 10, male, Malayali

`CHR-0026.webp`

> Photorealistic close-up portrait photograph of a 10-year-old Malayali boy. Dark skin tone, curly black hair, dark brown eyes, freckles. Wearing a yellow raincoat. Age-appropriate child features: soft rounded face, small nose, baby-fine hair, small milk teeth. A unique, fictional person with their own distinct face, not a celebrity. Realistic facial anatomy with natural asymmetry, real skin texture with visible pores and fine vellus hair, believable individual hair strands, natural eyes with catchlights. Casting photograph for a live-action feature film: full-frame cinema camera, 85mm lens at f/2, soft window key light with gentle fill, natural colour grading, shallow depth of field, head and shoulders, softly blurred warm-grey background.

### CHR-0027 — 12, male, Ethiopian

`CHR-0027.webp`

> Photorealistic close-up portrait photograph of a 12-year-old Ethiopian boy. Brown skin tone, neat side-parted black hair, dark brown eyes, rosy cheeks. Wearing a yellow raincoat. Age-appropriate child features: soft rounded face, small nose, baby-fine hair, small milk teeth. A unique, fictional person with their own distinct face, not a celebrity. Realistic facial anatomy with natural asymmetry, real skin texture with visible pores and fine vellus hair, believable individual hair strands, natural eyes with catchlights. Casting photograph for a live-action feature film: full-frame cinema camera, 85mm lens at f/2, soft window key light with gentle fill, natural colour grading, shallow depth of field, head and shoulders, softly blurred warm-grey background.

### CHR-0028 — 14, male, Nigerian

`CHR-0028.webp`

> Photorealistic close-up portrait photograph of a 14-year-old teenage Nigerian boy. Dark skin tone, tightly coiled black hair, dark brown eyes, a confident look. Wearing a graphic t-shirt. Age-appropriate teenage features: youthful skin with natural texture, still-maturing face. A unique, fictional person with their own distinct face, not a celebrity. Realistic facial anatomy with natural asymmetry, real skin texture with visible pores and fine vellus hair, believable individual hair strands, natural eyes with catchlights. Casting photograph for a live-action feature film: full-frame cinema camera, 85mm lens at f/2, soft window key light with gentle fill, natural colour grading, shallow depth of field, head and shoulders, softly blurred warm-grey background.

### CHR-0029 — 16, male, Filipino

`CHR-0029.webp`

> Photorealistic close-up portrait photograph of a 16-year-old teenage Filipino boy. Tan skin tone, a black fade haircut, brown eyes, a thoughtful expression. Wearing a denim jacket. Age-appropriate teenage features: youthful skin with natural texture, still-maturing face. A unique, fictional person with their own distinct face, not a celebrity. Realistic facial anatomy with natural asymmetry, real skin texture with visible pores and fine vellus hair, believable individual hair strands, natural eyes with catchlights. Casting photograph for a live-action feature film: full-frame cinema camera, 85mm lens at f/2, soft window key light with gentle fill, natural colour grading, shallow depth of field, head and shoulders, softly blurred warm-grey background.

### CHR-0030 — 17, male, Chinese

`CHR-0030.webp`

> Photorealistic close-up portrait photograph of a 17-year-old teenage Chinese boy. Medium-light skin tone, straight black hair, dark brown eyes, a confident look. Wearing a school uniform shirt. Age-appropriate teenage features: youthful skin with natural texture, still-maturing face. A unique, fictional person with their own distinct face, not a celebrity. Realistic facial anatomy with natural asymmetry, real skin texture with visible pores and fine vellus hair, believable individual hair strands, natural eyes with catchlights. Casting photograph for a live-action feature film: full-frame cinema camera, 85mm lens at f/2, soft window key light with gentle fill, natural colour grading, shallow depth of field, head and shoulders, softly blurred warm-grey background.

### CHR-0031 — 18, male, Punjabi

`CHR-0031.webp`

> Photorealistic close-up portrait photograph of a 18-year-old young Punjabi man. Medium skin tone, black hair tied back, brown eyes, an easy smile. Wearing a plain black t-shirt. Age-appropriate young-adult features: smooth skin with natural texture and pores, defined jawline. A unique, fictional person with their own distinct face, not a celebrity. Realistic facial anatomy with natural asymmetry, real skin texture with visible pores and fine vellus hair, believable individual hair strands, natural eyes with catchlights. Casting photograph for a live-action feature film: full-frame cinema camera, 85mm lens at f/2, soft window key light with gentle fill, natural colour grading, shallow depth of field, head and shoulders, softly blurred warm-grey background.

### CHR-0032 — 21, male, Lebanese

`CHR-0032.webp`

> Photorealistic close-up portrait photograph of a 21-year-old young Lebanese man. Medium-light skin tone, short black hair, brown eyes, a calm expression. Wearing a plain black t-shirt. Age-appropriate young-adult features: smooth skin with natural texture and pores, defined jawline. A unique, fictional person with their own distinct face, not a celebrity. Realistic facial anatomy with natural asymmetry, real skin texture with visible pores and fine vellus hair, believable individual hair strands, natural eyes with catchlights. Casting photograph for a live-action feature film: full-frame cinema camera, 85mm lens at f/2, soft window key light with gentle fill, natural colour grading, shallow depth of field, head and shoulders, softly blurred warm-grey background.

### CHR-0033 — 24, male, Gujarati

`CHR-0033.webp`

> Photorealistic close-up portrait photograph of a 24-year-old young Gujarati man. Medium skin tone, black hair tied back, brown eyes, an easy smile. Wearing a plain black t-shirt. Age-appropriate young-adult features: smooth skin with natural texture and pores, defined jawline. A unique, fictional person with their own distinct face, not a celebrity. Realistic facial anatomy with natural asymmetry, real skin texture with visible pores and fine vellus hair, believable individual hair strands, natural eyes with catchlights. Casting photograph for a live-action feature film: full-frame cinema camera, 85mm lens at f/2, soft window key light with gentle fill, natural colour grading, shallow depth of field, head and shoulders, softly blurred warm-grey background.

### CHR-0034 — 28, male, Tamil

`CHR-0034.webp`

> Photorealistic close-up portrait photograph of a 28-year-old young Tamil man. Brown skin tone, a turban, dark brown eyes, a calm expression. Wearing a plain black t-shirt. Age-appropriate young-adult features: smooth skin with natural texture and pores, defined jawline. A unique, fictional person with their own distinct face, not a celebrity. Realistic facial anatomy with natural asymmetry, real skin texture with visible pores and fine vellus hair, believable individual hair strands, natural eyes with catchlights. Casting photograph for a live-action feature film: full-frame cinema camera, 85mm lens at f/2, soft window key light with gentle fill, natural colour grading, shallow depth of field, head and shoulders, softly blurred warm-grey background.

### CHR-0035 — 33, male, Kenyan

`CHR-0035.webp`

> Photorealistic close-up portrait photograph of a 33-year-old Kenyan man. Dark skin tone, close-cropped tightly coiled black hair, dark brown eyes, faint crow's feet, a full beard. Wearing a knit cardigan. Age-appropriate adult features: early fine lines, laugh lines, mature bone structure. A unique, fictional person with their own distinct face, not a celebrity. Realistic facial anatomy with natural asymmetry, real skin texture with visible pores and fine vellus hair, believable individual hair strands, natural eyes with catchlights. Casting photograph for a live-action feature film: full-frame cinema camera, 85mm lens at f/2, soft window key light with gentle fill, natural colour grading, shallow depth of field, head and shoulders, softly blurred warm-grey background.

### CHR-0036 — 40, male, Navajo

`CHR-0036.webp`

> Photorealistic close-up portrait photograph of a 40-year-old Navajo man. Tan skin tone, a shaved head, dark brown eyes, reading glasses. Wearing a knit cardigan. Age-appropriate adult features: early fine lines, laugh lines, mature bone structure. A unique, fictional person with their own distinct face, not a celebrity. Realistic facial anatomy with natural asymmetry, real skin texture with visible pores and fine vellus hair, believable individual hair strands, natural eyes with catchlights. Casting photograph for a live-action feature film: full-frame cinema camera, 85mm lens at f/2, soft window key light with gentle fill, natural colour grading, shallow depth of field, head and shoulders, softly blurred warm-grey background.

### CHR-0037 — 47, male, Marathi

`CHR-0037.webp`

> Photorealistic close-up portrait photograph of a 47-year-old Marathi man. Tan skin tone, close-cropped wavy black hair, dark brown eyes, faint crow's feet, a full beard. Wearing a knit cardigan. Age-appropriate adult features: early fine lines, laugh lines, mature bone structure. A unique, fictional person with their own distinct face, not a celebrity. Realistic facial anatomy with natural asymmetry, real skin texture with visible pores and fine vellus hair, believable individual hair strands, natural eyes with catchlights. Casting photograph for a live-action feature film: full-frame cinema camera, 85mm lens at f/2, soft window key light with gentle fill, natural colour grading, shallow depth of field, head and shoulders, softly blurred warm-grey background.

### CHR-0038 — 55, male, Bengali

`CHR-0038.webp`

> Photorealistic close-up portrait photograph of a 55-year-old Bengali man. Tan skin tone, a shaved head, dark brown eyes, reading glasses. Wearing a knit cardigan. Age-appropriate adult features: early fine lines, laugh lines, mature bone structure. A unique, fictional person with their own distinct face, not a celebrity. Realistic facial anatomy with natural asymmetry, real skin texture with visible pores and fine vellus hair, believable individual hair strands, natural eyes with catchlights. Casting photograph for a live-action feature film: full-frame cinema camera, 85mm lens at f/2, soft window key light with gentle fill, natural colour grading, shallow depth of field, head and shoulders, softly blurred warm-grey background.

### CHR-0039 — 59, male, Italian

`CHR-0039.webp`

> Photorealistic close-up portrait photograph of a 59-year-old Italian man. Medium-light skin tone, close-cropped wavy salt-and-pepper hair, hazel eyes, faint crow's feet, a full beard. Wearing a knit cardigan. Age-appropriate adult features: early fine lines, laugh lines, mature bone structure. A unique, fictional person with their own distinct face, not a celebrity. Realistic facial anatomy with natural asymmetry, real skin texture with visible pores and fine vellus hair, believable individual hair strands, natural eyes with catchlights. Casting photograph for a live-action feature film: full-frame cinema camera, 85mm lens at f/2, soft window key light with gentle fill, natural colour grading, shallow depth of field, head and shoulders, softly blurred warm-grey background.

### CHR-0040 — 61, male, Vietnamese

`CHR-0040.webp`

> Photorealistic close-up portrait photograph of a 61-year-old elderly Vietnamese man. Medium-light skin tone, thinning grey hair, dark brown eyes, laugh wrinkles around the eyes. Wearing a shawl over a sweater. Age-appropriate elderly features: natural deep wrinkles, crow's feet, age spots, softened jawline, expressive knowing eyes. A unique, fictional person with their own distinct face, not a celebrity. Realistic facial anatomy with natural asymmetry, real skin texture with visible pores and fine vellus hair, believable individual hair strands, natural eyes with catchlights. Casting photograph for a live-action feature film: full-frame cinema camera, 85mm lens at f/2, soft window key light with gentle fill, natural colour grading, shallow depth of field, head and shoulders, softly blurred warm-grey background.

### CHR-0041 — 66, male, Irish

`CHR-0041.webp`

> Photorealistic close-up portrait photograph of a 66-year-old elderly Irish man. Light skin tone, short grey hair combed back, green eyes, age spots and kind eyes, a white moustache. Wearing a shawl over a sweater. Age-appropriate elderly features: natural deep wrinkles, crow's feet, age spots, softened jawline, expressive knowing eyes. A unique, fictional person with their own distinct face, not a celebrity. Realistic facial anatomy with natural asymmetry, real skin texture with visible pores and fine vellus hair, believable individual hair strands, natural eyes with catchlights. Casting photograph for a live-action feature film: full-frame cinema camera, 85mm lens at f/2, soft window key light with gentle fill, natural colour grading, shallow depth of field, head and shoulders, softly blurred warm-grey background.

### CHR-0042 — 72, male, Jamaican

`CHR-0042.webp`

> Photorealistic close-up portrait photograph of a 72-year-old elderly Jamaican man. Brown skin tone, thinning grey hair, dark brown eyes, laugh wrinkles around the eyes. Wearing a shawl over a sweater. Age-appropriate elderly features: natural deep wrinkles, crow's feet, age spots, softened jawline, expressive knowing eyes. A unique, fictional person with their own distinct face, not a celebrity. Realistic facial anatomy with natural asymmetry, real skin texture with visible pores and fine vellus hair, believable individual hair strands, natural eyes with catchlights. Casting photograph for a live-action feature film: full-frame cinema camera, 85mm lens at f/2, soft window key light with gentle fill, natural colour grading, shallow depth of field, head and shoulders, softly blurred warm-grey background.

### CHR-0043 — 80, male, Telugu

`CHR-0043.webp`

> Photorealistic close-up portrait photograph of a 80-year-old elderly Telugu man. Brown skin tone, short white hair combed back, dark brown eyes, age spots and kind eyes, a white moustache. Wearing a shawl over a sweater. Age-appropriate elderly features: natural deep wrinkles, crow's feet, age spots, softened jawline, expressive knowing eyes. A unique, fictional person with their own distinct face, not a celebrity. Realistic facial anatomy with natural asymmetry, real skin texture with visible pores and fine vellus hair, believable individual hair strands, natural eyes with catchlights. Casting photograph for a live-action feature film: full-frame cinema camera, 85mm lens at f/2, soft window key light with gentle fill, natural colour grading, shallow depth of field, head and shoulders, softly blurred warm-grey background.

### CHR-0044 — 90, male, Mexican

`CHR-0044.webp`

> Photorealistic close-up portrait photograph of a 90-year-old elderly Mexican man. Tan skin tone, thinning white hair, brown eyes, laugh wrinkles around the eyes. Wearing a shawl over a sweater. Age-appropriate elderly features: natural deep wrinkles, crow's feet, age spots, softened jawline, expressive knowing eyes. A unique, fictional person with their own distinct face, not a celebrity. Realistic facial anatomy with natural asymmetry, real skin texture with visible pores and fine vellus hair, believable individual hair strands, natural eyes with catchlights. Casting photograph for a live-action feature film: full-frame cinema camera, 85mm lens at f/2, soft window key light with gentle fill, natural colour grading, shallow depth of field, head and shoulders, softly blurred warm-grey background.

### CHR-0045 — 78, female, Tamil — Paati

`CHR-0045.webp`

> Photorealistic close-up portrait photograph of a 78-year-old elderly Tamil woman named Paati. Brown skin tone, silver hair pulled back into a neat bun, dark brown eyes, natural wrinkles, expressive eyes, a small gold nose stud. Wearing a white cotton saree with a checked border. Role: Grandmother who rules the family kitchen. Expression shows: Sharp-tongued and loving, secretly sentimental, the heart of the house. Age-appropriate elderly features: natural deep wrinkles, crow's feet, age spots, softened jawline, expressive knowing eyes. A unique, fictional person with their own distinct face, not a celebrity. Realistic facial anatomy with natural asymmetry, real skin texture with visible pores and fine vellus hair, believable individual hair strands, natural eyes with catchlights. Casting photograph for a live-action feature film: full-frame cinema camera, 85mm lens at f/2, soft window key light with gentle fill, natural colour grading, shallow depth of field, head and shoulders, softly blurred warm-grey background.
