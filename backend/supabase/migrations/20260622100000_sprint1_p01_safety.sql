-- Sprint 1: processing jobs, billing safety, upload lifecycle, processing events

ALTER TYPE public.processing_state ADD VALUE IF NOT EXISTS 'persisting_transcript';
ALTER TYPE public.processing_state ADD VALUE IF NOT EXISTS 'transcript_ready';
ALTER TYPE public.project_status ADD VALUE IF NOT EXISTS 'draft';

DO $$ BEGIN
  CREATE TYPE public.upload_status AS ENUM ('draft', 'uploading', 'ready_to_process');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.credit_transaction_type AS ENUM (
    'usage', 'purchase', 'bonus', 'refund', 'adjustment', 'reserve', 'release'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.job_status AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.job_type AS ENUM ('project_pipeline', 'export', 'repurpose', 'burn_subtitles');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.processing_event_status AS ENUM (
    'started', 'completed', 'failed', 'retrying', 'skipped'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.project_file_type AS ENUM (
    'source_video', 'source_audio', 'extracted_audio',
    'transcript_txt', 'transcript_docx', 'subtitle_srt', 'subtitle_vtt', 'burned_video'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS credits_reserved integer NOT NULL DEFAULT 0 CHECK (credits_reserved >= 0),
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS upload_status public.upload_status NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS credits_reserved integer NOT NULL DEFAULT 0 CHECK (credits_reserved >= 0),
  ADD COLUMN IF NOT EXISTS reservation_idempotency_key text;

ALTER TABLE public.credit_transactions
  ADD COLUMN IF NOT EXISTS transaction_type public.credit_transaction_type NOT NULL DEFAULT 'usage',
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS credit_transactions_idempotency_key_idx
  ON public.credit_transactions (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.processing_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_type public.job_type NOT NULL,
  status public.job_status NOT NULL DEFAULT 'queued',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_step public.processing_state,
  error_message text,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  idempotency_key text,
  locked_at timestamptz,
  locked_by text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS processing_jobs_idempotency_key_idx
  ON public.processing_jobs (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS processing_jobs_queue_idx
  ON public.processing_jobs (status, created_at)
  WHERE status IN ('queued', 'running');

CREATE INDEX IF NOT EXISTS processing_jobs_project_idx ON public.processing_jobs (project_id);

CREATE TABLE IF NOT EXISTS public.processing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.processing_jobs(id) ON DELETE SET NULL,
  stage text NOT NULL,
  status public.processing_event_status NOT NULL,
  message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS processing_events_project_idx
  ON public.processing_events (project_id, created_at);

CREATE TABLE IF NOT EXISTS public.project_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  file_type public.project_file_type NOT NULL,
  storage_bucket text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  size_bytes bigint,
  duration_seconds integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

CREATE INDEX IF NOT EXISTS project_files_project_idx ON public.project_files (project_id);

CREATE TABLE IF NOT EXISTS public.credit_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  credits integer NOT NULL CHECK (credits > 0),
  price_cents integer NOT NULL CHECK (price_cents > 0),
  stripe_price_id text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.credit_packs (name, credits, price_cents, sort_order)
SELECT 'Starter', 120, 499, 1
WHERE NOT EXISTS (SELECT 1 FROM public.credit_packs WHERE name = 'Starter');

INSERT INTO public.credit_packs (name, credits, price_cents, sort_order)
SELECT 'Creator', 600, 1999, 2
WHERE NOT EXISTS (SELECT 1 FROM public.credit_packs WHERE name = 'Creator');

INSERT INTO public.credit_packs (name, credits, price_cents, sort_order)
SELECT 'Studio', 1500, 4499, 3
WHERE NOT EXISTS (SELECT 1 FROM public.credit_packs WHERE name = 'Studio');

CREATE TABLE IF NOT EXISTS public.billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_packs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS processing_jobs_select_own ON public.processing_jobs;
CREATE POLICY processing_jobs_select_own ON public.processing_jobs
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS processing_events_select_own ON public.processing_events;
CREATE POLICY processing_events_select_own ON public.processing_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = processing_events.project_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS project_files_select_own ON public.project_files;
CREATE POLICY project_files_select_own ON public.project_files
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_files.project_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS credit_packs_select_active ON public.credit_packs;
CREATE POLICY credit_packs_select_active ON public.credit_packs
  FOR SELECT USING (active = true);
