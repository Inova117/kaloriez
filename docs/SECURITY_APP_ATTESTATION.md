# App Attestation for Kaloriez — Apple App Attest (iOS) + Google Play Integrity (Android)

> **Status:** implementation guide / not yet implemented.
> **Goal:** make it so that **only the genuine Kaloriez app binary, running on a genuine device, can call the paid Supabase Edge Functions** (`food-ai`, `food-ai-audio`). This is a defense-in-depth layer; it does **not** replace the existing per-user rate limiter or the planned CAPTCHA.
>
> **Confidence note up front:** the iOS server-side verification has a known hard limitation in Supabase's Deno runtime (X.509 cert-chain validation), documented in §5. The Android path is more straightforward. Read §9 before deciding to build this — for a solo founder who already has rate-limiting + (planned) CAPTCHA + billing caps, the honest recommendation is **defer this until after launch**.
>
> Targets confirmed from the repo: bundle id / package `com.zerionstudio.caloriecounter`, Expo SDK ~54, RN 0.81.5, React 19.1.0, `newArchEnabled: true`, `expo-dev-client` present, EAS profiles `development` / `preview` / `apk` / `production`.

---

## 1. Why — the threat and how attestation closes it

### The threat

The Supabase **anon key is public by design** (it is baked into the app bundle and gated by RLS). The Edge Functions `food-ai` and `food-ai-audio` are invoked with a **user JWT**, and that JWT is obtained through normal email/password auth.

The concrete attack we care about:

> An attacker extracts the bundled anon key (trivial — it ships in the APK/IPA), signs up for (or scripts the creation of) accounts, obtains JWTs, and then runs a **curl/Node script** that hammers `food-ai` / `food-ai-audio`. Each call costs us money (Gemini + USDA). The attacker never runs our app at all.

Our existing layers limit but do **not** close this:

| Layer | What it stops | What it does NOT stop |
|---|---|---|
| **RLS** (`auth.uid() = user_id` on all tables) | Reading/writing *other users'* data | A valid user burning their own quota / mass account creation |
| **Per-user rate limiter** (`consume_ai_quota`, 6/min·100/day for `food-ai`, 3/min·30/day for `food-ai-audio`) | One account's *total spend* | An attacker creating **many** accounts, each within budget |
| **CAPTCHA** (planned: hCaptcha on signUp/signInWithPassword) | *Mass automated account creation* | A determined attacker who solves/farms a smaller number of CAPTCHAs, then scripts those accounts from curl |

The gap: **scripted backend abuse from a non-genuine client.** A valid JWT + the public anon key + `curl` is enough to reach the paid call, as long as each account stays under quota.

### How attestation closes it

App Attestation proves a different fact than auth does:

- **JWT proves:** *"this is user X."*
- **Rate limiter proves:** *"user X is within budget."*
- **CAPTCHA proves:** *"a human (probably) created this account."*
- **Attestation proves:** *"this request came from the **genuine, unmodified Kaloriez binary** running on a **genuine, uncompromised device**."*

A `curl` script cannot produce a valid attestation/assertion, because:

- **iOS (App Attest):** the assertion is signed by a private key that lives in the **Secure Enclave** and never leaves the device; the key is bound to our exact App ID (`teamID.com.zerionstudio.caloriecounter`). An attacker cannot forge a signature without a real device running our app.
- **Android (Play Integrity):** Google itself attests the app + device and returns a token Google signs; the verdict says whether the binary is a Play-recognized build on a device that `MEETS_DEVICE_INTEGRITY`.

So attestation specifically kills the *"extracted anon key + curl script"* threat — even on iOS where we may not pin the cert chain to Apple's root (see §5), an attacker still cannot mint a valid Secure-Enclave-bound assertion off-device.

### Where it sits (defense in depth — keep all four)

```
Request to food-ai / food-ai-audio
   │
   ├─ (0) Edge "Verify JWT" platform gate  ── rejects unauthenticated callers
   ├─ (1) getUser()                          ── identifies the user (RLS-scoped client)
   ├─ (2) ATTESTATION GATE  ◀── NEW          ── proves genuine app + device
   ├─ (3) withinQuota(...)                    ── caps per-user spend  (DO NOT CHANGE)
   └─ (4) paid Gemini / USDA call
```

Attestation goes **after** `getUser()` (so the challenge is scoped to the user) and **before** `withinQuota()` (so a bot can't burn a legit user's quota by triggering the limiter). CAPTCHA lives entirely on the **auth** path (signUp / signIn), not here. **Do not remove or alter the `withinQuota` logic** — it is the cost backstop and defends a different layer.

---

## 2. Architecture / request flow

Both platforms share one server-side challenge table and the same "challenge → attest → send token in header → verify → allow" shape. They diverge only in the client SDK and the server verification math.

```
┌─────────────┐                         ┌──────────────────────────┐        ┌──────────────┐
│  Kaloriez    │                         │ Supabase Edge Function    │        │ Apple/Google  │
│  app (RN)    │                         │ (food-ai / food-ai-audio  │        │ attestation   │
│              │                         │  or attest-register)      │        │ backends      │
└──────┬───────┘                         └────────────┬─────────────┘        └──────┬───────┘
       │                                              │                              │
       │ 1. issue_attest_challenge() (RPC, JWT)        │                              │
       │─────────────────────────────────────────────▶│ INSERT challenge (user-      │
       │ {challengeId, challenge}                       │  scoped, 5-min TTL)          │
       │◀─────────────────────────────────────────────│                              │
       │                                              │                              │
       │ 2a. iOS: generateAssertionAsync(keyId, hash) │                              │
       │ 2b. Android: requestIntegrityCheckAsync(hash)│   (token signed by Apple/    │
       │     hash = base64url(SHA256(challenge+body)) │    Google on-device)          │
       │                                              │                              │
       │ 3. invoke food-ai with body {query} and       │                              │
       │    HEADERS: x-attest-platform, x-attest-keyId,│                              │
       │    x-attest-token, x-attest-challenge-id      │                              │
       │─────────────────────────────────────────────▶│                              │
       │                                              │ 4. consume_attest_challenge  │
       │                                              │    (single-use, RPC)          │
       │                                              │ 5a iOS: verify assertion      │
       │                                              │    (WebCrypto ECDSA +         │
       │                                              │     counter)                  │
       │                                              │ 5b Android: decodeIntegrity   │
       │                                              │    Token ─────────────────────▶│ verdict
       │                                              │◀───────────────────────────────│
       │                                              │ 6. withinQuota()              │
       │                                              │ 7. paid Gemini/USDA call      │
       │ {suggestions}                                 │                              │
       │◀─────────────────────────────────────────────│                              │
```

