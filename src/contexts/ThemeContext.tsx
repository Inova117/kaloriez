import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Platform, Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { THEME_PREF_KEY, ThemePref } from '../theme/colors';
import { logger } from '../utils/logger';

/**
 * Theme preference (Sistema / Claro / Oscuro).
 *
 * Web: the choice is mirrored to localStorage and the page reloads, so colors.ts
 * re-resolves the palette instantly. Native: the static StyleSheets are resolved
 * at launch, so a live swap there needs a full theme-context refactor — for now
 * native follows the OS; the stored preference is kept for when that lands.
 */
interface ThemeContextValue {
    pref: ThemePref;
    setPref: (p: ThemePref) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [pref, setPrefState] = useState<ThemePref>('system');

    useEffect(() => {
        AsyncStorage.getItem(THEME_PREF_KEY)
            .then((v) => { if (v === 'light' || v === 'dark' || v === 'system') setPrefState(v); })
            .catch(() => {});
    }, []);

    const setPref = useCallback(async (p: ThemePref) => {
        setPrefState(p);
        try { await AsyncStorage.setItem(THEME_PREF_KEY, p); }
        catch (error) { logger.error('Theme preference save failed', error); }

        if (Platform.OS === 'web' && typeof localStorage !== 'undefined' && typeof window !== 'undefined') {
            if (p === 'system') localStorage.removeItem(THEME_PREF_KEY);
            else localStorage.setItem(THEME_PREF_KEY, p);
            window.location.reload(); // re-resolve colors.ts with the new scheme
        } else {
            // Native hint (full apply on next launch with the current static-style setup).
            Appearance.setColorScheme(p === 'system' ? null : p);
        }
    }, []);

    return (
        <ThemeContext.Provider value={{ pref, setPref }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme(): ThemeContextValue {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
    return ctx;
}
