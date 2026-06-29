// Tactile Sanctuary - Warm Minimalist Aesthetic
// Philosophy: Physical, warm, human. Like a personal journal.
// Core: Sage Green #7B896F
// Backgrounds: Warm off-whites, cream, paper tones (NO pure white)

import { Appearance, Platform } from 'react-native';

export const THEME_PREF_KEY = '@theme_pref';
export type ThemePref = 'system' | 'light' | 'dark';

export const palette = {
    // Warm Neutrals (NO pure white)
    cream: '#FAF8F5',        // Warm off-white background
    paper: '#F5F3EF',        // Soft paper tone
    linen: '#EFEBE6',        // Warm beige for cards
    
    // Primary: Sage Green
    sage: '#7B896F',         // Primary accent - calm, natural
    sageDark: '#5F6B58',     // Darker sage for hover states
    sageLight: '#E8EBE6',    // Very light sage for subtle backgrounds
    
    // Warm Grays (for text) — darkened so muted/dimmed text meets WCAG contrast
    // on the cream background (previous #9EABA2 / #C8C8C5 were ~2.2:1 / ~1.6:1).
    charcoal: '#2C3E35',     // Deep sage green/grey for primary text
    stone: '#566054',        // Secondary text (~5:1 on cream)
    pebble: '#5E6A5D',       // Muted hints/labels (~5:1 on cream)
    mist: '#79827A',         // Dimmed placeholders/units (~3.5:1 on cream)
    
    // Soft Pastels (for feedback)
    softGreen: '#A8C5A0',    // Success - soft pastel green
    softRose: '#D4A5A5',     // Error - soft pastel rose
    softAmber: '#E5C9A1',    // Warning - soft pastel amber
} as const;

interface ThemeColors {
    background: string; cardBackground: string; cardBorder: string; inputBackground: string;
    textPrimary: string; textSecondary: string; textMuted: string; textDimmed: string; textInverse: string;
    accent: string; accentSubtle: string; accentHighlight: string;
    favorite: string; success: string; error: string; warning: string;
    mealBreakfast: string; mealLunch: string; mealDinner: string; mealSnacks: string;
    ghostBorder: string; ghostBorderHover: string;
    sage: string; sageDark: string; sageLight: string;
}

const lightColors: ThemeColors = {
    // 1. Base Layer (Warm & Cozy)
    background: palette.cream,        // Warm off-white, never pure white

    // 2. Surface Layer (Tactile Cards)
    cardBackground: palette.linen,    // Warm beige cards
    cardBorder: 'rgba(123, 137, 111, 0.12)', // Subtle sage hint
    inputBackground: palette.paper,   // Soft paper tone for inputs

    // 3. Typography (Warm & Readable)
    textPrimary: palette.charcoal,    // Warm dark gray
    textSecondary: palette.stone,     // Medium warm gray
    textMuted: palette.pebble,        // Light warm gray
    textDimmed: palette.mist,         // Very light warm gray
    textInverse: palette.cream,       // Cream instead of white

    // 4. Accents & Actions (Sage Green)
    accent: palette.sage,             // Sage green for all primary actions
    accentSubtle: 'rgba(123, 137, 111, 0.08)',
    accentHighlight: palette.sageDark,

    // 5. Functional (Soft Pastels)
    favorite: palette.softAmber,      // Soft amber for favorites
    success: palette.softGreen,       // Soft pastel green
    error: palette.softRose,          // Soft pastel rose
    warning: palette.softAmber,       // Soft pastel amber

    // 6. Meal Colors (Sage-derived warm tones)
    mealBreakfast: '#B8A88A',  // Warm morning beige
    mealLunch: '#8FA882',      // Fresh green
    mealDinner: '#7B896F',     // Sage green
    mealSnacks: '#A8C5A0',     // Soft green

    // Ghost Elements (Warm borders)
    ghostBorder: 'rgba(58, 58, 56, 0.06)',
    ghostBorderHover: 'rgba(58, 58, 56, 0.12)',

    // Raw Palette Access
    sage: palette.sage,
    sageDark: palette.sageDark,
    sageLight: palette.sageLight,
};

// Warm DARK palette — same keys so every screen themes correctly without
// touching component styles. Deep sage-greys instead of cream, light text,
// a slightly brighter sage accent for contrast on dark surfaces.
const darkColors: ThemeColors = {
    background: '#1B1E1A',
    cardBackground: '#262B24',
    cardBorder: 'rgba(168, 197, 160, 0.16)',
    inputBackground: '#2F352D',
    textPrimary: '#ECEFE9',
    textSecondary: '#BBC4B6',
    textMuted: '#8E988B',
    textDimmed: '#6F786D',
    textInverse: '#1B1E1A',
    accent: '#9DB390',
    accentSubtle: 'rgba(157, 179, 144, 0.14)',
    accentHighlight: '#B7C9AC',
    favorite: '#E5C9A1',
    success: '#A8C5A0',
    error: '#D4A5A5',
    warning: '#E5C9A1',
    mealBreakfast: '#B8A88A',
    mealLunch: '#8FA882',
    mealDinner: '#9DB390',
    mealSnacks: '#A8C5A0',
    ghostBorder: 'rgba(255, 255, 255, 0.08)',
    ghostBorderHover: 'rgba(255, 255, 255, 0.14)',
    sage: palette.sage,
    sageDark: palette.sageDark,
    sageLight: palette.sageLight,
};

// Resolve the active scheme once at startup. On web a user override is stored in
// localStorage (readable synchronously here), and the ThemeContext reloads the
// page to re-resolve — so the in-app toggle works instantly on web. On native we
// follow the OS at launch (a live in-app override would require threading a theme
// context through every screen's static StyleSheet).
function resolveScheme(): 'light' | 'dark' {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        const p = localStorage.getItem(THEME_PREF_KEY);
        if (p === 'light' || p === 'dark') return p;
    }
    return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
}

export const colors: ThemeColors = resolveScheme() === 'dark' ? darkColors : lightColors;

export type ColorKey = keyof ThemeColors;