**Why a header, not the JSON body:** putting the attestation in headers (`x-attest-*`) keeps the existing request bodies (`{ query }`, audio payload) untouched and lets the gate be a single early check. The research-finding snippets pass it in the JSON `body.integrity`; either works. This doc standardizes on **headers** so the gate is body-shape-agnostic across `food-ai` (text) and `food-ai-audio` (binary/multipart). Pick one and be consistent.

**One-time vs per-request (iOS):** App Attest has a one-time **attestation** (register the Secure Enclave key with the server) plus a per-request **assertion**. Android Play Integrity (Standard request) has no separate registration — you `prepare` a token provider once and `request` a token per call.

---

## 3. iOS — Apple App Attest

### Library

Use the **official** `expo-app-integrity` package (npm: `@expo/app-integrity`, from the `expo/expo` monorepo, documented at `docs.expo.dev/versions/latest/sdk/app-integrity`). It ships an Expo config plugin (no manual native edits), exposes App Attest directly, and is maintained by Expo.

> ⚠️ **Two different packages share the name `expo-app-integrity`.** The official one is `@expo/app-integrity` (in the Expo docs). A community package by `jeffDevelops` has a different, smaller API. **Use the official one.** An earlier doc fetch mistakenly claimed the official package runs in Expo Go / needs no rebuild — **that is wrong**; it requires a dev/EAS build (verified caveat).

The real iOS API surface is **exactly** these (do **not** assume more):

- `AppIntegrity.isSupported` — constant (boolean).
- `generateKeyAsync(): Promise<string>` — creates the Secure Enclave key, returns the `keyId`.
- `attestKeyAsync(keyId, challenge): Promise<string>` — returns base64 attestation. **Call once per key** (Apple rejects re-attestation).
- `generateAssertionAsync(keyId, clientDataB64): Promise<string>` — returns base64 assertion (per request).

### Hard requirements (these will bite you)

- **NOT Expo Go.** App Attest needs the `com.apple.developer.devicecheck.appattest-environment` entitlement → a custom dev client / EAS build. (`expo-dev-client` is already a dependency.)
- **NOT the iOS Simulator.** You need a **real device** + a **paid Apple Developer account**.
- **iOS 14+.**
- The entitlement value must match the build: `development` for dev/TestFlight-from-Xcode, `production` for App Store. The **AAGUID** in the attestation reflects this (`appattestdevelop` in dev, `appattest` in prod) — a mismatch fails verification.

### Config plugin (app.json)

```jsonc
// app.json -> "expo": { "plugins": [ ... ] }
[
  "@expo/app-integrity",
  {
    // Android needs the Cloud project NUMBER here (see §4); iOS App Attest
    // needs no plugin args but the plugin still wires the capability.
    "androidCloudProjectNumber": "<GOOGLE_CLOUD_PROJECT_NUMBER>"
  }
]
```

### Apple Developer console steps

1. **Apple Developer → Certificates, Identifiers & Profiles → Identifiers →** your App ID `com.zerionstudio.caloriecounter`. Confirm it is an **explicit** App ID (not wildcard). App Attest / DeviceCheck is available implicitly for explicit App IDs (there is no separate toggle like Push).
2. Add the entitlement `com.apple.developer.devicecheck.appattest-environment` to the build. In Expo: set it via an `ios.entitlements` block in `app.json` (value `"development"` or `"production"`) or rely on the config plugin. In Xcode it's **Target → Signing & Capabilities → + Capability → App Attest**.
3. App Attest uses `teamID.bundleID` as the **App ID / rpId** — i.e. `<TEAM_ID>.com.zerionstudio.caloriecounter`. Your 10-char Team ID becomes an Edge Function secret (`APPLE_TEAM_ID`, §5).

### Dev-client rebuild

```bash
npx expo install @expo/app-integrity
eas build --profile development --platform ios   # then run on a REAL device
```

### Client code

```typescript
// src/lib/appAttest.ts
import * as AppIntegrity from '@expo/app-integrity';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { logger } from '../utils/logger';

const KEY_ID_STORAGE = 'appAttestKeyId';
const ATTESTED_FLAG = 'appAttestDone';

// Only the 3 real iOS functions exist.
export function attestSupported(): boolean {
  return Platform.OS === 'ios' && AppIntegrity.isSupported === true;
}

async function getOrCreateKeyId(): Promise<string> {
  const cached = await AsyncStorage.getItem(KEY_ID_STORAGE);
  if (cached) return cached;
  // keyId is NOT secret (the private key never leaves the Secure Enclave),
  // so AsyncStorage is acceptable.
  const keyId = await AppIntegrity.generateKeyAsync();
  await AsyncStorage.setItem(KEY_ID_STORAGE, keyId);
  return keyId;
}

/** Run ONCE per install. attestKeyAsync must only be called once per key. */
export async function registerAttestation(): Promise<boolean> {
  if (!attestSupported()) return false;
  try {
    const keyId = await getOrCreateKeyId();
    if (await AsyncStorage.getItem(ATTESTED_FLAG)) return true;

    // Server issues a one-time challenge (base64), persisted with a TTL.
    const { data: ch, error: chErr } = await supabase.functions.invoke('attest-register', {
      body: { phase: 'challenge', keyId },
    });
    if (chErr || !ch?.challenge) return false;

    const attestation = await AppIntegrity.attestKeyAsync(keyId, ch.challenge);

    const { data: res, error } = await supabase.functions.invoke('attest-register', {
      body: { phase: 'verify', keyId, challengeId: ch.challengeId, attestation },
    });
    if (error || !res?.ok) return false;
    await AsyncStorage.setItem(ATTESTED_FLAG, '1');
    return true;
  } catch (e) {
    // If the Secure Enclave key was lost (reinstall/restore), generateKeyAsync
    // returns a NEW keyId and you re-register; counter resets to 0 server-side.
    logger.error('registerAttestation failed', e);
    return false;
  }
}

/**
 * Per protected request. clientDataB64 should bind the call to the server
 * challenge (and optionally the request body). Returns null on non-iOS/failure.
 */
export async function makeAssertion(
  clientDataB64: string,
): Promise<{ keyId: string; assertion: string } | null> {
  if (!attestSupported()) return null;
  try {
    const keyId = await getOrCreateKeyId();
    const assertion = await AppIntegrity.generateAssertionAsync(keyId, clientDataB64);
    return { keyId, assertion };
  } catch (e) {
    logger.error('makeAssertion failed', e);
    return null;
  }
}
```

