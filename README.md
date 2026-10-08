# AI Film Studio (Cinéma AI)

Turn a film idea into a story, characters, screenplay, storyboard, voice, music and a cinematic teaser.

```
ai-film-studio/
├── frontend/   React + Vite + TypeScript + Tailwind (Figma design)        → frontend/README.md
├── backend/    FastAPI · SQLAlchemy/Alembic · Supabase Auth · AI adapters  → backend/README.md
│               (Sarvam story+voice, OpenAI images, Seedance video; mock providers for free local runs)
├── database/   schema.sql (generated from migrations) · supabase_rls.sql
├── tests/      backend/ — pytest API + pipeline + provider adapter tests
├── docs/       figma-comparison/ — Figma vs implementation screenshots
└── .github/    CI: backend tests, frontend typecheck/tests/build, Playwright E2E
```

## Run the whole app locally (no keys needed)

```bash
# 1. Backend
cd backend
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env              # then set AUTH_MODE=dev for the quickest start (no Supabase needed)
alembic upgrade head
uvicorn app.main:app --reload     # http://localhost:8000/docs

# 2. Frontend (new terminal)
cd frontend
npm install
cp .env.example .env              # set VITE_API_URL=http://localhost:8000
npm run dev                       # http://localhost:5173
```

Then connect Supabase and the real AI providers when ready — see `backend/README.md`.
