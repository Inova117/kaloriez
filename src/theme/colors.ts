// Iron Rooster - Bold Fitness Aesthetic (Target: Men 18-40)
// Extracted from Mascot:
// - Purple (Muscles): #8B5CF6 (Violet)
// - Indigo (Shorts):  #4338CA (Indigo)
// - Amber (Beak):     #F59E0B (Amber)
// - White (Chest):    #FFFFFF

export const palette = {
    white: '#FFFFFF',
    offWhite: '#F3F4F6', // Cool Gray 100

    // Primary Brand Colors
    violet: '#7C3AED',   // Violet 600 (Bold Action)
    indigo: '#4338CA',   // Indigo 700 (Structure/Text)
    amber: '#F59E0B',    // Amber 500 (Energy/Highlights)

    // Status
    emerald: '#10B981',  // Success
    rose: '#EF4444',     // Error
    slate: '#1E293B',    // Dark Text
    slateLight: '#64748B',
} as const;

export const colors = {
    // 1. Base Layer (Clean & Professional)
    background: palette.offWhite,

    // 2. Surface Layer (Strong Cards)
    cardBackground: palette.white,
    cardBorder: 'rgba(67, 56, 202, 0.1)', // Subtle Indigo hint
    inputBackground: '#E5E7EB', // Gray 200 (Solid, not wispy)

    // 3. Typography (High Contrast)
    textPrimary: palette.slate,       // Sharp Dark Gray
    textSecondary: palette.slateLight,
    textMuted: '#94A3B8',
    textDimmed: '#CBD5E1',
    textInverse: palette.white,

    // 4. Accents & Actions (Mascot Colors)
    accent: palette.violet,           // Main Button/Action (Purple Muscles)
    accentSubtle: 'rgba(124, 58, 237, 0.1)',
    accentHighlight: palette.amber,   // Beak/Gold (Highlights/Stars)

    // 5. Functional
    favorite: palette.amber,          // Gold Stars
    success: palette.emerald,
    error: palette.rose,
    warning: palette.amber,

    // 6. Meal Colors (Mascot Derived)
    mealBreakfast: palette.amber,  // Morning Energy => Beak Yellow
    mealLunch: palette.violet,     // Power Meal => Muscle Purple
    mealDinner: palette.indigo,    // Recovery => Shorts Blue
    mealSnacks: palette.emerald,   // Healthy bit

    // Ghost Elements
    ghostBorder: 'rgba(0, 0, 0, 0.08)',
    ghostBorderHover: 'rgba(0, 0, 0, 0.15)',

    // Raw Palette Access (for charts specific needs)
    indigo: palette.indigo,
    amber: palette.amber,
} as const;

export type ColorKey = keyof typeof colors;
