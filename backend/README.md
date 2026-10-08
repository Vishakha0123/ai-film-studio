# AI Film Studio — Backend (FastAPI)

Python + FastAPI + Pydantic · SQLAlchemy + Alembic · Supabase Postgres + Supabase Auth ·
Redis + Arq jobs (optional) · FFmpeg render · provider adapters for **Sarvam** (story + voice),
**OpenAI** (images) and **Seedance via Atlas Cloud** (video). Every provider has a free `mock`
implementation, so the whole app runs end-to-end with no API keys.

## Run locally

```bash
cd backend
python -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env                 # Windows: copy .env.example .env
alembic upgrade head                 # create tables
uvicorn app.main:app --reload        # http://localhost:8000  ·  API docs at /docs
```

Quick start without Supabase: in `.env` set `AUTH_MODE=dev` (keeps SQLite + mock providers).
Then run the frontend with `VITE_API_URL=http://localhost:8000`; the Google and Apple buttons sign in
local test users (`google-user@dev.local`, `apple-user@dev.local`).

## Connect Supabase

1. Create a project at supabase.com.
2. `DATABASE_URL` ← Project Settings → Database → Connection string (session pooler URI).
3. `SUPABASE_URL` ← Project Settings → API → Project URL. Tokens are verified with the project's
   JWKS (`/auth/v1/.well-known/jwks.json`); set `SUPABASE_JWT_SECRET` only on legacy HS256 projects.
4. `alembic upgrade head`, then run `../database/supabase_rls.sql` in the SQL editor.
5. Storage: create a **public** bucket `assets`, set `STORAGE_BACKEND=supabase` and
   `SUPABASE_SERVICE_ROLE_KEY` (server only). Seedance needs public image URLs, so use this
   whenever `VIDEO_PROVIDER=seedance`.
6. Sign-in is **Google and Apple only** (no email/password). In Supabase → Authentication:
   - **Providers → Google**: enable, paste the OAuth Client ID and Secret from Google Cloud Console
     (Credentials → OAuth client → Web application). Authorized redirect URI:
     `https://<project-ref>.supabase.co/auth/v1/callback`.
   - **Providers → Apple**: enable, paste the Services ID, Team ID, Key ID and the `.p8` key from
     Apple Developer (Certificates, IDs & Profiles → Identifiers → Services ID with "Sign in with Apple").
     Return URL: `https://<project-ref>.supabase.co/auth/v1/callback`.
   - **Providers → Email**: turn off, so accounts can only be created through Google or Apple.
   - **URL Configuration**: Site URL = your frontend (e.g. `http://localhost:5173`), and add
     `http://localhost:5173/onboarding` (plus your production URL) to Redirect URLs.
   Frontend `.env`: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## Turn on real AI

| Task | Setting | Key |
|---|---|---|
| Story, characters, screenplay, edits | `STORY_PROVIDER=sarvam` | `SARVAM_API_KEY` |
| Voice lines | `TTS_PROVIDER=sarvam` | `SARVAM_API_KEY` |
| Character portraits, storyboard frames | `IMAGE_PROVIDER=openai` | `OPENAI_API_KEY` |
| Shot video clips | `VIDEO_PROVIDER=seedance` | `ATLAS_API_KEY` (+ `SEEDANCE_MODEL`) |

## API (`/api/v1`, Bearer token required)

| Method | Path | Purpose |
|---|---|---|
| GET | `/me` | Current user |
| POST / GET | `/projects` | Create / list projects |
| GET | `/projects/{id}` | Project with memory and asset URLs |
| POST | `/projects/{id}/brief` | Save the guided brief (idea, genres, language, length, aspect) |
| POST | `/projects/{id}/plan` | **Job** — story, characters, screenplay, scenes, shots |
| POST | `/projects/{id}/continue` · `complete` · `improve` · `transform` | **Job** — edit one part |
| POST | `/projects/{id}/approve` | Approve/reject a workflow step (versioned) |
| GET | `/projects/{id}/estimate?quality=draft` | Cost estimate before generation |
| POST | `/projects/{id}/generate` | **Job** — portraits → storyboard → video → voice (402 if cost needs confirmation) |
| POST | `/projects/{id}/render` | **Job** — FFmpeg teaser in 16:9 / 9:16 / 1:1 |
| POST | `/assets/{id}/regenerate` | **Job** — one asset; dependants marked outdated |
| GET | `/jobs/{id}` · POST `/jobs/{id}/cancel` | Poll status: queued · running · completed · failed · cancelled · needs_review |

Jobs accept an `Idempotency-Key` header so retried requests never start duplicate paid work.

## Background worker (optional)

```bash
REDIS_URL=redis://localhost:6379 arq app.workers.arq_worker.WorkerSettings
```

## Tests

```bash
cd ../tests/backend && python -m pytest -q
```