---

## 4. Android — Google Play Integrity

### Library

Use the same official **`@expo/app-integrity`** module — on Android it wraps Play Integrity's **Standard request** flow, on iOS it wraps App Attest, behind one JS API.

> ⚠️ **Version caveat (verified, medium confidence):** there is **no SDK-54-tagged release** of `@expo/app-integrity`. npm has `0.1.0`–`0.1.10` (pre-calendar-versioning, peerDeps `expo: *`, `react-native: *`) and then jumps to `55.0.0` (Jan 2026, calver). The `0.1.x` line overlapped the SDK-54 era and *can* install on 54 (wildcard peers) but is **not officially version-matched**. Cleanest path: **bump to Expo SDK 55** and use `@expo/app-integrity@55` (`sdk-55` dist-tag), where it is officially supported. Either way, validate in a dev-client build — it cannot run in Expo Go for production attestation.

Avoid third-party RN libs: `kedros/react-native-google-play-integrity` is stale (no Expo config plugin) and `erickcrus/react-native-play-integrity` is not on npm.

The Standard-request API:

- `prepareIntegrityTokenProviderAsync(cloudProjectNumber: string)` — call **once** after launch/sign-in. Re-prepare on `ERR_APP_INTEGRITY_PROVIDER_INVALID`.
- `requestIntegrityCheckAsync(requestHash: string): Promise<string>` — per protected call; returns the integrity token. Standard requests are **single-use and replay-protected by Google**.

### Two Google identifiers (easy to confuse)

- **Client** needs the **Cloud project NUMBER** (numeric, from Play Console → App integrity). Not the Supabase ref.
- **Server** needs the **package name** (in the decode URL) + a **service-account key**.

### Google Play Console + Cloud + service-account steps

1. **Play Console → your app → Release → App integrity (Play Integrity API).** Link it to a Google Cloud project → this gives the **Cloud project NUMBER** for `prepareIntegrityTokenProviderAsync`. Choose **Google-managed response encryption** (default) so you decode via the `decodeIntegrityToken` endpoint instead of holding keys.
2. **Google Cloud Console (the linked project) → APIs & Services → Library → Play Integrity API → Enable.**
3. **IAM & Admin → Service Accounts → Create.** No project-level IAM role is required for `decodeIntegrityToken` when the project is the one linked in Play Console. Create a **JSON key** and download it.
4. **Store the service account as Edge Function secrets** (never in the bundle, consistent with the `GEMINI_API_KEY` convention):
   ```bash
   supabase secrets set \
     PLAY_SA_CLIENT_EMAIL="...@...iam.gserviceaccount.com" \
     PLAY_SA_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----" \
     PLAY_PACKAGE_NAME="com.zerionstudio.caloriecounter"
   ```
   The Google key's `private_key` is already **PKCS#8** (`BEGIN PRIVATE KEY`), so WebCrypto `importKey('pkcs8', …)` takes it directly — no OpenSSL conversion. **Watch newline escaping** in the secret; a malformed key throws on `importKey`.

> ⚠️ **App-signing gotcha (verified):** Play Integrity verdicts `appRecognitionVerdict` / `appLicensingVerdict` are only correct for builds distributed **through Google Play with Play App Signing**. The current distribution is a **sideloaded standalone APK** (`apk` EAS profile) → it returns `UNRECOGNIZED_VERSION` / `UNLICENSED`. **Do not enforce `PLAY_RECOGNIZED` / `LICENSED` until you ship through Play** (internal-testing track is fine), or you'll lock out your own testers. `MEETS_DEVICE_INTEGRITY` still works off-Play.

### Client code

```typescript
// src/lib/attestation.ts (Android Standard request)
import * as AppIntegrity from '@expo/app-integrity';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { logger } from '../utils/logger';

// Play Console > App integrity (linked Cloud project NUMBER, as a string).
const CLOUD_PROJECT_NUMBER = process.env.EXPO_PUBLIC_PLAY_CLOUD_PROJECT_NUMBER ?? '';

let providerReady = false;

/** Call once after launch/sign-in. Safe to retry on provider-invalid. */
export async function prepareIntegrity(): Promise<void> {
  if (Platform.OS !== 'android') return; // iOS App Attest handled separately
  try {
    await AppIntegrity.prepareIntegrityTokenProviderAsync(CLOUD_PROJECT_NUMBER);
    providerReady = true;
  } catch (e) {
    providerReady = false;
    logger.error('prepareIntegrityTokenProvider failed', e);
  }
}

async function sha256Base64Url(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  let bin = '';
  for (const b of new Uint8Array(digest)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Returns {token, challengeId} for a protected call, or null (caller picks hard/soft fail). */
export async function attestRequest(
  canonicalBody: string,
): Promise<{ token: string; challengeId: string } | null> {
  if (Platform.OS !== 'android') return null;
  try {
    if (!providerReady) await prepareIntegrity();
    // One-time server challenge (shared table with iOS App Attest).
    const { data: ch, error: chErr } = await supabase.rpc('issue_attest_challenge');
    if (chErr || !ch?.id || !ch?.challenge) return null;
    const requestHash = await sha256Base64Url(`${ch.challenge}.${canonicalBody}`);
    const token = await AppIntegrity.requestIntegrityCheckAsync(requestHash);
    return { token, challengeId: ch.id };
  } catch (e: any) {
    if (String(e?.code) === 'ERR_APP_INTEGRITY_PROVIDER_INVALID') providerReady = false;
    logger.error('attestRequest failed', e);
    return null;
  }
}
```

Add `EXPO_PUBLIC_PLAY_CLOUD_PROJECT_NUMBER` to `.env` / `.env.example` and to the `preview` / `apk` / `production` `env` blocks in `eas.json` (same pattern already used for `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`).

