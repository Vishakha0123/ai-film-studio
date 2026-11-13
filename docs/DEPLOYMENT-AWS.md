# Deploying Cinéma AI on AWS

```
                 https://<your-site>   (one address for everything)
                          │
                    ┌─────┴─────┐
                    │ CloudFront │  HTTPS, caching
                    └─────┬─────┘
          everything else │ /api/*  /portraits/*
                ┌─────────┴─────────┐
                ▼                   ▼
          S3 bucket          Elastic Beanstalk (Docker on EC2 t4g.small)
       (the website)          the API ─────────► Supabase: database, Google sign-in, files
                                       └───────► Sarvam AI
```

| Piece | AWS service | Approx. cost / month |
|---|---|---|
| API | Elastic Beanstalk, single instance, **t4g.small** (2 vCPU, 2 GB, ARM), Mumbai | ~$8.20 + ~$3.65 public IP + <$1 disk |
| Website | S3 (private) + CloudFront | ~$0–1 at launch |
| HTTPS for both | CloudFront (no load balancer needed — saves ~$16) | included |
| Database, sign-in, files | Supabase (unchanged) | Free → Pro $25 before public launch |

The site and the API share **one address**: CloudFront sends `/api/*` and `/portraits/*` to Beanstalk and everything
else to S3. One HTTPS certificate, and no cross-site setup.

Create everything in **Asia Pacific (Mumbai) ap-south-1**, except a custom-domain certificate (see the end).

---

## 1. Supabase

1. **Connect → Session pooler**: copy the URI and fill in the database password → `DATABASE_URL`.
2. **Project Settings → API**: copy the **Project URL**, the **anon** key (website) and the **service_role** key (API only — never in the website).
3. **Storage → New bucket** → `assets`, **Public** → Save.

## 2. IAM roles (reuse if they exist)

**IAM → Roles**, search `aws-elasticbeanstalk`. You need:

- `aws-elasticbeanstalk-service-role` — the Beanstalk console can create it in step 3.
- `aws-elasticbeanstalk-ec2-role` — if missing: **Create role → AWS service → EC2** → add
  `AWSElasticBeanstalkWebTier`, `AWSElasticBeanstalkMulticontainerDocker`, `AWSElasticBeanstalkWorkerTier` → name it exactly that.

## 3. Elastic Beanstalk — the API

1. **Make the upload file** (PowerShell, from the repo):
   ```powershell
   cd C:\Users\HP\ai-film-studio
   git checkout main
   git pull
   powershell -ExecutionPolicy Bypass -File deploy\aws\make-backend-zip.ps1
   ```
   → creates `cineai-api.zip` (the Dockerfile, the code, the 10 cast photos and two small Beanstalk settings folders).
2. **Elastic Beanstalk → Create application** → **Web server environment**
   - Application name `cineai`, environment `cineai-env`
   - Platform **Docker**, branch **64bit Amazon Linux 2023**
   - Application code **Upload your code** → `cineai-api.zip`
   - Presets **Single instance**
3. **Service access** — service role `aws-elasticbeanstalk-service-role`, EC2 instance profile `aws-elasticbeanstalk-ec2-role`.
4. **Instances** — Architecture **arm64**, instance type **t4g.small** only.
5. **Environment properties**:

   | Name | Value |
   |---|---|
   | `APP_ENV` | `production` |
   | `AUTH_MODE` | `supabase` |
   | `STORAGE_BACKEND` | `supabase` |
   | `SUPABASE_STORAGE_BUCKET` | `assets` |
   | `STORY_PROVIDER`, `TTS_PROVIDER`, `STT_PROVIDER` | `sarvam` |
   | `IMAGE_PROVIDER`, `VIDEO_PROVIDER` | `mock` |
   | `DATABASE_URL` | Supabase session pooler URI |
   | `SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key |
   | `SUPABASE_JWT_SECRET` | only if your project uses the legacy JWT secret |
   | `SARVAM_API_KEY` | your Sarvam key |
   | `PUBLIC_BASE_URL` | `https://example.com` for now (fixed in step 6) |
   | `CORS_ORIGINS` | `["https://example.com"]` for now (fixed in step 6) |

6. **Submit**. The first build takes ~10 minutes. When health is **Green**, open
   `http://<environment-domain>/health` → `"status":"ok"`, `"authMode":"supabase"`, `"story":"sarvam"`.
   Copy the environment domain (e.g. `cineai-env.eba-xxxx.ap-south-1.elasticbeanstalk.com`).

> Health **Red**? **Logs → Request last 100 lines**. "Not safe to run in production: …" names the setting to fix —
> the API refuses to start live with test sign-in, a temporary database, temporary file storage or a non-https address.

