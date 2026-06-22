import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';

interface AuthContextType {
    session: Session | null;
    user: User | null;
    loading: boolean;
    signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
    signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
    signOut: () => Promise<void>;
    deleteAccount: () => Promise<{ error: Error | null }>;
}

// All app-owned local keys, cleared on sign out / account deletion so health
// data never persists into the next account on a shared device.
async function clearLocalAppData(): Promise<void> {
    try {
        const allKeys = await AsyncStorage.getAllKeys();
        const appKeys = allKeys.filter(k =>
            k.startsWith('@entries_') ||
            k.startsWith('@migrated_') ||
            [
                '@weight_history',
                '@daily_goal',
                '@weekly_weight_goal',
                '@favorite_items',
                '@user_profile',
                '@has_completed_onboarding',
                '@user_session',
                '@auth_token',
            ].includes(k)
        );
        if (appKeys.length > 0) {
            await AsyncStorage.multiRemove(appKeys);
        }
    } catch (error) {
        logger.error('Error clearing local app data', error);
    }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
        });

        return () => subscription.unsubscribe();
    }, []);

    const signUp = async (email: string, password: string, fullName?: string) => {
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                    },
                },
            });

            if (error) throw error;

            if (data.user) {
                const { error: profileError } = await supabase.from('profiles').insert({
                    id: data.user.id,
                    email: data.user.email,
                    full_name: fullName || null,
                    daily_calorie_goal: 2000,
                });
                // Don't fail the signup, but surface it so a missing profile row
                // (e.g. blocked by email-confirmation gating) is observable.
                if (profileError) logger.error('Failed to create profile row on signup', profileError);
            }

            return { error: null };
        } catch (error: any) {
            return { error };
        }
    };

    const signIn = async (email: string, password: string) => {
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
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

    return (
        <AuthContext.Provider value={{ session, user, loading, signUp, signIn, signOut, deleteAccount }}>
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
