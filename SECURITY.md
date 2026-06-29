# Security

This document is the single source of truth for Kaloriez's security posture: the
threat model, the controls that are in place, how to deploy them safely, and the
checklist of things only a human with dashboard/console access can do.

- **App:** Kaloriez (Expo / React Native, iOS + Android), target market Mexico.
- **Backend:** Supabase (Postgres + Auth + Edge Functions on Deno).
- **Last reviewed:** 2026-06-26.
- **Frameworks used as the bar:** OWASP MASVS v2, OWASP Mobile Top 10 (2024),
  OWASP API Security Top 10 (2023).

---

## 1. Security model (read this first)

Three principles drive every decision below:

1. **Zero-trust client.** The mobile binary is fully untrusted. The Supabase
   **anon key is public by design** — it is baked into the app (`eas.json`) and
   trivially extractable from the APK/IPA. Security therefore lives on the
   server: Row Level Security (RLS), JWT verification, and per-user quotas. The
   client is a convenience, never a gate.
2. **Defense in depth.** Each layer assumes the previous one failed:
   `client → Edge Function (JWT + rate limit + cache) → Postgres (RLS) → AI provider (billing cap)`.
3. **Cost is a security property.** Unbounded access to the paid AI endpoints is
   a financial-DoS vector, so rate limits + quotas + caching + a hard billing cap
   are treated as security controls, not just ops hygiene.

### Trust boundaries

