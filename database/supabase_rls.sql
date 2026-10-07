-- Run once in the Supabase SQL editor AFTER `alembic upgrade head`.
-- The FastAPI backend connects as the database owner (DATABASE_URL), which bypasses RLS.
-- Enabling RLS with no policies blocks direct table access through the public anon key,
-- so all reads/writes must go through the backend's authorization checks.
alter table public.users            enable row level security;
alter table public.projects         enable row level security;
alter table public.assets           enable row level security;
alter table public.ai_jobs          enable row level security;
alter table public.workflow_steps   enable row level security;
alter table public.usage_events     enable row level security;
alter table public.alembic_version  enable row level security;

-- Storage: create a PUBLIC bucket named "assets" (Storage → New bucket) so generated
-- images/videos have stable URLs the video provider and the browser can load.