What ships in the zip for Beanstalk: `.ebextensions/cineai.config` (health check `/health`, enhanced health, logs to
CloudWatch for 14 days) and `.platform/nginx/conf.d/uploads.conf` (allows uploads up to 12 MB — Beanstalk's default is 1 MB;
the app accepts script and voice files up to 10 MB).

## 4. S3 — the website bucket

**S3 → Create bucket** → e.g. `cineai-site-<unique>`, Mumbai, keep **Block all public access ON**.

## 5. CloudFront — one address for site + API

1. **Create distribution** → origin: your S3 bucket → **Origin access: Origin access control (recommended)** → create OAC.
   - Viewer protocol policy **Redirect HTTP to HTTPS**, default root object `index.html`.
   - After creating it, copy the **bucket policy** CloudFront shows → **S3 → bucket → Permissions → Bucket policy** → paste → Save.
2. **Origins → Create origin** (the API): domain = the Beanstalk environment domain, **HTTP only**, port **80**,
   response timeout **60** s.
3. **Behaviors → Create behavior**, twice — path `/api/*` and `/portraits/*`:
   - Origin: the Beanstalk origin · Viewer: **Redirect HTTP to HTTPS**
   - Allowed methods: **GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE**
   - Cache policy **CachingDisabled** · Origin request policy **AllViewerExceptHostHeader** (passes the sign-in through)
4. **Functions → Create function** `spa-routing` → paste [`deploy/aws/cloudfront-spa-routing.js`](../deploy/aws/cloudfront-spa-routing.js)
   → **Publish** → distribution → **Default (\*)** behavior → **Function associations → Viewer request** → `spa-routing` → Save.
   (Page addresses like `/director/story` serve the app. Don't use custom error pages for this — they'd also turn the API's real
   404s into the website.)
5. Copy the **distribution domain**, e.g. `d1abc234xyz.cloudfront.net`.

## 6. Point everything at the address

- **Beanstalk → Configuration → Environment properties**: `PUBLIC_BASE_URL` = `https://d1abc234xyz.cloudfront.net`,
  `CORS_ORIGINS` = `["https://d1abc234xyz.cloudfront.net"]` → Apply.
- **Supabase → Authentication → URL Configuration**: Site URL = `https://d1abc234xyz.cloudfront.net`;
  Redirect URLs → add `https://d1abc234xyz.cloudfront.net/**`. (Otherwise Google sign-in returns to localhost.)

## 7. Build and upload the website

1. `frontend\.env.production` (on your PC only, never committed):
   ```
   VITE_API_URL=https://d1abc234xyz.cloudfront.net
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon key>
   ```
2. ```powershell
   cd C:\Users\HP\ai-film-studio\frontend
   npm install
   npm run build
   ```
3. **S3 → site bucket → Upload** → everything **inside** `frontend\dist` (`index.html`, `assets`, `demo`, …).
4. **CloudFront → Invalidations → Create** → `/*`.

## 8. Test

Home page + Watch Demo · Sign in with Google · write a film (Sarvam, with timings) · refresh (film stays) ·
Exit → sign in again (empty Director, film in Projects) · Privacy, Terms, Contact.

## Updating later

- **API**: run `make-backend-zip.ps1` again → **Beanstalk → Upload and deploy** → pick the new zip. Database changes apply on start.
  A restart resumes full-length film work; a shorter job running at that moment is marked "please try again".
- **Website**: `npm run build` → upload `dist` contents to S3 → invalidate `/*`.
- (Next step, optional: a GitHub Actions workflow that does both on every merge to `main`.)

## Custom domain (e.g. `cinema.vrutsasolutions.com`)

1. **Certificate Manager in US East (N. Virginia)** — CloudFront only uses certificates from there. Reuse an existing
   `*.vrutsasolutions.com` certificate, or request one for `cinema.vrutsasolutions.com` and add the DNS record it shows.
2. **CloudFront → distribution → Settings → Edit** → Alternate domain names: `cinema.vrutsasolutions.com` → pick the certificate.
3. At your DNS provider: **CNAME** `cinema` → `d1abc234xyz.cloudfront.net`.
4. Use `https://cinema.vrutsasolutions.com` in steps 6 and 7 (`CORS_ORIGINS` can list both addresses), rebuild and upload.

## Notes

- The Beanstalk address still answers on plain HTTP directly; people use the CloudFront address. To lock that down later,
  add a secret header in CloudFront and check it on the server.
- CI's `docker` job builds the same image (also for arm64), starts it against Postgres and checks health, cast photos,
  sign-in and ffmpeg — so a broken image never reaches Beanstalk.
