# Character library portraits

One AI-generated portrait per character in `src/data/characterLibrary.json`. Save each image here with the
character's file name (e.g. `CHR-0007.webp`); the Character library picks it up automatically — no code change.

- **Format:** webp, 768×1024 (3:4, head and shoulders). JPG/PNG/AVIF also work if the file name in the data matches.
- **One image per character.** Never reuse an image for two characters, and don't add stand-in pictures: a character
  without a file shows "Portrait not added yet" in the app.
- **Ages are matched from the data, not the file name** — if a portrait looks older or younger than the character's
  age, change the image (or the age in the data), not the name.
- Check what's present or missing: `npm run characters:check` (add `-- --prompts` for the missing prompts).

## Characters

| ID | File | Age | Group | Gender | Background | Present |
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

## Prompts

### CHR-0001 — 3, female, Tamil

`CHR-0001.webp`

> Photorealistic studio portrait photograph of a 3-year-old Tamil girl, brown skin, black hair in pigtails, dark brown eyes, freckles, wearing a striped t-shirt. Head and shoulders, looking at the camera, soft natural window light, plain warm-grey background, 85mm lens, sharp focus on the eyes, natural skin texture. A real-looking person: not a cartoon, not an illustration, not 3D, no text, no watermark.

### CHR-0002 — 5, female, Kenyan

`CHR-0002.webp`

> Photorealistic studio portrait photograph of a 5-year-old Kenyan girl, dark skin, black tightly coiled hair with a headband, dark brown eyes, rosy cheeks, wearing a cotton frock. Head and shoulders, looking at the camera, soft natural window light, plain warm-grey background, 85mm lens, sharp focus on the eyes, natural skin texture. A real-looking person: not a cartoon, not an illustration, not 3D, no text, no watermark.

### CHR-0003 — 7, female, Navajo

`CHR-0003.webp`

> Photorealistic studio portrait photograph of a 7-year-old Navajo girl, tan skin, black hair in pigtails, dark brown eyes, freckles, wearing a yellow raincoat. Head and shoulders, looking at the camera, soft natural window light, plain warm-grey background, 85mm lens, sharp focus on the eyes, natural skin texture. A real-looking person: not a cartoon, not an illustration, not 3D, no text, no watermark.

### CHR-0004 — 9, female, Marathi

`CHR-0004.webp`

> Photorealistic studio portrait photograph of a 9-year-old Marathi girl, tan skin, black wavy hair with a headband, dark brown eyes, rosy cheeks, wearing a hand-knit sweater. Head and shoulders, looking at the camera, soft natural window light, plain warm-grey background, 85mm lens, sharp focus on the eyes, natural skin texture. A real-looking person: not a cartoon, not an illustration, not 3D, no text, no watermark.

### CHR-0005 — 11, female, Bengali

`CHR-0005.webp`

> Photorealistic studio portrait photograph of a 11-year-old Bengali girl, tan skin, black hair in pigtails, dark brown eyes, freckles, wearing a school uniform shirt. Head and shoulders, looking at the camera, soft natural window light, plain warm-grey background, 85mm lens, sharp focus on the eyes, natural skin texture. A real-looking person: not a cartoon, not an illustration, not 3D, no text, no watermark.

### CHR-0006 — 13, female, Italian

`CHR-0006.webp`

> Photorealistic studio portrait photograph of a 13-year-old Italian teenage girl, medium-light skin, wavy brown hair worn loose, hazel eyes, a thoughtful expression, wearing a school uniform shirt. Head and shoulders, looking at the camera, soft natural window light, plain warm-grey background, 85mm lens, sharp focus on the eyes, natural skin texture. A real-looking person: not a cartoon, not an illustration, not 3D, no text, no watermark.

### CHR-0007 — 15, female, Vietnamese

`CHR-0007.webp`

> Photorealistic studio portrait photograph of a 15-year-old Vietnamese teenage girl, medium-light skin, long straight black hair, dark brown eyes, a confident look, wearing a hoodie. Head and shoulders, looking at the camera, soft natural window light, plain warm-grey background, 85mm lens, sharp focus on the eyes, natural skin texture. A real-looking person: not a cartoon, not an illustration, not 3D, no text, no watermark.

### CHR-0008 — 17, female, Irish

`CHR-0008.webp`

