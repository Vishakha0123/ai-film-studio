# AI Film Studio — Frontend (Cinéma AI)

React 19 + Vite + TypeScript + Tailwind CSS v4, built from the Figma Make design
**"AI Filmmaking Studio"** (dark cinematic theme · Fraunces + Manrope · gold `#d4a84b`).

## Run

```bash
cd frontend
npm install
cp .env.example .env      # optional — leave VITE_API_URL empty for demo mode
npm run dev               # http://localhost:5173
```

**Demo mode vs live mode** — with `VITE_API_URL` empty, every screen works on the sample
film ("Echoes of the Forgotten"). Set `VITE_API_URL=http://localhost:8000` to call the FastAPI
backend at `/api/v1/...` (see `src/api/`).

## Screens & routes

| Route | Screen |
|---|---|
| `/` | Landing |
| `/login` | Sign in / sign up (email + Google) |
| `/onboarding` | Genre selection |
| `/director` | AI Director chat |
| `/director/:panel` | `story` · `characters` · `screenplay` · `dialogue` · `lyrics` · `scenes` · `storyboard` · `audio` · `music` |
| `/generation` | Teaser generation progress |
| `/teaser` | Teaser player + versions + edit prompt |
| `/export` | Format / quality export |

Screens after `/login` require a session (token in `localStorage`). Workflow panels unlock
as the AI Director progresses; locked deep links fall back to `/director`.

## Structure

```
src/
  api/          API client (fetch wrapper, auth token, demo-mode fallbacks)
  components/   Sidebar (desktop rail / mobile drawer)
  screens/      Landing, Login, Onboarding, Director, Generation, Teaser, Export
  panels/       Director panels: Chat, Story, Characters, Screenplay, Dialogue, Lyrics, Scenes, Storyboard, Audio, Music
  test/         Vitest + Testing Library unit/integration tests
e2e/            Playwright end-to-end, mobile and screenshot specs
```

## Tests

```bash
npm run typecheck
npm test                  # unit + integration (Vitest, jsdom)
npm run test:e2e          # Playwright: desktop + mobile walkthroughs
npm run screenshots       # capture every screen to ../docs/figma-comparison/raw
```

Offline/sandboxed environments: `OFFLINE_PHOTOS=1` swaps Unsplash photos for a local placeholder,
and `PW_CHROMIUM_PATH=/path/to/chromium` uses a pre-installed browser.