---

## 5. Server-side verification (Deno Edge Function)

Per the **self-containment rule**, do **not** factor the verifier into a shared module — **inline it** in each function (`food-ai`, `food-ai-audio`), since they deploy individually. Import third-party libs from `esm.sh` with `?target=denonext`. The module-scope token cache (Android) is per-instance, which is fine.

### 5a. Android — Play Integrity (works fully in Supabase Deno)

Flow: sign a service-account JWT (RS256, WebCrypto) → exchange for a Google access token → POST the integrity token to `decodeIntegrityToken` → enforce verdict fields → check `requestHash` binding.

```typescript
// --- Play Integrity verification (self-contained; paste into the Edge Function) ---
// Secrets: PLAY_SA_CLIENT_EMAIL, PLAY_SA_PRIVATE_KEY (PKCS#8 PEM), PLAY_PACKAGE_NAME
const PLAY_SA_EMAIL = Deno.env.get('PLAY_SA_CLIENT_EMAIL') ?? '';
const PLAY_SA_KEY   = Deno.env.get('PLAY_SA_PRIVATE_KEY') ?? '';
const PLAY_PACKAGE  = Deno.env.get('PLAY_PACKAGE_NAME') ?? 'com.zerionstudio.caloriecounter';
const PLAY_SCOPE    = 'https://www.googleapis.com/auth/playintegrity';

function b64url(bytes: Uint8Array): string {
  let s = ''; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function pemToPkcs8(pem: string): ArrayBuffer {
  const body = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const raw = atob(body); const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out.buffer;
}

// Cache the Google access token (~1h) across invocations in module scope.
let _tok: { value: string; exp: number } | null = null;
async function getGoogleAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (_tok && _tok.exp - 60 > now) return _tok.value;
  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claim = b64url(new TextEncoder().encode(JSON.stringify({
    iss: PLAY_SA_EMAIL, scope: PLAY_SCOPE,
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  })));
  const signingInput = `${header}.${claim}`;
  const key = await crypto.subtle.importKey(
    'pkcs8', pemToPkcs8(PLAY_SA_KEY),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = new Uint8Array(await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput),
  ));
  const jwt = `${signingInput}.${b64url(sig)}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`token exchange ${res.status}`);
  const j = await res.json();
  _tok = { value: j.access_token, exp: now + (j.expires_in ?? 3600) };
  return _tok.value;
}

async function sha256B64Url(input: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input)));
  return b64url(d);
}

// True only if genuine AND bound to this request's challenge+body.
async function verifyPlayIntegrity(integrityToken: string, expectedRequestHash: string): Promise<boolean> {
  const accessToken = await getGoogleAccessToken();
  const url = `https://playintegrity.googleapis.com/v1/${PLAY_PACKAGE}:decodeIntegrityToken`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ integrity_token: integrityToken }),
  });
  if (!res.ok) { console.error('decodeIntegrityToken', res.status, await res.text()); return false; }
  const payload = (await res.json())?.tokenPayloadExternal;
  if (!payload) return false;

  const rd = payload.requestDetails ?? {};
  const app = payload.appIntegrity ?? {};
  const dev = payload.deviceIntegrity ?? {};
  const acct = payload.accountDetails ?? {};

  // 1) request binding (anti-replay + ties token to THIS call)
  if (rd.requestPackageName !== PLAY_PACKAGE) return false;
  if (rd.requestHash !== expectedRequestHash) return false;
  if (rd.timestampMillis && Date.now() - Number(rd.timestampMillis) > 5 * 60 * 1000) return false;

  // 2) app authenticity — ENABLE ONLY ONCE SHIPPED VIA PLAY (see gotcha):
  // if (app.appRecognitionVerdict !== 'PLAY_RECOGNIZED') return false;

  // 3) device integrity (the verdict that works off-Play too)
  const dv: string[] = dev.deviceRecognitionVerdict ?? [];
  if (!dv.includes('MEETS_DEVICE_INTEGRITY')) return false;

  // 4) licensing — ENABLE ONLY ONCE SHIPPED VIA PLAY:
  // if (acct.appLicensingVerdict && acct.appLicensingVerdict !== 'LICENSED') return false;

  return true;
}
```

**Verdict fields to enforce (Android):**

| Field | Enforce | When |
|---|---|---|
| `requestDetails.requestPackageName === com.zerionstudio.caloriecounter` | yes | always |
| `requestDetails.requestHash === expectedHash` | yes | always (replay + binding) |
| `deviceIntegrity.deviceRecognitionVerdict` includes `MEETS_DEVICE_INTEGRITY` | yes | always (works off-Play) |
| `appIntegrity.appRecognitionVerdict === PLAY_RECOGNIZED` | yes | **only after shipping via Play** |
| `accountDetails.appLicensingVerdict === LICENSED` | yes | **only after shipping via Play** |

Never cache or reuse integrity tokens (decoding a Standard token twice yields empty/unevaluated verdicts). **Do** cache the Google OAuth token (~1h).

### 5b. iOS — App Attest (assertion path works; cert-chain is the hard part)

> 🚨 **THE big, load-bearing limitation (verified, 2026 case study — Qiita / christhemart):** full **X.509 cert-chain verification to Apple's App Attest Root CA does NOT work reliably inside Supabase's Deno Edge runtime today.** Documented failures: `node:crypto`'s `X509Certificate` is unsupported; `@peculiar/x509` won't load via `esm.sh` **or** `npm:`; `pkijs` (via `node-app-attest`) crashes at boot assigning to a read-only `globalThis`; a hand-rolled ~600-line ASN.1 parser booted but failed real chain verification.
>
> **What DOES work in Supabase Deno:** CBOR decode (`cbor-x`), the SHA-256 nonce recompute, `rpIdHash` check, the counter check, and **ECDSA-P256 signature verification via WebCrypto**.

**Two trust-model options — decide up front:**

- **(a) Security-correct:** verify the chain-to-Apple-root **once at attestation time** in a runtime that supports X.509 (a tiny Cloudflare Worker / Deno Deploy / Node lambda using `@peculiar/x509`), called from the Edge Function. Pin Apple's root: `https://www.apple.com/certificateauthority/Apple_App_Attestation_Root_CA.pem`.
- **(b) Pragmatic:** accept **nonce-binding-to-leaf-cert** as your trust anchor (skip root pinning). This **still blocks the "extracted anon key + curl" threat** you actually care about — an attacker cannot forge a valid Secure-Enclave-bound attestation/assertion without a real device + the genuine App ID, even without root pinning. **Be honest about which you ship and document the residual risk.**