> Photorealistic studio portrait photograph of a 17-year-old Irish teenage girl, light skin, wavy blonde hair worn loose, green eyes, a thoughtful expression, wearing a graphic t-shirt. Head and shoulders, looking at the camera, soft natural window light, plain warm-grey background, 85mm lens, sharp focus on the eyes, natural skin texture. A real-looking person: not a cartoon, not an illustration, not 3D, no text, no watermark.

### CHR-0009 — 19, female, Jamaican

`CHR-0009.webp`

> Photorealistic studio portrait photograph of a 19-year-old Jamaican young woman, brown skin, a soft hijab, dark brown eyes, a calm expression, wearing a plain black t-shirt. Head and shoulders, looking at the camera, soft natural window light, plain warm-grey background, 85mm lens, sharp focus on the eyes, natural skin texture. A real-looking person: not a cartoon, not an illustration, not 3D, no text, no watermark.

### CHR-0010 — 22, female, Telugu

`CHR-0010.webp`

> Photorealistic studio portrait photograph of a 22-year-old Telugu young woman, brown skin, voluminous straight black hair, dark brown eyes, an easy smile, a small bindi, wearing a cotton kurta. Head and shoulders, looking at the camera, soft natural window light, plain warm-grey background, 85mm lens, sharp focus on the eyes, natural skin texture. A real-looking person: not a cartoon, not an illustration, not 3D, no text, no watermark.

### CHR-0011 — 26, female, Mexican

`CHR-0011.webp`

> Photorealistic studio portrait photograph of a 26-year-old Mexican young woman, tan skin, long wavy black hair, brown eyes, a calm expression, wearing a denim jacket. Head and shoulders, looking at the camera, soft natural window light, plain warm-grey background, 85mm lens, sharp focus on the eyes, natural skin texture. A real-looking person: not a cartoon, not an illustration, not 3D, no text, no watermark.

### CHR-0012 — 29, female, Korean

`CHR-0012.webp`

> Photorealistic studio portrait photograph of a 29-year-old Korean young woman, light skin, voluminous straight black hair, dark brown eyes, an easy smile, wearing a linen shirt. Head and shoulders, looking at the camera, soft natural window light, plain warm-grey background, 85mm lens, sharp focus on the eyes, natural skin texture. A real-looking person: not a cartoon, not an illustration, not 3D, no text, no watermark.

### CHR-0013 — 31, female, Brazilian

`CHR-0013.webp`

> Photorealistic studio portrait photograph of a 31-year-old Brazilian woman, medium skin, shoulder-length curly black hair, brown eyes, reading glasses, wearing a knit cardigan. Head and shoulders, looking at the camera, soft natural window light, plain warm-grey background, 85mm lens, sharp focus on the eyes, natural skin texture. A real-looking person: not a cartoon, not an illustration, not 3D, no text, no watermark.

### CHR-0014 — 38, female, Japanese

`CHR-0014.webp`

> Photorealistic studio portrait photograph of a 38-year-old Japanese woman, light skin, a patterned headscarf, dark brown eyes, faint crow's feet, wearing a collared shirt. Head and shoulders, looking at the camera, soft natural window light, plain warm-grey background, 85mm lens, sharp focus on the eyes, natural skin texture. A real-looking person: not a cartoon, not an illustration, not 3D, no text, no watermark.

### CHR-0015 — 45, female, Malayali

`CHR-0015.webp`

> Photorealistic studio portrait photograph of a 45-year-old Malayali woman, dark skin, shoulder-length curly black hair, dark brown eyes, reading glasses, wearing a wool blazer. Head and shoulders, looking at the camera, soft natural window light, plain warm-grey background, 85mm lens, sharp focus on the eyes, natural skin texture. A real-looking person: not a cartoon, not an illustration, not 3D, no text, no watermark.

### CHR-0016 — 52, female, Ethiopian

`CHR-0016.webp`

> Photorealistic studio portrait photograph of a 52-year-old Ethiopian woman, brown skin, a patterned headscarf, dark brown eyes, faint crow's feet, wearing a collared shirt. Head and shoulders, looking at the camera, soft natural window light, plain warm-grey background, 85mm lens, sharp focus on the eyes, natural skin texture. A real-looking person: not a cartoon, not an illustration, not 3D, no text, no watermark.

### CHR-0017 — 58, female, Nigerian

`CHR-0017.webp`

> Photorealistic studio portrait photograph of a 58-year-old Nigerian woman, dark skin, shoulder-length tightly coiled salt-and-pepper hair, dark brown eyes, reading glasses, wearing a collared shirt. Head and shoulders, looking at the camera, soft natural window light, plain warm-grey background, 85mm lens, sharp focus on the eyes, natural skin texture. A real-looking person: not a cartoon, not an illustration, not 3D, no text, no watermark.

