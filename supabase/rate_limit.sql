-- Per-user AI cost guardrail (rate limit + daily quota)
-- =====================================================
-- Protects the Gemini/USDA budget: any authenticated user is capped to a
-- per-minute burst and a per-day total of AI calls. The Edge Functions call
-- public.consume_ai_quota() BEFORE hitting the paid AI provider.
--
-- Self-contained & idempotent — paste into the Supabase SQL Editor (or run via
-- the CLI). APPLY THIS BEFORE deploying the updated food-ai / food-ai-audio
-- functions, otherwise the RPC won't exist and (fail-closed) AI will be blocked.
--
--   supabase db execute --file supabase/rate_limit.sql      # or paste in the dashboard

-- Usage counters. One row per (user, bucket, window). No RLS policies are
-- defined on purpose: with RLS enabled and zero policies the table is
-- unreadable/unwritable by anon/authenticated clients. Only the SECURITY
-- DEFINER function below (owned by a privileged role) can touch it.
CREATE TABLE IF NOT EXISTS public.ai_usage (
    user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    bucket       TEXT NOT NULL,                 -- 'minute' | 'day'
    window_start TIMESTAMPTZ NOT NULL,
    count        INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, bucket, window_start)
);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;  -- enabled + no policies = deny all clients

-- Atomically count one AI call against the caller's per-minute and per-day
-- budgets. Returns TRUE if the call is allowed, FALSE if either limit is
-- exceeded. The caller is taken from auth.uid() (the verified JWT), so a client
-- cannot spoof another user or raise its own limits.
CREATE OR REPLACE FUNCTION public.consume_ai_quota(p_per_minute INTEGER, p_per_day INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public          -- hardening: pin search_path on SECURITY DEFINER
AS $$
DECLARE
    uid     UUID := auth.uid();
    m_start TIMESTAMPTZ := date_trunc('minute', now());
    d_start TIMESTAMPTZ := date_trunc('day', now());
    m_count INTEGER;
    d_count INTEGER;
BEGIN
    IF uid IS NULL THEN
        RETURN FALSE;
    END IF;

    INSERT INTO public.ai_usage(user_id, bucket, window_start, count)
    VALUES (uid, 'minute', m_start, 1)
    ON CONFLICT (user_id, bucket, window_start)
    DO UPDATE SET count = ai_usage.count + 1
    RETURNING count INTO m_count;

    INSERT INTO public.ai_usage(user_id, bucket, window_start, count)
    VALUES (uid, 'day', d_start, 1)
    ON CONFLICT (user_id, bucket, window_start)
    DO UPDATE SET count = ai_usage.count + 1
    RETURNING count INTO d_count;

    RETURN m_count <= p_per_minute AND d_count <= p_per_day;
END;
$$;

-- Only signed-in users may consume quota; nobody gets it by default.
REVOKE ALL ON FUNCTION public.consume_ai_quota(INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota(INTEGER, INTEGER) TO authenticated;

-- Housekeeping: drop counter rows older than 2 days so the table stays tiny.
CREATE OR REPLACE FUNCTION public.cleanup_ai_usage()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM public.ai_usage WHERE window_start < now() - INTERVAL '2 days';
END;
$$;

-- Schedule daily cleanup (requires the pg_cron extension, available on Supabase):
--   SELECT cron.schedule('cleanup-ai-usage', '0 3 * * *', 'SELECT public.cleanup_ai_usage()');
