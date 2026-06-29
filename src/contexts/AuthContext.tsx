import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';
import { clearFoodMemoryCache } from '../services/foodMemory';
import * as Linking from 'expo-linking';

interface AuthContextType {
    session: Session | null;
    user: User | null;
    loading: boolean;
    // True after a password-recovery deep link is processed; the app then shows
    // the "set a new password" screen until clearPasswordRecovery() is called.
    passwordRecovery: boolean;
    signUp: (email: string, password: string, fullName?: string, captchaToken?: string) => Promise<{ error: Error | null }>;
    signIn: (email: string, password: string, captchaToken?: string) => Promise<{ error: Error | null }>;
    signOut: () => Promise<void>;
    deleteAccount: () => Promise<{ error: Error | null }>;
    resetPassword: (email: string, captchaToken?: string) => Promise<{ error: Error | null }>;
    updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
    clearPasswordRecovery: () => void;
}

// Extract auth params from a deep link's query string AND/OR URL fragment.
// Supabase uses the fragment for the implicit flow and the query for PKCE/OTP,
// so we accept both.
function parseAuthParams(url: string): Record<string, string> {
    const out: Record<string, string> = {};
    const start = url.search(/[?#]/);
    if (start === -1) return out;
    const raw = url.slice(start + 1).replace(/[?#]/g, '&');
    for (const pair of raw.split('&')) {
        if (!pair) continue;
        const idx = pair.indexOf('=');
        const k = decodeURIComponent(idx === -1 ? pair : pair.slice(0, idx));
        const v = idx === -1 ? '' : decodeURIComponent(pair.slice(idx + 1));
        if (k) out[k] = v;
    }
    return out;
}

// All app-owned local keys, cleared on sign out / account deletion so health
// data never persists into the next account on a shared device.
async function clearLocalAppData(): Promise<void> {
    try {
        const allKeys = await AsyncStorage.getAllKeys();
        const appKeys = allKeys.filter(k =>
            k.startsWith('@entries_') ||
            k.startsWith('@migrated_') ||
            k.startsWith('@food_memory') ||
            [
                '@weight_history',
                '@daily_goal',
                '@weekly_weight_goal',
                '@favorite_items',
                '@user_profile',
                '@has_completed_onboarding',
                '@user_session',
                '@auth_token',
                '@is_premium',
            ].includes(k)
        );
        if (appKeys.length > 0) {
            await AsyncStorage.multiRemove(appKeys);
        }
        clearFoodMemoryCache();
    } catch (error) {
        logger.error('Error clearing local app data', error);
    }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [passwordRecovery, setPasswordRecovery] = useState(false);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            // Fired by supabase-js when it processes a recovery link itself (web).
            if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
        });

        return () => subscription.unsubscribe();
    }, []);

    // Password-recovery deep links. detectSessionInUrl is false on native, so we
    // parse the incoming URL ourselves and establish the recovery session via
    // whichever flow Supabase used (PKCE code / OTP token_hash / implicit tokens).
    useEffect(() => {
        const handleUrl = async (url: string | null) => {
            if (!url || !url.includes('reset-password')) return;
            const p = parseAuthParams(url);
            try {
                if (p.code) {
                    const { error } = await supabase.auth.exchangeCodeForSession(p.code);
                    if (error) throw error;
                } else if (p.token_hash) {
                    const { error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: p.token_hash });
                    if (error) throw error;
                } else if (p.access_token && p.refresh_token) {
                    const { error } = await supabase.auth.setSession({
                        access_token: p.access_token,
                        refresh_token: p.refresh_token,
                    });
                    if (error) throw error;
                } else {
                    return; // recovery path but no usable token
                }
                setPasswordRecovery(true);
            } catch (error) {
                logger.error('Password recovery link handling failed', error);
            }
        };

        // Cold start (app opened by the link) + warm events (already running).
        Linking.getInitialURL().then(handleUrl);
        const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
        return () => sub.remove();
    }, []);

    const signUp = async (email: string, password: string, fullName?: string, captchaToken?: string) => {
        try {
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                    },
                    // Only set when present; omitting it keeps today's behavior
                    // exactly when CAPTCHA is disabled (no site key configured).
                    ...(captchaToken ? { captchaToken } : {}),
                },
            });

            if (error) throw error;

            // The profile row is created server-side by the on_auth_user_created
            // trigger (see supabase_schema.sql), which works even with email
            // confirmation enabled. No client-side insert needed.
            return { error: null };
        } catch (error: any) {
            return { error };
        }
    };

    const signIn = async (email: string, password: string, captchaToken?: string) => {
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
                // Only attach options when a token exists; otherwise behavior is
                // identical to before (no CAPTCHA enforcement on the client).
                ...(captchaToken ? { options: { captchaToken } } : {}),
            });

            if (error) throw error;

            return { error: null };
        } catch (error: any) {
            return { error };
        }
    };

    const signOut = async () => {
        // Supabase's own session keys are removed by signOut(); clearLocalAppData
        // then wipes our app data so it never leaks to the next account.
        await supabase.auth.signOut();
        await clearLocalAppData();
    };

    const deleteAccount = async () => {
        try {
            const { error } = await supabase.functions.invoke('delete-account');
            if (error) throw error;
            await clearLocalAppData();
            await supabase.auth.signOut();
            return { error: null };
        } catch (error: any) {
            logger.error('Account deletion failed', error);
            return { error };
        }
    };

    // Sends the recovery email. The link points back at the app's
    // reset-password deep link (see the URL handler above). captchaToken is
    // forwarded because this endpoint is also CAPTCHA-protected when enabled.
    const resetPassword = async (email: string, captchaToken?: string) => {
        try {
            const redirectTo = Linking.createURL('reset-password');
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo,
                ...(captchaToken ? { captchaToken } : {}),
            });
            if (error) throw error;
            return { error: null };
        } catch (error: any) {
            return { error };
        }
    };

    // Sets the new password for the recovery session established by the link.
    const updatePassword = async (newPassword: string) => {
        try {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;
            return { error: null };
        } catch (error: any) {
            logger.error('Password update failed', error);
            return { error };
        }
    };

    const clearPasswordRecovery = () => setPasswordRecovery(false);

    return (
        <AuthContext.Provider value={{ session, user, loading, passwordRecovery, signUp, signIn, signOut, deleteAccount, resetPassword, updatePassword, clearPasswordRecovery }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