### CHR-0018 — 62, female, Filipino

`CHR-0018.webp`

> Photorealistic studio portrait photograph of a 62-year-old Filipino elderly woman, tan skin, long grey hair in a loose plait, brown eyes, age spots and kind eyes, wearing a shawl over a sweater. Head and shoulders, looking at the camera, soft natural window light, plain warm-grey background, 85mm lens, sharp focus on the eyes, natural skin texture. A real-looking person: not a cartoon, not an illustration, not 3D, no text, no watermark.

### CHR-0019 — 68, female, Chinese

`CHR-0019.webp`

> Photorealistic studio portrait photograph of a 68-year-old Chinese elderly woman, medium-light skin, short grey hair, dark brown eyes, laugh wrinkles around the eyes, wearing a tweed jacket. Head and shoulders, looking at the camera, soft natural window light, plain warm-grey background, 85mm lens, sharp focus on the eyes, natural skin texture. A real-looking person: not a cartoon, not an illustration, not 3D, no text, no watermark.

### CHR-0020 — 75, female, Punjabi

`CHR-0020.webp`

> Photorealistic studio portrait photograph of a 75-year-old Punjabi elderly woman, medium skin, long white hair in a loose plait, brown eyes, age spots and kind eyes, a small bindi, wearing a white kurta. Head and shoulders, looking at the camera, soft natural window light, plain warm-grey background, 85mm lens, sharp focus on the eyes, natural skin texture. A real-looking person: not a cartoon, not an illustration, not 3D, no text, no watermark.

### CHR-0021 — 83, female, Lebanese

`CHR-0021.webp`

> Photorealistic studio portrait photograph of a 83-year-old Lebanese elderly woman, medium-light skin, short white hair, brown eyes, laugh wrinkles around the eyes, wearing a wool cardigan. Head and shoulders, looking at the camera, soft natural window light, plain warm-grey background, 85mm lens, sharp focus on the eyes, natural skin texture. A real-looking person: not a cartoon, not an illustration, not 3D, no text, no watermark.

### CHR-0022 — 92, female, Gujarati

`CHR-0022.webp`

> Photorealistic studio portrait photograph of a 92-year-old Gujarati elderly woman, medium skin, long white hair in a loose plait, brown eyes, age spots and kind eyes, a small bindi, wearing a wool cardigan. Head and shoulders, looking at the camera, soft natural window light, plain warm-grey background, 85mm lens, sharp focus on the eyes, natural skin texture. A real-looking person: not a cartoon, not an illustration, not 3D, no text, no watermark.

### CHR-0023 — 4, male, Korean

`CHR-0023.webp`

> Photorealistic studio portrait photograph of a 4-year-old Korean boy, light skin, neat side-parted black hair, dark brown eyes, rosy cheeks, wearing a yellow raincoat. Head and shoulders, looking at the camera, soft natural window light, plain warm-grey background, 85mm lens, sharp focus on the eyes, natural skin texture. A real-looking person: not a cartoon, not an illustration, not 3D, no text, no watermark.

### CHR-0024 — 6, male, Brazilian

`CHR-0024.webp`

> Photorealistic studio portrait photograph of a 6-year-old Brazilian boy, medium skin, curly black hair, brown eyes, freckles, wearing a yellow raincoat. Head and shoulders, looking at the camera, soft natural window light, plain warm-grey background, 85mm lens, sharp focus on the eyes, natural skin texture. A real-looking person: not a cartoon, not an illustration, not 3D, no text, no watermark.

### CHR-0025 — 8, male, Japanese

`CHR-0025.webp`

> Photorealistic studio portrait photograph of a 8-year-old Japanese boy, light skin, neat side-parted black hair, dark brown eyes, rosy cheeks, wearing a yellow raincoat. Head and shoulders, looking at the camera, soft natural window light, plain warm-grey background, 85mm lens, sharp focus on the eyes, natural skin texture. A real-looking person: not a cartoon, not an illustration, not 3D, no text, no watermark.

### CHR-0026 — 10, male, Malayali

`CHR-0026.webp`

> Photorealistic studio portrait photograph of a 10-year-old Malayali boy, dark skin, curly black hair, dark brown eyes, freckles, wearing a yellow raincoat. Head and shoulders, looking at the camera, soft natural window light, plain warm-grey background, 85mm lens, sharp focus on the eyes, natural skin texture. A real-looking person: not a cartoon, not an illustration, not 3D, no text, no watermark.

