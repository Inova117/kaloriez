# Deployment & Post-Audit Setup

The audit fixes introduce a backend tier (Supabase Edge Functions) and move all
third-party secrets server-side. The app **will not have working AI or account
deletion until these steps are done**, and the previously bundled keys must be
treated as compromised and rotated.

> Order matters. Do 1 → 2 → 3 → 4 before building a release.

## 1. Apply the database schema

The schema now includes a `weight_entries` table, a server-side profile-creation
trigger (`on_auth_user_created`), tighter RLS, and the existing tables.

```bash
# In the Supabase dashboard → SQL Editor, run the full file:
supabase_schema.sql
```

It is idempotent (uses `IF NOT EXISTS` / `DROP POLICY IF EXISTS`), safe to re-run.

## 2. Deploy the Edge Functions

```bash
supabase login
supabase link --project-ref <your-project-ref>

supabase functions deploy food-ai
supabase functions deploy delete-account
```

- `food-ai` runs the Gemini → USDA pipeline server-side (replaces the old
  client `src/lib/groq.ts` / `src/lib/usda.ts`).
- `delete-account` deletes the auth user + cascaded data (service role).

`delete-account` requires JWT verification (the default) — do **not** deploy it
with `--no-verify-jwt`.

## 3. Set server-side secrets (NEVER in the app/.env bundle)

```bash
supabase secrets set \
  GEMINI_API_KEY=<new-rotated-gemini-key> \
  GEMINI_MODEL=gemini-2.5-flash \
  USDA_API_KEY=<new-rotated-usda-key>
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are already
available to Edge Functions automatically — you do not need to set them.

## 4. Rotate the exposed keys (critical)

The previous build shipped the Gemini and USDA keys inside the JS bundle, so they
must be assumed public:

- **Google AI Studio / Google Cloud:** revoke the old Gemini key, create a new
  one, and put the new value in step 3. Optionally restrict it.
- **USDA FoodData Central:** request a fresh key if you want to invalidate the old one.
- The client `.env` now only needs `SUPABASE_URL` and `SUPABASE_ANON_KEY`
  (the anon key is safe to ship — it is gated by RLS).

## 5. App Store / Play Store checklist (still open)

- ✅ Account deletion (implemented — Profile → Delete Account).
- 🔶 Privacy Policy link added in Profile → About, but it points to the
  placeholder `PRIVACY_POLICY_URL` (`https://kaloriez.app/privacy`) in
  `src/screens/ProfileScreen.tsx`. **Host a real policy and update that URL**
  before submission, and add the same URL to the store listings.
- ⬜ Data-safety / privacy nutrition labels disclosing Sentry + health data.

## Notes / known limitations

- **Offline writes are not yet queued.** Entries/weights added while offline are
  saved to the local cache (not lost) but are not retried against Supabase until
  a future sync-queue iteration. Online usage syncs immediately.
- The unused media deps (`expo-audio`, `expo-video`, `expo-blur`) and the
  voice-dictation UI remain; wire or remove them in a later pass.
