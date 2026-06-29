/**
 * Premium entitlements — scaffolding.
 *
 * The app is FREE right now: `PREMIUM_ENABLED` is false, so `canUseFeature()`
 * returns true for everything regardless of subscription. Nothing is gated.
 *
 * To start charging later:
 *   1. Wire a real subscription source in PremiumContext (RevenueCat / StoreKit
 *      / Google Play Billing / a Supabase `subscriptions` row).
 *   2. Flip PREMIUM_ENABLED to true.
 *   3. Gate UI with `usePremium().canUse('<feature>')` and show an upgrade
 *      prompt when it returns false.
 *   4. Enforce the AI quota difference server-side (free vs premium) by passing
 *      the user's tier into consume_ai_quota in the Edge Functions — the client
 *      check is UX only; the real cost gate must be on the server.
 *
 * Usage example (no-op while PREMIUM_ENABLED is false):
 *   const { canUse } = usePremium();
 *   if (!canUse('voice_logging')) return <UpgradePrompt feature="voice_logging" />;
 */

export type PremiumFeature =
    | 'ai_unlimited'    // unlimited AI text logging (free tier gets a daily cap)
    | 'voice_logging'   // voice dictation of meals
    | 'macros'          // macro (protein/carbs/fat) goals
    | 'advanced_stats'  // trends, weight projection, goal line
    | 'data_export';    // export my data

/**
 * MASTER SWITCH. While false the whole app is free — canUseFeature() always
 * returns true. Flip to true to begin enforcing premium.
 */
export const PREMIUM_ENABLED = false;

/** Which features require premium once PREMIUM_ENABLED is true. */
export const PREMIUM_FEATURES: Record<PremiumFeature, boolean> = {
    ai_unlimited: true,
    voice_logging: true,
    macros: true,
    advanced_stats: true,
    data_export: true,
};

/**
 * Planned free-tier limits (for display and future server-side enforcement).
 * The live server cap today is higher (see supabase/rate_limit.sql); lower these
 * for free users when premium launches.
 */
export const FREE_LIMITS = {
    aiLogsPerDay: 10,
    voiceLogsPerDay: 0, // voice is premium-only in the planned model
};

export function isPremiumFeature(feature: PremiumFeature): boolean {
    return PREMIUM_FEATURES[feature] === true;
}

/** Pure entitlement check. Returns true (allowed) for everything while free. */
export function canUseFeature(feature: PremiumFeature, isPremium: boolean): boolean {
    if (!PREMIUM_ENABLED) return true;          // everything free for now
    if (!isPremiumFeature(feature)) return true; // free feature
    return isPremium;
}
