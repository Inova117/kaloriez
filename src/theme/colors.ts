// Tactile Sanctuary - Warm Minimalist Aesthetic
// Philosophy: Physical, warm, human. Like a personal journal.
// Core: Sage Green #7B896F
// Backgrounds: Warm off-whites, cream, paper tones (NO pure white)

export const palette = {
    // Warm Neutrals (NO pure white)
    cream: '#FAF8F5',        // Warm off-white background
    paper: '#F5F3EF',        // Soft paper tone
    linen: '#EFEBE6',        // Warm beige for cards
    
    // Primary: Sage Green
    sage: '#7B896F',         // Primary accent - calm, natural
    sageDark: '#5F6B58',     // Darker sage for hover states
    sageLight: '#E8EBE6',    // Very light sage for subtle backgrounds
    
    // Warm Grays (for text)
    charcoal: '#2C3E35',     // Deep sage green/grey for primary text
    stone: '#6B7A70',        // Lighter sage for secondary text
    pebble: '#9EABA2',       // Even lighter for hints/placeholders
    mist: '#C8C8C5',         // Very light warm gray
    
    // Soft Pastels (for feedback)
    softGreen: '#A8C5A0',    // Success - soft pastel green
    softRose: '#D4A5A5',     // Error - soft pastel rose
    softAmber: '#E5C9A1',    // Warning - soft pastel amber
} as const;

export const colors = {
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
} as const;

export type ColorKey = keyof typeof colors;
