# Full-length film (10 minutes – 2 hours)

Open a planned film → **Projects → (film) → Full-length film (10 min – 2 h)**.

## How it's made

A 2-hour film is never one request. It is made in small saved units, each a database row with its own status:

1. **Story bible** — from the film you already planned: title, logline, genre, tone, language, visual style,
   characters (with their matched reference portraits).
2. **Scene outline** — about one scene per 90 seconds (10 min → 7 scenes, 1 h → 40, 2 h → 80), written in
   batches of 12 so the story model always sees the story so far. Scene lengths are scaled to add up exactly.
3. **Per scene, when it's made** — a script and a shot list (one shot ≈ 8 s, `LONG_SHOT_SECONDS`), written with
   the previous scene's continuity notes.
4. **Per shot** — what is connected decides the clip, and it is labelled honestly:
   - video model on → frame image (with the cast's reference portraits) → AI video clip
   - image model only → the AI frame held as a still shot
   - neither (default, no keys) → a **TEST CLIP** card with the shot's description — *not real footage*
   - dialogue lines → TTS voice (test tones with the mock provider)
5. **Scene file** — the shot clips joined as soon as a scene is complete (watch it on the page).
6. **Final film** — the scene files joined without re-encoding (H.264 + AAC, 24 fps, 1280×720 for 16:9),
   then checked with ffprobe (video + audio present, right size, right length) before it's offered for download.

## Safety rails

| | |
|---|---|
| Budget | A hard cap per film (default $25, `LONG_FILM_DEFAULT_BUDGET`; max `LONG_FILM_MAX_BUDGET`). It's checked before every paid call; reaching it stops the work (`budget_reached`). Raise the cap to continue. |
| Confirmation | Starting paid work over `COST_CONFIRM_THRESHOLD` asks first. The estimate counts only providers that cost money now, and also shows the cost with every paid provider on. |
| Usage limit | `LONG_FILM_MAX_ACTIVE` full-length films per creator at once (default 1). |
| Pause / resume | Pause stops after the current shot; Continue picks up where it stopped. |
| Retry | A shot is tried up to 3 times; then it waits for **Retry** (one shot, or a scene's failed shots). Nothing finished is made again. |
| Restarts | On startup, film jobs a restart cut off are started again (API process without Redis; the Arq worker with Redis). Long generate jobs hand over to a fresh job every `LONG_FILM_SLICE_SECONDS`. |
| Keys | Provider keys stay in `backend/.env` on the server — never in the browser. |

## API

`POST /projects/{id}/film` (targetMinutes, budgetCap, quality) · `GET /projects/{id}/film` (status, progress, estimate, scenes)
· `PATCH /projects/{id}/film` · `GET …/film/scenes/{n}` · `POST …/film/generate` · `…/pause` · `…/resume`
· `…/shots/{shotId}/retry` · `…/scenes/{n}/retry` · `…/render` · `GET …/film/download`

## Limits (honest)

- Without a video model every shot is a TEST CLIP card. Real footage needs `VIDEO_PROVIDER=seedance` + `ATLAS_API_KEY`
  and `IMAGE_PROVIDER=openai` + `OPENAI_API_KEY`. The real-provider path is implemented but **not yet tested with real keys**.
  A 2-hour film is ~900 shots: at the default draft rates that's roughly $250+ — try the 10-minute pilot first.
- The Seedance image-to-video call needs the frame at a public URL; with local storage (`http://localhost…`) it can't
  fetch it — use Supabase storage (or a public `PUBLIC_BASE_URL`) for real video.
- With Redis, restart recovery assumes a single Arq worker.
- Mock timing (this machine): a 10-minute pilot makes 77 test shots in ~2 minutes and renders in ~1 second.
