-- Processing jobs queue + billing ledger extensions
-- Apply via Supabase MCP or dashboard SQL editor

CREATE TYPE job_status AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled');
CREATE TYPE job_type AS ENUM ('project_pipeline', 'export', 'repurpose', 'burn_subtitles');
CREATE TYPE credit_transaction_type AS ENUM ('usage', 'purchase', 'bonus', 'refund', 'adjustment');

CREATE TABLE processing_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_type job_type NOT NULL,
  status job_status NOT NULL DEFAULT 'queued',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_step public.processing_state,
  error_message text,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

CREATE INDEX processing_jobs_queue_idx
  ON public.processing_jobs (status, created_at)
  WHERE status IN ('queued', 'running');

CREATE INDEX processing_jobs_project_idx ON public.processing_jobs (project_id);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

ALTER TABLE public.credit_transactions
  ADD COLUMN IF NOT EXISTS transaction_type credit_transaction_type NOT NULL DEFAULT 'usage',
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE public.credit_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  credits integer NOT NULL CHECK (credits > 0),
  price_cents integer NOT NULL CHECK (price_cents > 0),
  stripe_price_id text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.credit_packs (name, credits, price_cents, sort_order) VALUES
  ('Starter', 120, 499, 1),
  ('Creator', 600, 1999, 2),
  ('Studio', 1500, 4499, 3);

ALTER TABLE public.processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY processing_jobs_select_own ON public.processing_jobs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY credit_packs_select_active ON public.credit_packs
  FOR SELECT USING (active = true);
