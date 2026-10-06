# AI Film Studio (Cinéma AI)

Turn a film idea into a story, characters, screenplay, storyboard, voice, music and a 10-second cinematic teaser.

```
ai-film-studio/
├── frontend/   React + Vite + TypeScript + Tailwind web app (Figma design)   → see frontend/README.md
├── backend/    FastAPI service (/api/v1) — AI pipeline: Sarvam (text, voice), OpenAI (images), Seedance (video)
├── database/   PostgreSQL schema & migrations
├── tests/      Backend / cross-service tests
└── docs/
    └── figma-comparison/   Side-by-side screenshots: Figma design vs implementation
```

The frontend runs standalone in demo mode; point `VITE_API_URL` at the backend to go live.
