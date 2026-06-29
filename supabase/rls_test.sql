-- RLS regression test for Kaloriez
-- =================================
-- Asserts that Row Level Security actually isolates users: one account can never
-- read or write another account's rows. Seeds two users in a TRANSACTION,
-- exercises the policies as each user (SET ROLE authenticated + a forged JWT
-- claim, exactly how Supabase evaluates auth.uid()), then ROLLS BACK so nothing
-- persists. Any failure RAISES an exception so it's impossible to miss.
--
-- Run against a NON-PRODUCTION database (it seeds throwaway auth users):
--   supabase db execute --file supabase/rls_test.sql      # or paste in the SQL Editor
--
-- Expected output: a series of "PASS: ..." notices and a final ROLLBACK.

BEGIN;

-- Two throwaway users. Inserting into auth.users fires on_auth_user_created,
-- which creates their public.profiles rows automatically.
INSERT INTO auth.users (id, email, raw_user_meta_data, created_at, updated_at, aud, role)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'rls_a@test.local', '{"full_name":"User A"}', now(), now(), 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'rls_b@test.local', '{"full_name":"User B"}', now(), now(), 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

-- Seed a row owned by A (as the privileged role, which bypasses RLS for setup).
INSERT INTO food_entries (user_id, name, calories, meal_type, timestamp)
VALUES ('11111111-1111-1111-1111-111111111111', 'Tacos de User A', 300, 'lunch', now());

-- Become user B (non-superuser role + B's JWT sub claim => auth.uid() = B).
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

-- Test 1: B must NOT see A's food entries.
DO $$
DECLARE cnt int;
BEGIN
    SELECT count(*) INTO cnt FROM food_entries
    WHERE user_id = '11111111-1111-1111-1111-111111111111';
    IF cnt <> 0 THEN
        RAISE EXCEPTION 'RLS FAIL: user B can read % of user A''s food_entries (expected 0)', cnt;
    END IF;
    RAISE NOTICE 'PASS: user B cannot read user A food_entries';
END $$;

-- Test 2: B must NOT be able to INSERT a row owned by A (WITH CHECK).
DO $$
DECLARE blocked boolean := false;
BEGIN
    BEGIN
        INSERT INTO food_entries (user_id, name, calories, meal_type, timestamp)
        VALUES ('11111111-1111-1111-1111-111111111111', 'Inyectado por B', 1, 'snacks', now());
    EXCEPTION WHEN others THEN
        blocked := true; -- the policy rejected it = correct
    END;
    IF NOT blocked THEN
        RAISE EXCEPTION 'RLS FAIL: user B inserted a food_entry owned by user A';
    END IF;
    RAISE NOTICE 'PASS: user B blocked from inserting as user A';
END $$;

-- Test 3: B must NOT read A's profile.
DO $$
DECLARE cnt int;
BEGIN
    SELECT count(*) INTO cnt FROM profiles
    WHERE id = '11111111-1111-1111-1111-111111111111';
    IF cnt <> 0 THEN
        RAISE EXCEPTION 'RLS FAIL: user B can read user A profile';
    END IF;
    RAISE NOTICE 'PASS: user B cannot read user A profile';
END $$;

-- Switch to user A.
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- Test 4: A CAN read their own food entries (policy isn't over-restrictive).
DO $$
DECLARE cnt int;
BEGIN
    SELECT count(*) INTO cnt FROM food_entries
    WHERE user_id = '11111111-1111-1111-1111-111111111111';
    IF cnt < 1 THEN
        RAISE EXCEPTION 'RLS FAIL: user A cannot read own food_entries (got %)', cnt;
    END IF;
    RAISE NOTICE 'PASS: user A reads own food_entries (% row(s))', cnt;
END $$;

RESET ROLE;

-- Nothing is persisted: this is a read-only regression check.
ROLLBACK;