```
┌─────────────┐   anon key + user JWT    ┌──────────────────────┐   service-role / secrets   ┌──────────────┐
│ Mobile app  │ ───────────────────────► │ Supabase Edge (Deno) │ ─────────────────────────► │ Gemini / USDA│
│ (untrusted) │                          │  food-ai / -audio /  │                            │ (paid APIs)  │
└─────────────┘                          │  delete-account      │                            └──────────────┘
       │ anon key + user JWT                     │ user JWT (RLS-scoped) / service-role
       ▼                                         ▼
┌──────────────────────────────────────────────────────────────┐
│ Postgres — Row Level Security on every public table           │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Threat model → controls

The product owner's three explicit fears map to concrete controls:

### Fear A — "Huge bills because someone abused my AI API"
- **Per-user rate limit + daily quota** enforced in Postgres before any paid
  call. [`supabase/rate_limit.sql`](supabase/rate_limit.sql) defines table
  `ai_usage` + RPC `consume_ai_quota(p_per_minute, p_per_day)` (SECURITY DEFINER,
  identifies the caller via `auth.uid()` so it cannot be spoofed).
  - `food-ai`: **6/min, 100/day** per user.
  - `food-ai-audio`: **3/min, 30/day** per user (audio is pricier, multimodal).
  - The check is **fail-closed**: if the limiter is unreachable the paid call is
    skipped, not allowed.
- **Result caching.** [`food-ai`](supabase/functions/food-ai/index.ts) reads the
  `ai_suggestions` table before calling Gemini and upserts after; identical
  normalized queries never re-bill (per-user, RLS-scoped, 30-day TTL).
- **Bot-signup friction.** hCaptcha on sign-up/sign-in (see Fear B) stops the
  mass-account-creation that would otherwise multiply the quota.
- **Hard provider billing cap** (the final backstop) — see §6, item 4. *Owner action.*

### Fear B — "Someone hacking the accounts"
- **Auth** is Supabase email/password. Hardening that lives in the Dashboard
  (leaked-password protection, email confirmation, MFA, rate limits) is in §7.
- **hCaptcha** on `signUp` / `signInWithPassword`, env-gated behind
  `EXPO_PUBLIC_HCAPTCHA_SITE_KEY` — when unset the app behaves exactly as before;
  when set, a token is required and Supabase verifies it server-side.
  ([`AuthScreen.tsx`](src/screens/AuthScreen.tsx), [`AuthContext.tsx`](src/contexts/AuthContext.tsx)).
- **Encrypted session at rest.** [`supabase.ts`](src/lib/supabase.ts) uses the
  `LargeSecureStore` adapter: a 256-bit AES key in the iOS Keychain / Android
  Keystore (`expo-secure-store`), the encrypted session blob in AsyncStorage.
  On web it falls back to AsyncStorage (SecureStore is native-only).
- **Password recovery** flow ([`ResetPasswordScreen.tsx`](src/screens/ResetPasswordScreen.tsx)
  + `resetPassword`/`updatePassword` in `AuthContext`) so users aren't pushed to
  weak/reused passwords. A recovery session never grants app access on its own —
  cancelling signs out.

### Fear C — "Someone accessing my backend"
- **Row Level Security** on every public table, owner-scoped via `auth.uid()`
  ([`supabase/supabase_schema.sql`](supabase/supabase_schema.sql)). This is the primary gate and
  the reason the public anon key is safe to ship.
- **JWT verification** in every Edge Function (`getUser()` → 401 without a valid
  user) and at the platform level ("Verify JWT" must stay ON — §7).
- **`service_role` key is server-only** — used solely in
  [`delete-account`](supabase/functions/delete-account/index.ts); it is never in
  `src/`, never in the bundle.
- **SECURITY DEFINER hardening:** `handle_new_user`, `update_updated_at_column`,
  `cleanup_expired_suggestions`, `consume_ai_quota`, `cleanup_ai_usage` pin
  `search_path` to prevent search-path hijacking.
- **App Attestation (deferred, gold standard):** ensures only the genuine app —
  not a script with the extracted anon key — can call the backend. Full
  implementation guide in [`docs/SECURITY_APP_ATTESTATION.md`](docs/SECURITY_APP_ATTESTATION.md).
  Not yet wired; the rate-limit + CAPTCHA + billing-cap layers cover the cost
  threat in the meantime.

---

## 3. Data protection & privacy

- **Health data** (diet, weight) is treated as sensitive.
- **Sentry:** `sendDefaultPii: false` plus a `beforeSend` hook that strips
  `event.user` and `event.request` so identity/request data can't ride along in
  an error report ([`App.tsx`](App.tsx)). The logger is silent in production and
  only forwards real errors.
- **Local data hygiene:** on sign-out / account deletion all app-owned keys are
  cleared (`clearLocalAppData` in `AuthContext`) so data never leaks to the next
  account on a shared device.
- **Account & data deletion:** [`delete-account`](supabase/functions/delete-account/index.ts)
  removes the profile (cascades all rows) and the auth user — App Store 5.1.1(v)
  / Google Play compliant.

---

## 4. Secrets management

| Secret | Where it lives | Notes |
|---|---|---|
| Supabase **anon key** | `eas.json` env, bundled in the app | Public by design; gated by RLS. |
| Supabase **service_role** | Edge Function env only | Never in client/bundle/git. |
| `GEMINI_API_KEY`, `USDA_API_KEY` | Edge Function secrets | Never in client/bundle. |
| `EXPO_PUBLIC_HCAPTCHA_SITE_KEY` | `eas.json` / `.env` (public site key) | Site key is meant to be public. |
| hCaptcha **secret key** | Supabase Dashboard only | Never in the app or `eas.json`. |

- `.env` is git-ignored; verified it is **not** tracked. `*.apk` / `*.zip` are
  git-ignored so binaries (which contain the anon key) aren't committed.
- **Rotation:** rotate `GEMINI_API_KEY` / `USDA_API_KEY` via `supabase secrets
  set` and the service-role key from the Dashboard if ever exposed. The anon key
  rotates from the Dashboard (forces a client rebuild).

---

## 5. Row Level Security (RLS) + tests

- RLS is **enabled** on `profiles`, `food_entries`, `quick_add_items`,
  `weight_entries`, `ai_suggestions`. Each has owner-scoped SELECT/INSERT/UPDATE/
  DELETE policies (`auth.uid() = user_id`, or `= id` for `profiles`).
- `ai_usage` has RLS enabled with **no policies** — i.e. unreachable by any
  client; only the SECURITY DEFINER RPC can touch it.
- **Regression test:** [`supabase/rls_test.sql`](supabase/rls_test.sql) seeds two
  users in a transaction, asserts cross-user reads/writes are denied, and rolls
  back. Run it after any policy change:
  ```sh
  npx supabase db execute --file supabase/rls_test.sql   # against a NON-prod DB
  ```

---

## 6. Deployment — order matters

> ⚠️ **Apply SQL before deploying the functions.** The rate limiter is
> fail-closed: if `consume_ai_quota` doesn't exist yet, every AI call is blocked.

1. **Database** (idempotent; re-runnable):
   ```sh
   npx supabase db execute --file supabase/rate_limit.sql     # ai_usage + consume_ai_quota
   npx supabase db execute --file supabase/supabase_schema.sql  # RLS, search_path, unique index, UPDATE policy
   ```
2. **Edge Functions** (redeploy after any change; keep them self-contained):
   ```sh
   npx supabase functions deploy food-ai
   npx supabase functions deploy food-ai-audio
   npx supabase functions deploy delete-account
   ```
3. **Mobile build.** New native modules were added (`expo-secure-store`,
   `expo-crypto`, `@hcaptcha/react-native-hcaptcha`, `react-native-webview`,
   `expo-linking`) — they require a **dev-client / EAS build**, not Expo Go, and
   an existing binary won't pick them up without rebuilding:
   ```sh
   eas build --profile development        # or: npx expo run:ios / run:android
   ```
4. **Hard billing cap (do this regardless of everything else):** in Google AI
   Studio / Cloud Billing set a budget + alert (e.g. $20/day) and an API quota
   cap for Gemini; for OpenRouter set a credit limit. This is the last line of
   defense if every other limiter is bypassed.

---

## 7. Dashboard hardening checklist (owner action)

Most of these are flagged by **Supabase → Advisors → Security**.

- [ ] **Leaked password protection** (HaveIBeenPwned) ON — *Auth → Providers → Email*.
- [ ] **Minimum password strength/length** raised — same page.
- [ ] **Email confirmation** required — same page.
- [ ] **MFA / TOTP** enabled — *Auth → MFA*.
- [ ] **Auth rate limits** reviewed — *Auth → Rate Limits*.
- [ ] **CAPTCHA**: provider hCaptcha + paste the **secret** key — *Auth → Bot and Abuse Protection*. ⚠️ Enforcement is **global**: only enable it in the same release that ships `EXPO_PUBLIC_HCAPTCHA_SITE_KEY`, or existing clients get 400s.
- [ ] **Recovery redirect URL**: add `kaloriez://reset-password` (and the `exp://…` dev URL) — *Auth → URL Configuration → Redirect URLs*, or the recovery email won't reopen the app.
- [ ] **Verify JWT** stays ON for all three Edge Functions (never deploy with `--no-verify-jwt`).
- [ ] **SSL enforced + Network Restrictions** — *Project Settings → Database*.
- [ ] **Security Advisor** shows zero findings.