The per-request **assertion** path runs fully inside Supabase Deno either way.

```typescript
// supabase/functions/_appAttestVerify (INLINE per function; no shared import).
import { decode as cborDecode } from 'https://esm.sh/cbor-x@1.5.9?target=denonext';

const TEAM_ID = Deno.env.get('APPLE_TEAM_ID')!;          // 10-char team id
const BUNDLE_ID = 'com.zerionstudio.caloriecounter';
const APP_ID = `${TEAM_ID}.${BUNDLE_ID}`;                 // rpId
const DEV_ENV = (Deno.env.get('APPATTEST_ENV') ?? 'production') === 'development';

const te = new TextEncoder();
async function sha256(b: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', b));
}
function b64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}
function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length); out.set(a); out.set(b, a.length); return out;
}
function eq(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false; let r = 0;
  for (let i = 0; i < a.length; i++) r |= a[i] ^ b[i]; return r === 0;
}
// authData layout: rpIdHash(0..32) | flags(32) | signCount(33..37 BE) | ...
function rpIdHash(authData: Uint8Array) { return authData.subarray(0, 32); }
function signCount(authData: Uint8Array) {
  return new DataView(authData.buffer, authData.byteOffset).getUint32(33);
}

// ---- ATTESTATION (run once at registration) ----
export async function verifyAttestation(attestationB64: string, challengeB64: string, keyId: string) {
  const obj: any = cborDecode(b64ToBytes(attestationB64));
  if (obj.fmt !== 'apple-appattest') throw new Error('bad_fmt');
  const authData: Uint8Array = obj.authData;
  const x5c: Uint8Array[] = obj.attStmt.x5c;          // [leafDER, intermediateDER]
  const leafDER = x5c[0];

  // 2-4) nonce = SHA256(authData || SHA256(challenge)); must equal the leaf cert
  //      extension OID 1.2.840.113635.100.8.2 (an OCTET STRING).
  const clientDataHash = await sha256(b64ToBytes(challengeB64));
  const nonce = await sha256(concat(authData, clientDataHash));
  if (!leafHasNonceExtension(leafDER, nonce)) throw new Error('nonce_mismatch');

  // 5) keyId == base64(SHA256(leaf EC pubkey raw point, 65 bytes 0x04||X||Y))
  const pubRaw = extractEcP256RawPoint(leafDER);        // 65 bytes
  const keyIdHash = await sha256(pubRaw);
  if (btoa(String.fromCharCode(...keyIdHash)) !== keyId) throw new Error('keyId_mismatch');

  // 6) rpIdHash == SHA256(appId)
  if (!eq(rpIdHash(authData), await sha256(te.encode(APP_ID)))) throw new Error('rpId_mismatch');
  // 7) counter must be 0 at attestation
  if (signCount(authData) !== 0) throw new Error('signCount_nonZero');
  // 8) AAGUID == 'appattestdevelop' (dev) or 'appattest' (prod)
  const aaguid = new TextDecoder().decode(authData.subarray(37, DEV_ENV ? 53 : 46));
  if (aaguid !== (DEV_ENV ? 'appattestdevelop' : 'appattest')) throw new Error('aaguid_mismatch');

  // 1) CERT-CHAIN to Apple root — THE HARD PART. Option (a) external verifier OR
  //    option (b) accept nonce-binding-to-leaf. See the limitation box above.
  // await verifyChainToAppleRoot(x5c);  // external or skipped (your call)

  // Persist pubRaw + signCount=0 keyed by keyId for assertion checks.
  return { publicKeyRaw: pubRaw, signCount: 0 };
}

// ---- ASSERTION (per protected request) — fully works in Supabase Deno ----
export async function verifyAssertion(
  assertionB64: string, clientDataB64: string,
  publicKeyRaw: Uint8Array, storedCounter: number,
) {
  const obj: any = cborDecode(b64ToBytes(assertionB64));
  const authData: Uint8Array = obj.authenticatorData;
  const sigDER: Uint8Array = obj.signature;           // ECDSA P-256, DER-encoded

  // 1-3) nonce = SHA256(authData || SHA256(clientData)); verify ECDSA(nonce).
  const clientDataHash = await sha256(b64ToBytes(clientDataB64));
  const nonce = await sha256(concat(authData, clientDataHash));
  const key = await crypto.subtle.importKey(
    'raw', publicKeyRaw, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'],
  );
  // CRITICAL: WebCrypto wants raw r||s (64 bytes), NOT DER. Convert first or it
  // silently fails. (Node infers this from the key; Deno/WebCrypto does not.)
  const sigRaw = derToRawEcdsa(sigDER, 32);
  const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, sigRaw, nonce);
  if (!ok) throw new Error('signature_verification');
  // 4) rpIdHash == SHA256(appId)
  if (!eq(rpIdHash(authData), await sha256(te.encode(APP_ID)))) throw new Error('rpId_mismatch');
  // 5-6) counter MUST be strictly greater than the stored one (anti-replay).
  const c = signCount(authData);
  if (c <= storedCounter) throw new Error('counter_replay');
  return { newCounter: c };
}

// ECDSA DER (SEQUENCE{INTEGER r, INTEGER s}) -> fixed r||s.
function derToRawEcdsa(der: Uint8Array, size: number): Uint8Array {
  let o = 2; if (der[1] & 0x80) o += der[1] & 0x7f;
  const readInt = () => { o++; const len = der[o++]; let v = der.subarray(o, o + len); o += len;
    while (v.length > size) v = v.subarray(1); return v; };
  const r = readInt(), s = readInt();
  const out = new Uint8Array(size * 2);
  out.set(r, size - r.length); out.set(s, size * 2 - s.length); return out;
}
// extractEcP256RawPoint / leafHasNonceExtension: small TLV walkers over the leaf
// DER cert — (a) pull the 65-byte SPKI EC point, (b) find ext 1.2.840.113635.100.8.2's
// inner OCTET STRING and compare to nonce. These two are simple; the full chain
// check is the part that fails in Deno.
declare function extractEcP256RawPoint(der: Uint8Array): Uint8Array;
declare function leafHasNonceExtension(der: Uint8Array, nonce: Uint8Array): boolean;
declare function verifyChainToAppleRoot(x5c: Uint8Array[]): Promise<void>;
```

