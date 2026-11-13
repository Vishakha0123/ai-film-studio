# Deploying Cinéma AI

| Piece | Where | Cost |
|---|---|---|
| Website (frontend) | **Vercel** | Free (Hobby) |
| API (backend) | **Render**, Docker, always on | Starter, about $7/month |
| Database, Google sign-in, files | **Supabase** (already set up) | Free tier to start |
| AI | **Sarvam** (story, script, dialogue, translation) | Pay per use |

Every merge to `main` deploys both, automatically.

Do the steps **in this order**: the API needs Supabase, and the website needs the API's address.

---

## 1. Supabase: get the values and prepare storage

Open your project at https://supabase.com/dashboard.

1. **Database address.** Go to **Connect** (top bar), then **Session pooler**, and copy the URI. It looks like
   `postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`.
   Put your real database password in place of `[YOUR-PASSWORD]`. This is `DATABASE_URL`.
2. **Project URL and keys.** Go to **Project Settings → API** and copy:
   - the **Project URL** (`SUPABASE_URL`, used by both the API and the website);
   - the **anon / publishable** key (`VITE_SUPABASE_ANON_KEY`, for the website; it is public and safe);
   - the **service_role / secret** key (`SUPABASE_SERVICE_ROLE_KEY`, for the API **only**; never put it in the website or a screenshot).
   - Only if your project still uses the legacy JWT secret: **Project Settings → JWT Keys → Legacy JWT secret** (`SUPABASE_JWT_SECRET`).
3. **File storage.** Go to **Storage → New bucket**, name it `assets`, turn on **Public bucket**, then **Save**.
   Portraits, storyboard frames and film files are saved here.

## 2. Render: the API

1. Sign in at https://render.com with GitHub and allow access to the `ai-film-studio` repository.
2. Click **New → Blueprint** and choose the repository. Render reads `render.yaml` and proposes the **cineai-api** service
   (Docker, Singapore, Starter plan).
3. Render asks for the secret values. Fill them in:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | Supabase session pooler URI (step 1.1) |
   | `SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key |
   | `SUPABASE_JWT_SECRET` | legacy secret, or leave empty |
   | `SARVAM_API_KEY` | your Sarvam key |
   | `PUBLIC_BASE_URL` | leave as `https://example.com` for now; fixed in step 2.5 |
   | `CORS_ORIGINS` | `["https://example.com"]` for now; fixed in step 4 |

4. Click **Apply**. The first build takes about 5 minutes. On start, the API creates the database tables by itself.
5. Copy the service address at the top of the page (e.g. `https://cineai-api.onrender.com`). Then go to
   **Environment**, set `PUBLIC_BASE_URL` to that address, and save. Render redeploys.
6. **Check it.** Open `https://cineai-api.onrender.com/health`. You should see `"status":"ok"`, `"authMode":"supabase"` and `"story":"sarvam"`.

> If the deploy fails with **"Not safe to run in production: …"**, the message names the setting to fix.
> This check stops the API from going live with test sign-in, a temporary database or temporary file storage.

## 3. Vercel: the website

1. Sign in at https://vercel.com with GitHub, then **Add New → Project** and import `ai-film-studio`.
2. Set **Root Directory** to `frontend`. Vercel detects Vite; the settings come from `frontend/vercel.json`.
3. Open **Environment Variables** and add:

   | Key | Value |
   |---|---|
   | `VITE_API_URL` | the Render address, e.g. `https://cineai-api.onrender.com` |
   | `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | anon / publishable key |

4. Click **Deploy**. Copy the site address (e.g. `https://cinema-ai.vercel.app`).

> A live build without these three values **stops with an error** instead of going live as the offline demo.

## 4. Connect them

1. **Render → cineai-api → Environment:** set `CORS_ORIGINS` to the site address as a list, then save:
   `["https://cinema-ai.vercel.app"]`
   With a custom domain later, add it too: `["https://cinema-ai.vercel.app","https://cinema.vrutsasolutions.com"]`.
2. **Supabase → Authentication → URL Configuration:**
   - set **Site URL** to `https://cinema-ai.vercel.app`;
   - under **Redirect URLs**, add `https://cinema-ai.vercel.app/**`.

   Without this, Google sign-in sends people back to localhost.
3. Google Cloud needs **no change**: Google redirects to Supabase, which is already set up.

## 5. Test the live site

1. Open the site: the home page and **Watch Demo** work.
2. **Sign in with Google.** You land on onboarding, then the Director.
3. Type an idea. The story is written by Sarvam, with timings shown.
4. Refresh the page (the film stays open), then click **Exit** and sign in again (you get an empty Director, and the film is in Projects).
5. Open Privacy, Terms and Contact from the footer.

## Updating

- Merge a PR into `main`. Render and Vercel both redeploy within a few minutes, and database changes apply on start.
- Every PR also gets a Vercel preview link. The preview uses the same live API, so it is real data.
- A deploy restarts the API. Full-length film work that was running carries on by itself after the restart. A shorter job
  that was running at that moment (e.g. writing a story) is marked failed with "please try again", so nobody is left
  waiting on an endless spinner.

## Custom domain (later)

- **Vercel → Project → Settings → Domains:** add e.g. `cinema.vrutsasolutions.com`, then create the DNS record Vercel shows.
- **Render → cineai-api → Settings → Custom Domains:** add e.g. `api-cinema.vrutsasolutions.com`, then create the DNS record Render shows.
- After that, update `VITE_API_URL` (Vercel), `PUBLIC_BASE_URL` and `CORS_ORIGINS` (Render), and Supabase's
  Site URL and Redirect URLs to the new addresses.

## What runs where

- **API container** (`backend/Dockerfile`): Python 3.13, ffmpeg and the bundled PDF fonts. On start it runs
  `alembic upgrade head`, then one uvicorn process; film jobs run inside it.
- **`render.yaml`**: one always-on instance, health check `/health`, Singapore region, and auto-deploy from `main`.
- **`frontend/vercel.json`**: every page address serves the app, files under `/assets` are cached for a year, and
  basic security headers are set.
- **CI**: the `docker` job builds the same image, starts it against Postgres, and checks health, cast photos, sign-in and ffmpeg.