---

## 8. CI & dependency hygiene

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push/PR:
- `npm run typecheck`
- `npm test` (jest)
- `npm audit --audit-level=high` (SCA; informational, non-blocking)

Keep dependencies current; review `npm audit` output periodically and patch
high/critical advisories.

---

## 9. Residual risks & accepted decisions

| Item | Status | Rationale |
|---|---|---|
| **App Attest / Play Integrity** | Deferred (guide written) | Rate-limit + CAPTCHA + billing cap cover the cost threat; iOS cert-chain verification doesn't run in Supabase's Deno runtime today — see the guide for the two viable paths. |
| **Wildcard CORS** (`*`) on Edge Functions | Accepted | CORS is browser-enforced only; a `curl` script ignores it, so it does **not** stop the abuse threat. The real gates are JWT + RLS + rate limit. Locking it risks the web build for ~zero gain. |
| **Certificate pinning** | Accepted residual | Low priority for a Supabase-hosted TLS backend; revisit if the threat model changes. |
| **Recovery deep link** | Implemented, not device-tested | Logic covers PKCE/OTP/implicit flows; verify end-to-end on a real dev build. |

---

## 10. Periodic tasks

- **Per release:** redeploy changed Edge Functions; re-run `rls_test.sql` if
  policies changed; confirm Security Advisor is clean.
- **Monthly:** review `ai_usage` for abusive patterns; check the Gemini/OpenRouter
  spend vs. the billing cap; review `npm audit`.
- **As needed:** rotate keys on any suspected exposure.

---

## 11. Reporting a vulnerability

Found a security issue? **Do not open a public GitHub issue.** Email
**117mgd@gmail.com** with steps to reproduce and impact. You'll get an
acknowledgement within a few days. Please give a reasonable window to fix before
any public disclosure. We don't run a paid bounty program but credit reporters
who want it.

---

## 12. References

- Implementation guide: [`docs/SECURITY_APP_ATTESTATION.md`](docs/SECURITY_APP_ATTESTATION.md)
- OWASP MASVS: https://mas.owasp.org/MASVS/
- OWASP Mobile Top 10: https://owasp.org/www-project-mobile-top-10/
- OWASP API Security Top 10: https://owasp.org/API-Security/
- Supabase RLS: https://supabase.com/docs/guides/auth/row-level-security
- Supabase Auth CAPTCHA: https://supabase.com/docs/guides/auth/auth-captcha