**Verification checklist (iOS):**

| Step | Attestation (once) | Assertion (per request) | Works in Deno? |
|---|---|---|---|
| CBOR decode | ✓ | ✓ | yes (`cbor-x`) |
| nonce = `SHA256(authData ‖ SHA256(challenge/clientData))` | ✓ | ✓ | yes |
| nonce matches leaf ext `1.2.840.113635.100.8.2` | ✓ | — | yes (TLV walk) |
| `keyId == base64(SHA256(leaf pubkey))` | ✓ | — | yes |
| `rpIdHash == SHA256(teamID.bundleID)` | ✓ | ✓ | yes |
| counter `== 0` (attest) / strictly increasing (assert) | ✓ | ✓ | yes |
| AAGUID matches env (`appattestdevelop`/`appattest`) | ✓ | — | yes |
| ECDSA-P256 signature (raw r‖s) | — | ✓ | yes (WebCrypto) |
| **cert-chain → Apple Root CA** | ✓ | — | **NO in Deno** → option (a) external, or (b) skip |

> ⚠️ The reference Node verifier uses `createVerify('RSA-SHA256')` for assertions — that only works in Node because it infers the algorithm from the EC key. In Deno you **must** use `{ name: 'ECDSA', hash: 'SHA-256' }` **and** convert DER → raw `r‖s` (64 bytes) first.

### Alternative that sidesteps the entire Deno cert-chain wall

The same 2026 case study ultimately abandoned native App Attest verification and adopted **Firebase App Check** (App Attest provider on iOS, Play Integrity on Android). The app gets a short-lived **JWT**; the Edge Function verifies only Firebase's JWT (~30 lines, JWKS from `firebaseappcheck.googleapis.com`, no X.509, no `pkijs`). `@react-native-firebase/app-check` has an Expo config plugin. **Strongly consider this** if the Deno cert-chain limitation is a dealbreaker — it trades an extra SDK + Google dependency for skipping the hardest part.

---

## 6. SQL — challenge / nonce + key-id storage

One shared challenge store serves both platforms. Two designs appear in the research; pick **one**:

### Design A — deny-all table + SECURITY DEFINER RPCs (recommended, simplest to reason about)

RLS enabled with **zero policies** → only the `SECURITY DEFINER` RPCs below can touch the table.

```sql
-- One challenge store for both iOS App Attest and Android Play Integrity.
CREATE TABLE IF NOT EXISTS public.attest_challenges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge   TEXT NOT NULL,                 -- base64url, >=16 bytes (App Attest needs this)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '5 minutes',
  consumed_at TIMESTAMPTZ
);
ALTER TABLE public.attest_challenges ENABLE ROW LEVEL SECURITY; -- deny-all to clients

-- Issue a fresh single-use challenge for the caller (auth.uid()).
CREATE OR REPLACE FUNCTION public.issue_attest_challenge()
RETURNS TABLE(id UUID, challenge TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid UUID := auth.uid(); ch TEXT; new_id UUID;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  ch := translate(encode(gen_random_bytes(32), 'base64'), '+/', '-_');  -- 32 bytes -> base64url
  ch := rtrim(ch, '=');
  INSERT INTO public.attest_challenges(user_id, challenge)
    VALUES (uid, ch) RETURNING public.attest_challenges.id INTO new_id;
  RETURN QUERY SELECT new_id, ch;
END; $$;
REVOKE ALL ON FUNCTION public.issue_attest_challenge() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_attest_challenge() TO authenticated;

-- Atomically consume a challenge: returns the text once, then never again.
CREATE OR REPLACE FUNCTION public.consume_attest_challenge(p_id UUID)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid UUID := auth.uid(); ch TEXT;
BEGIN
  IF uid IS NULL THEN RETURN NULL; END IF;
  UPDATE public.attest_challenges
     SET consumed_at = now()
   WHERE id = p_id AND user_id = uid
     AND consumed_at IS NULL AND expires_at > now()
  RETURNING challenge INTO ch;
  RETURN ch;  -- NULL if missing, expired, foreign, or already used
END; $$;
REVOKE ALL ON FUNCTION public.consume_attest_challenge(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_attest_challenge(UUID) TO authenticated;
```

### iOS key registry (App Attest only — stores the Secure Enclave pubkey + counter)

```sql
-- One genuine Secure-Enclave key per device, with the latest verified counter.
CREATE TABLE IF NOT EXISTS public.app_attest_keys (
  key_id       TEXT PRIMARY KEY,                  -- base64(SHA256(EC pubkey))
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  public_key   BYTEA NOT NULL,                    -- raw 65-byte P-256 point (or PEM)
  sign_count   BIGINT NOT NULL DEFAULT 0,         -- last verified assertion counter
  attested_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_attest_keys_user_idx ON public.app_attest_keys(user_id);

ALTER TABLE public.app_attest_keys ENABLE ROW LEVEL SECURITY;
-- Owner-scoped (mirror existing tables). The Edge Function uses the user's JWT
-- client (getUser().client), so these policies apply to its reads/writes too.
CREATE POLICY aak_select ON public.app_attest_keys FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY aak_iud    ON public.app_attest_keys FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Atomically bump the counter only if it strictly increased (anti-replay at the DB).
CREATE OR REPLACE FUNCTION public.bump_attest_counter(p_key_id TEXT, p_new BIGINT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE ok BOOLEAN;
BEGIN
  UPDATE public.app_attest_keys
     SET sign_count = p_new, last_seen_at = now()
   WHERE key_id = p_key_id AND user_id = auth.uid() AND p_new > sign_count
  RETURNING true INTO ok;
  RETURN COALESCE(ok, false);
END; $$;

-- Optional housekeeping (mirror cleanup_expired_suggestions).
CREATE OR REPLACE FUNCTION public.cleanup_expired_attest_challenges()
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  DELETE FROM public.attest_challenges WHERE expires_at < now();
$$;
```