### CHR-0027 — 12, male, Ethiopian

`CHR-0027.webp`

> Photorealistic studio portrait photograph of a 12-year-old Ethiopian boy, brown skin, neat side-parted black hair, dark brown eyes, rosy cheeks, wearing a yellow raincoat. Head and shoulders, looking at the camera, soft natural window light, plain warm-grey background, 85mm lens, sharp focus on the eyes, natural skin texture. A real-looking person: not a cartoon, not an illustration, not 3D, no text, no watermark.

### CHR-0028 — 14, male, Nigerian

`CHR-0028.webp`

> Photorealistic studio portrait photograph of a 14-year-old Nigerian teenage boy, dark skin, tightly coiled black hair, dark brown eyes, a confident look, wearing a graphic t-shirt. Head and shoulders, looking at the camera, soft natural window light, plain warm-grey background, 85mm lens, sharp focus on the eyes, natural skin texture. A real-looking person: not a cartoon, not an illustration, not 3D, no text, no watermark.

### CHR-0029 — 16, male, Filipino

`CHR-0029.webp`

> Photorealistic studio portrait photograph of a 16-year-old Filipino teenage boy, tan skin, a black fade haircut, brown eyes, a thoughtful expression, wearing a denim jacket. Head and shoulders, looking at the camera, soft natural window light, plain warm-grey background, 85mm lens, sharp focus on the eyes, natural skin texture. A real-looking person: not a cartoon, not an illustration, not 3D, no text, no watermark.

### CHR-0030 — 17, male, Chinese

`CHR-0030.webp`

> Photorealistic studio portrait photograph of a 17-year-old Chinese teenage boy, medium-light skin, straight black hair, dark brown eyes, a confident look, wearing a school uniform shirt. Head and shoulders, looking at the camera, soft natural window light, plain warm-grey background, 85mm lens, sharp focus on the eyes, natural skin texture. A real-looking person: not a cartoon, not an illustration, not 3D, no text, no watermark.

### CHR-0031 — 18, male, Punjabi

`CHR-0031.webp`

> Photorealistic studio portrait photograph of a 18-year-old Punjabi young man, medium skin, black hair tied back, brown eyes, an easy smile, wearing a plain black t-shirt. Head and shoulders, looking at the camera, soft natural window light, plain warm-grey background, 85mm lens, sharp focus on the eyes, natural skin texture. A real-looking person: not a cartoon, not an illustration, not 3D, no text, no watermark.

### CHR-0032 — 21, male, Lebanese

`CHR-0032.webp`

> Photorealistic studio portrait photograph of a 21-year-old Lebanese young man, medium-light skin, short black hair, brown eyes, a calm expression, wearing a plain black t-shirt. Head and shoulders, looking at the camera, soft natural window light, plain warm-grey background, 85mm lens, sharp focus on the eyes, natural skin texture. A real-looking person: not a cartoon, not an illustration, not 3D, no text, no watermark.

### CHR-0033 — 24, male, Gujarati

`CHR-0033.webp`

> Photorealistic studio portrait photograph of a 24-year-old Gujarati young man, medium skin, black hair tied back, brown eyes, an easy smile, wearing a plain black t-shirt. Head and shoulders, looking at the camera, soft natural window light, plain warm-grey background, 85mm lens, sharp focus on the eyes, natural skin texture. A real-looking person: not a cartoon, not an illustration, not 3D, no text, no watermark.

### CHR-0034 — 28, male, Tamil

`CHR-0034.webp`

> Photorealistic studio portrait photograph of a 28-year-old Tamil young man, brown skin, a turban, dark brown eyes, a calm expression, wearing a plain black t-shirt. Head and shoulders, looking at the camera, soft natural window light, plain warm-grey background, 85mm lens, sharp focus on the eyes, natural skin texture. A real-looking person: not a cartoon, not an illustration, not 3D, no text, no watermark.

### CHR-0035 — 33, male, Kenyan

`CHR-0035.webp`

> Photorealistic studio portrait photograph of a 33-year-old Kenyan man, dark skin, close-cropped tightly coiled black hair, dark brown eyes, faint crow's feet, a full beard, wearing a knit cardigan. Head and shoulders, looking at the camera, soft natural window light, plain warm-grey background, 85mm lens, sharp focus on the eyes, natural skin texture. A real-looking person: not a cartoon, not an illustration, not 3D, no text, no watermark.

