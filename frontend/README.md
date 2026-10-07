# AI Film Studio — Frontend (Cinéma AI)

React 19 + Vite + TypeScript + Tailwind CSS v4, built from the Figma Make design
**"AI Filmmaking Studio"** (dark cinematic theme · Fraunces + Manrope · gold `#d4a84b`).

## Run

```bash
cd frontend
npm install
cp .env.example .env      # Windows: copy .env.example .env
npm run dev               # http://localhost:5173
```

| `.env` | What you get |
|---|---|
| everything empty | **Demo mode** — sample film, no backend needed |
| `VITE_API_URL=http://localhost:8000` | **Live mode, dev login** — backend with `AUTH_MODE=dev`, any email works |
| + `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | **Live mode, Supabase Auth** — email/password and Google |

In live mode the AI Director creates a project, saves the brief and runs the plan job on the
backend; Generation shows the cost estimate and follows the generate job; Export runs the FFmpeg
render job. The current project reopens after a page reload.

## Screens & routes

| Route | Screen |
|---|---|
| `/` | Landing |
| `/login` | Sign in / sign up (email + Google) |
| `/onboarding` | Genre selection |
| `/director` | AI Director chat |
| `/director/:panel` | `story` · `characters` · `screenplay` · `dialogue` · `lyrics` · `scenes` · `storyboard` · `audio` · `music` |
| `/projects` | All your films — search, open, rename, delete |
| `/assets` | Asset library — portraits, frames, clips, voice, teasers; filter, regenerate, download |
| `/settings` | Account, sign out, creative defaults (language, length, aspect, quality), provider status |
| `/generation` | Teaser generation progress |
| `/teaser` | Teaser player + versions + edit prompt |
| `/export` | Format / quality export |

Screens after `/login` require a session. Every Director stage is open at any time; stages the
AI Director has completed show a check. In live mode, stages without a film yet show a prompt to
start in the AI Director or open a saved project.

## Structure

```
src/
  api/          API client: Supabase/dev auth, projects, jobs (polling), demo fallbacks
  studio.tsx    Current project context (useFilm / useStudio)
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
npm run test:e2e          # Playwright: desktop + mobile walkthroughs (demo mode)
npm run test:e2e:live     # full stack: real backend (dev auth, mock AI) + live frontend
npm run test:e2e:supabase # Supabase sign-in → backend token verification
npm run screenshots       # capture every screen to ../docs/figma-comparison/raw
```

Offline/sandboxed environments: `OFFLINE_PHOTOS=1` swaps Unsplash photos for a local placeholder,
and `PW_CHROMIUM_PATH=/path/to/chromium` uses a pre-installed browser.