### RLS / security notes

- **Track the counter per `key_id`, not per user** — a reinstall/restore yields a new `keyId` and resets the counter to 0.
- Challenges must be **one-time, server-generated, random (≥16–32 bytes), short-TTL, marked consumed**. Both the `consumed_at` flag and `expires_at` are enforced in the RPC.
- `SET search_path = ''` is used on every function (matches the Postgres-hardening recommendation: the linter flags `function_search_path_mutable`). With `''` you **must schema-qualify every relation** (`public.attest_challenges`, etc.) — done above.
- Design B (alternative): if you prefer owner-scoped *policies* on `attest_challenges` instead of deny-all + RPCs, add SELECT/INSERT/UPDATE/DELETE policies `USING (auth.uid() = user_id)`. Design A is recommended because the deny-all + `SECURITY DEFINER` RPC makes single-use consumption atomic and unforgeable from the client.

---

## 7. Integration — adding a `withAttestation()` gate

The gate goes **after `getUser()`** and **before `withinQuota()`** in both `food-ai/index.ts` and `food-ai-audio/index.ts`. The existing flow today is:

```typescript
// food-ai/index.ts (current)
const user = await getUser(req);
if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

if (!(await withinQuota(user.client, 6, 100))) {            // 6/min, 100/day
  return jsonResponse({ suggestions: [], error: "rate_limited" });
}
```

Add the gate (inline the verifiers from §5 in each function — no shared imports):

```typescript
// --- self-contained attestation gate (inline both verifiers from §5) ---
// Reads attestation from headers so the request BODY stays unchanged across
// food-ai (text) and food-ai-audio (binary/multipart).
async function withAttestation(req: Request, user: { id: string; client: DbClient }, canonicalBody: string): Promise<boolean> {
  const platform   = req.headers.get('x-attest-platform') ?? '';      // 'ios' | 'android'
  const token      = req.headers.get('x-attest-token') ?? '';
  const challengeId= req.headers.get('x-attest-challenge-id') ?? '';
  const keyId      = req.headers.get('x-attest-keyid') ?? '';

  // SOFT-LAUNCH: if nothing attached, log + allow (Phase 1). Flip to `return false`
  // (hard-fail) only in Phase 3 once telemetry shows legit clients send tokens.
  if (!platform || !token) { console.warn('attest_missing', { uid: user.id }); return ATTEST_SOFT; }

  // Consume the one-time challenge (user-scoped, atomic).
  const { data: challenge } = await user.client.rpc('consume_attest_challenge', { p_id: challengeId });
  if (!challenge) { console.warn('attest_challenge_invalid', { uid: user.id }); return ATTEST_SOFT; }

  try {
    if (platform === 'android') {
      const expectedHash = await sha256B64Url(`${challenge}.${canonicalBody}`);
      return await verifyPlayIntegrity(token, expectedHash);
    }
    if (platform === 'ios') {
      // clientData the client signed = base64url(challenge); load stored pubkey+counter.
      const { data: keyRow } = await user.client
        .from('app_attest_keys').select('public_key, sign_count')
        .eq('key_id', keyId).eq('user_id', user.id).maybeSingle();
      if (!keyRow) return ATTEST_SOFT;                         // not registered yet
      const clientDataB64 = btoa(challenge);
      const { newCounter } = await verifyAssertion(
        token, clientDataB64, keyRow.public_key as Uint8Array, Number(keyRow.sign_count),
      );
      const { data: bumped } = await user.client.rpc('bump_attest_counter', { p_key_id: keyId, p_new: newCounter });
      return bumped === true;
    }
    return false;
  } catch (e) {
    console.error('attest_verify_failed', String(e));
    return false;
  }
}

const ATTEST_SOFT = (Deno.env.get('ATTEST_ENFORCE') ?? 'soft') !== 'hard';
```

Wire it into the handler, **between** `getUser` and `withinQuota`:

```typescript
const user = await getUser(req);
if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

// NEW: attestation gate (before the quota check so bots can't burn a real
// user's quota). canonicalBody must match what the client hashed.
const canonicalBody = JSON.stringify({ query: String((await req.clone().json().catch(() => ({}))).query ?? "") });
if (!(await withAttestation(req, user, canonicalBody))) {
  return jsonResponse({ suggestions: [], error: "attestation_failed" }, 403);
}

if (!(await withinQuota(user.client, 6, 100))) {   // UNCHANGED — do not alter
  return jsonResponse({ suggestions: [], error: "rate_limited" });
}
```