### CHR-0036 — 40, male, Navajo

`CHR-0036.webp`

> Photorealistic studio portrait photograph of a 40-year-old Navajo man, tan skin, a shaved head, dark brown eyes, reading glasses, wearing a knit cardigan. Head and shoulders, looking at the camera, soft natural window light, plain warm-grey background, 85mm lens, sharp focus on the eyes, natural skin texture. A real-looking person: not a cartoon, not an illustration, not 3D, no text, no watermark.

### CHR-0037 — 47, male, Marathi

`CHR-0037.webp`

> Photorealistic studio portrait photograph of a 47-year-old Marathi man, tan skin, close-cropped wavy black hair, dark brown eyes, faint crow's feet, a full beard, wearing a knit cardigan. Head and shoulders, looking at the camera, soft natural window light, plain warm-grey background, 85mm lens, sharp focus on the eyes, natural skin texture. A real-looking person: not a cartoon, not an illustration, not 3D, no text, no watermark.

### CHR-0038 — 55, male, Bengali

`CHR-0038.webp`

> Photorealistic studio portrait photograph of a 55-year-old Bengali man, tan skin, a shaved head, dark brown eyes, reading glasses, wearing a knit cardigan. Head and shoulders, looking at the camera, soft natural window light, plain warm-grey background, 85mm lens, sharp focus on the eyes, natural skin texture. A real-looking person: not a cartoon, not an illustration, not 3D, no text, no watermark.

### CHR-0039 — 59, male, Italian

`CHR-0039.webp`

> Photorealistic studio portrait photograph of a 59-year-old Italian man, medium-light skin, close-cropped wavy salt-and-pepper hair, hazel eyes, faint crow's feet, a full beard, wearing a knit cardigan. Head and shoulders, looking at the camera, soft natural window light, plain warm-grey background, 85mm lens, sharp focus on the eyes, natural skin texture. A real-looking person: not a cartoon, not an illustration, not 3D, no text, no watermark.

### CHR-0040 — 61, male, Vietnamese

`CHR-0040.webp`

> Photorealistic studio portrait photograph of a 61-year-old Vietnamese elderly man, medium-light skin, thinning grey hair, dark brown eyes, laugh wrinkles around the eyes, wearing a shawl over a sweater. Head and shoulders, looking at the camera, soft natural window light, plain warm-grey background, 85mm lens, sharp focus on the eyes, natural skin texture. A real-looking person: not a cartoon, not an illustration, not 3D, no text, no watermark.

### CHR-0041 — 66, male, Irish

`CHR-0041.webp`

> Photorealistic studio portrait photograph of a 66-year-old Irish elderly man, light skin, short grey hair combed back, green eyes, age spots and kind eyes, a white moustache, wearing a shawl over a sweater. Head and shoulders, looking at the camera, soft natural window light, plain warm-grey background, 85mm lens, sharp focus on the eyes, natural skin texture. A real-looking person: not a cartoon, not an illustration, not 3D, no text, no watermark.

### CHR-0042 — 72, male, Jamaican

`CHR-0042.webp`

> Photorealistic studio portrait photograph of a 72-year-old Jamaican elderly man, brown skin, thinning grey hair, dark brown eyes, laugh wrinkles around the eyes, wearing a shawl over a sweater. Head and shoulders, looking at the camera, soft natural window light, plain warm-grey background, 85mm lens, sharp focus on the eyes, natural skin texture. A real-looking person: not a cartoon, not an illustration, not 3D, no text, no watermark.

### CHR-0043 — 80, male, Telugu

`CHR-0043.webp`

> Photorealistic studio portrait photograph of a 80-year-old Telugu elderly man, brown skin, short white hair combed back, dark brown eyes, age spots and kind eyes, a white moustache, wearing a shawl over a sweater. Head and shoulders, looking at the camera, soft natural window light, plain warm-grey background, 85mm lens, sharp focus on the eyes, natural skin texture. A real-looking person: not a cartoon, not an illustration, not 3D, no text, no watermark.

### CHR-0044 — 90, male, Mexican

`CHR-0044.webp`

> Photorealistic studio portrait photograph of a 90-year-old Mexican elderly man, tan skin, thinning white hair, brown eyes, laugh wrinkles around the eyes, wearing a shawl over a sweater. Head and shoulders, looking at the camera, soft natural window light, plain warm-grey background, 85mm lens, sharp focus on the eyes, natural skin texture. A real-looking person: not a cartoon, not an illustration, not 3D, no text, no watermark.
