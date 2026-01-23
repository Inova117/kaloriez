import { StyleSheet, Platform } from 'react-native';
import { colors } from './colors';

export const typography = StyleSheet.create({
    // Headers - Premium tracking
    labelSmall: {
        fontSize: 13,
        fontWeight: '500',
        letterSpacing: 1,
        color: colors.textMuted,
        textTransform: 'uppercase',
    },
    dateHeader: {
        fontSize: 32,
        fontWeight: '700',
        color: colors.textPrimary,
        letterSpacing: -1, // tracking-tight
    },
    calorieCount: {
        fontSize: 48,
        fontWeight: '600',
        color: colors.textPrimary,
        letterSpacing: -2,
        ...Platform.select({
            ios: { fontVariant: ['tabular-nums'] },
            android: { fontFamily: 'monospace' },
        }),
    },
    calorieUnit: {
        fontSize: 18,
        fontWeight: '400',
        color: colors.textSecondary,
    },

    // Body - Clean and minimal
    foodName: {
        fontSize: 16,
        fontWeight: '400',
        color: colors.textPrimary,
        letterSpacing: -0.2,
    },
    cardCalories: {
        fontSize: 15,
        fontWeight: '500',
        color: colors.textSecondary,
        letterSpacing: 0,
        ...Platform.select({
            ios: { fontVariant: ['tabular-nums'] },
            android: { fontFamily: 'monospace' },
        }),
    },
    cardUnit: {
        fontSize: 13,
        fontWeight: '400',
        color: colors.textDimmed,
    },

    // Ghost Chips
    chipText: {
        fontSize: 14,
        fontWeight: '400',
        color: colors.textSecondary,
    },

    // Input
    inputText: {
        fontSize: 16,
        fontWeight: '400',
        color: colors.textPrimary,
        letterSpacing: -0.2,
    },
    placeholder: {
        fontSize: 16,
        fontWeight: '400',
        color: colors.textDimmed,
    },
});