For `food-ai-audio` the only differences are the quota numbers (`withinQuota(user.client, 3, 30)`, unchanged) and the `canonicalBody` derivation (the audio payload isn't JSON — hash a stable representation, e.g. a header-supplied digest of the audio bytes, and have the client hash the same thing). **Do not change the existing `withinQuota` calls.**

> The research snippets pass attestation in `body.integrity` instead of headers. That is equally valid; if you choose the body approach for `food-ai`, you must still handle `food-ai-audio`'s non-JSON body. Headers avoid that asymmetry.

---

## 8. Phased rollout — don't lock out legit users

Attestation **fails-closed by default**, which is dangerous: it breaks **web** (`react-native-web` has no App Attest/Play Integrity), **iOS until App Attest is built**, **sideloaded APKs** (no `PLAY_RECOGNIZED`), **older OS / no Play Services**, **emulators/simulators in dev**, **app reinstalls before re-registration**, and **transient Apple/Google outages**. The app already degrades gracefully (returns `[]` on AI failure), so prefer soft enforcement first.

### Phase 1 — soft-launch (log only) — `ATTEST_ENFORCE=soft`

- Ship the **client** changes (token generation) and the **server** verification, but `withAttestation` returns `true` (allow) on missing/invalid tokens — it only **logs** (`attest_missing`, `attest_challenge_invalid`, `attest_verify_failed`).
- Run for a release or two. Watch the logs / Sentry: what fraction of real traffic carries a *valid* token? Which platforms/OS versions fail?
- The **rate limiter remains the cost backstop** throughout.

### Phase 2 — platform/audience gating

- Enforce **Android** first (Play Integrity verification is robust in Deno; no cert-chain wall). Gate it specifically: only require attestation when `x-attest-platform === 'android'` **and** the build is shipped via Play (so `PLAY_RECOGNIZED`/`LICENSED` are meaningful). Keep a **dev/internal-testing bypass** (an allowlist of test user ids, or `ATTEST_ENFORCE=soft` on the dev project).
- Keep iOS soft until you've decided the cert-chain trust model (§5b option a/b) or adopted Firebase App Check.

### Phase 3 — hard enforce — `ATTEST_ENFORCE=hard`

- Flip to `return false` on missing/invalid tokens (the handler then returns 403 → client degrades to local estimate). Only after telemetry shows ≥ your acceptable threshold of legit traffic carries valid tokens.
- Still **fail-OPEN on transient backend errors** (e.g. Google `decodeIntegrityToken` 5xx, token-exchange failure) so a Google/Apple outage doesn't take Kaloriez down — distinguish "verification said NO" (block) from "couldn't verify" (allow + alert).

### Jailbroken / rooted / older OS

- **Android:** `MEETS_DEVICE_INTEGRITY` already excludes most rooted/tampered devices. A stricter `MEETS_STRONG_INTEGRITY` exists but excludes many legitimate older/AOSP devices — for a Mexico-market app with diverse hardware, `MEETS_DEVICE_INTEGRITY` is the right bar; don't over-tighten.
- **iOS:** App Attest simply won't produce a key on jailbroken/unsupported devices → `attestSupported()` is false → those users fall into the soft path (or are blocked in hard mode, which is the intent).
- **Older OS / no Play Services / web:** these legitimately cannot attest. Decide per platform whether to allow (soft) and lean on the rate limiter, or block. For a calorie app, allowing them while the limiter caps spend is the user-friendly default.

---

## 9. Honest limitations, cost/effort, and the recommendation

### Limitations (be honest)

- **iOS cert-chain wall (the big one):** full chain-to-Apple-root validation does **not** work in Supabase Deno (verified, §5b). You either stand up an external verifier (more infra) or accept nonce-binding-to-leaf (weaker, but still blocks the curl-script threat). This is the single biggest reason this is hard.
- **Sideloaded-APK reality:** your current distribution is a sideloaded standalone APK → Play Integrity returns `UNRECOGNIZED_VERSION`/`UNLICENSED`. You can't enforce app-recognition until you ship through Google Play. `MEETS_DEVICE_INTEGRITY` works, but full value requires Play distribution.
- **Version churn:** `@expo/app-integrity` has no SDK-54 tag; the clean path implies an SDK 55 bump (a separate migration with its own risk).
- **Native build coupling:** every config change needs a new EAS build; no Expo Go; iOS needs a real device + paid Apple account. Slower iteration.
- **Not a silver bullet:** attestation proves "genuine app on genuine device," not "reasonable usage." It is **complementary** to the rate limiter and CAPTCHA — you keep all three.
- **Fail-open exposure during outages:** to avoid self-inflicted downtime you must fail-open on *transient* verification errors, which momentarily reopens the curl-script gap during an Apple/Google outage. Acceptable, but real.

### Cost / effort for a solo founder

- **Monetary:** hCaptcha free tier; Play Integrity Standard requests have generous quotas; App Attest is free crypto; an external iOS cert-chain verifier (option a) is ~free on Cloudflare Workers / Deno Deploy. **Net ~$0** beyond the existing Apple Developer / Play accounts.
- **Effort (rough):**
  - Android-only, Play Integrity, soft→hard: **~2–4 focused days** (client wiring, one Edge verifier, SQL, Play Console + service-account setup, testing on internal track).
  - iOS App Attest **with** the cert-chain wall (option a, external verifier): **+3–6 days** and ongoing infra to maintain. Option b (skip root pinning): less, but you ship a documented weaker model.
  - **Firebase App Check alternative:** likely **less** total effort than hand-rolled iOS App Attest because it sidesteps the Deno cert-chain problem (~30-line JWT verify), at the cost of a Google/Firebase dependency.

### Recommendation: defer until after launch

Given that Kaloriez **already** has (or has planned) three independent defenses against the threat this addresses —

1. **per-user rate limiter** (`consume_ai_quota`, fail-closed) capping per-account AI spend,
2. **CAPTCHA** (planned) blocking mass account creation, and
3. **billing caps** on the AI provider as a hard cost ceiling,

— the **marginal risk reduction from attestation does not justify its cost/complexity pre-launch**, especially with the iOS Deno cert-chain wall and the sideloaded-APK limitation that blocks the most valuable Android verdicts until you're on Play.

**Concrete plan:**

1. **Now (pre-launch):** ship CAPTCHA + keep the rate limiter + set a hard AI-provider billing cap. These close the economic incentive for the curl-script attack (an attacker can't make it cheap or scalable, and your downside is bounded by the billing cap).
2. **At/after launch, once shipping via Google Play:** implement **Android Play Integrity** first (no cert-chain wall, biggest bang for the buck once on Play), soft → hard per §8.
3. **iOS, only if abuse is observed:** evaluate **Firebase App Check** before hand-rolling native App Attest, specifically to avoid the Supabase-Deno cert-chain problem.

In short: **the rate limiter + CAPTCHA + billing cap make this a post-launch, abuse-driven enhancement, not a launch blocker.** Build it when real traffic shows the curl-script threat is actually materializing.

---

## Sources / confidence

- iOS App Attest in Supabase Deno (cert-chain wall): 2026 case study (Qiita, christhemart). **Confidence: medium.** The assertion-path crypto is verified to work in Deno; the chain-validation failure is the documented finding.
- `@expo/app-integrity` API + version caveats: Expo docs + npm version history. **Confidence: medium** (no SDK-54 tag; SDK-55 path is the supported one).
- Play Integrity Standard request + `decodeIntegrityToken` verdict fields: Google Play Integrity docs. **Confidence: medium**; the sideloaded-APK verdict behavior is verified.
- hCaptcha / rate-limiter / Supabase hardening context: prior research findings in repo memory. **Confidence: high** for the existing-layer descriptions (matches the live `food-ai`/`food-ai-audio` code: `getUser` → `withinQuota(6,100)` / `(3,30)`).
- Any client API beyond the four iOS functions / two Android functions listed is **not** assumed — if a detail isn't above, treat it as unverified and confirm against the official Expo docs in a dev-client build before relying on it.
