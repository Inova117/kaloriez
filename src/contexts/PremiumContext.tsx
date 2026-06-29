import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';
import { PremiumFeature, canUseFeature, PREMIUM_ENABLED } from '../lib/premium';

/**
 * Holds the current user's premium entitlement and exposes a feature-gate
 * helper. Today the source is a locally-stored flag (no billing yet); swap
 * `refresh()` for a real subscription lookup when payments are wired.
 */
export const IS_PREMIUM_KEY = '@is_premium';

interface PremiumContextValue {
    isPremium: boolean;
    premiumEnabled: boolean;
    loading: boolean;
    /** True if the feature is available to this user (always true while free). */
    canUse: (feature: PremiumFeature) => boolean;
    /** Set entitlement — for dev/testing now, and for billing callbacks later. */
    setPremium: (value: boolean) => Promise<void>;
    refresh: () => Promise<void>;
}

const PremiumContext = createContext<PremiumContextValue | undefined>(undefined);

export function PremiumProvider({ children }: { children: React.ReactNode }) {
    const [isPremium, setIsPremium] = useState(false);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        try {
            // TODO: replace with real subscription status (RevenueCat / StoreKit /
            // Google Play Billing / Supabase) when billing is wired.
            const raw = await AsyncStorage.getItem(IS_PREMIUM_KEY);
            setIsPremium(raw === '1');
        } catch (error) {
            logger.error('Premium status load failed', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { refresh(); }, [refresh]);

    const setPremium = useCallback(async (value: boolean) => {
        setIsPremium(value);
        try {
            await AsyncStorage.setItem(IS_PREMIUM_KEY, value ? '1' : '0');
        } catch (error) {
            logger.error('Premium status save failed', error);
        }
    }, []);

    const canUse = useCallback(
        (feature: PremiumFeature) => canUseFeature(feature, isPremium),
        [isPremium]
    );

    return (
        <PremiumContext.Provider value={{ isPremium, premiumEnabled: PREMIUM_ENABLED, loading, canUse, setPremium, refresh }}>
            {children}
        </PremiumContext.Provider>
    );
}

export function usePremium(): PremiumContextValue {
    const ctx = useContext(PremiumContext);
    if (!ctx) throw new Error('usePremium must be used within a PremiumProvider');
    return ctx;
}
