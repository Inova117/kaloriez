import { StyleSheet, Platform } from 'react-native';
import { colors } from './colors';

export const typography = StyleSheet.create({
    // Headers - Elegant & Light
    labelSmall: {
        fontSize: 12,
        fontWeight: '400',
        letterSpacing: 1.2,
        color: colors.textMuted,
        textTransform: 'uppercase',
    },
    dateHeader: {
        fontSize: 32,
        fontWeight: '300',
        color: colors.textPrimary,
        letterSpacing: -0.5,
    },
    calorieCount: {
        fontSize: 48,
        fontWeight: '300',
        color: colors.textPrimary,
        letterSpacing: -1,
        ...Platform.select({
            ios: { fontVariant: ['tabular-nums'] },
            android: { fontFamily: 'monospace' },
        }),
    },
    calorieUnit: {
        fontSize: 18,
        fontWeight: '300',
        color: colors.textSecondary,
    },

    // Body - Light & Refined
    foodName: {
        fontSize: 16,
        fontWeight: '300',
        color: colors.textPrimary,
        letterSpacing: 0,
    },
    cardCalories: {
        fontSize: 15,
        fontWeight: '400',
        color: colors.textSecondary,
        letterSpacing: 0.2,
        ...Platform.select({
            ios: { fontVariant: ['tabular-nums'] },
            android: { fontFamily: 'monospace' },
        }),
    },
    cardUnit: {
        fontSize: 13,
        fontWeight: '300',
        color: colors.textDimmed,
    },

    // Ghost Chips
    chipText: {
        fontSize: 14,
        fontWeight: '300',
        color: colors.textSecondary,
    },

    // Input
    inputText: {
        fontSize: 16,
        fontWeight: '300',
        color: colors.textPrimary,
        letterSpacing: 0.2,
    },
    placeholder: {
        fontSize: 16,
        fontWeight: '300',
        color: colors.textDimmed,
    },
});
