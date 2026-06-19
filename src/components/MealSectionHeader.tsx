import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MealType, MEAL_CONFIGS } from '../types';
import { colors } from '../theme/colors';

interface MealSectionHeaderProps {
    mealType: MealType;
    totalCalories: number;
    itemCount: number;
    isExpanded: boolean;
    onToggle: () => void;
    onAddPress: () => void;
}

export function MealSectionHeader({
    mealType,
    totalCalories,
    itemCount,
    isExpanded,
    onToggle,
    onAddPress,
}: MealSectionHeaderProps) {
    const config = MEAL_CONFIGS[mealType];

    return (
        <View style={styles.container}>
            <Pressable style={styles.headerContent} onPress={onToggle}>
                <View style={styles.leftSection}>
                    <View>
                        <Text style={styles.title}>{config.label}</Text>
                        {itemCount > 0 && (
                            <Text style={styles.subtitle}>{itemCount} {itemCount === 1 ? 'item' : 'items'}</Text>
                        )}
                    </View>
                </View>

                <View style={styles.rightSection}>
                    {totalCalories > 0 && (
                        <>
                            <Text style={styles.calories}>{totalCalories}</Text>
                            <Text style={styles.unit}> cal</Text>
                        </>
                    )}
                </View>
            </Pressable>

            {isExpanded && (
                <Pressable style={styles.addButton} onPress={onAddPress}>
                    <Ionicons name="add" size={18} color={colors.textSecondary} />
                </Pressable>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: colors.background,
        borderBottomWidth: 1,
        borderBottomColor: colors.cardBorder,
    },
    headerContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    leftSection: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    title: {
        fontSize: 12,
        fontWeight: '400',
        color: colors.textPrimary,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    subtitle: {
        fontSize: 10,
        color: colors.textMuted,
        marginTop: 1,
    },
    rightSection: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginRight: 8,
    },
    calories: {
        fontSize: 13,
        fontWeight: '400',
        color: colors.textPrimary,
    },
    unit: {
        fontSize: 10,
        color: colors.textMuted,
        fontWeight: '400',
    },
    addButton: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: colors.inputBackground,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.cardBorder,
    },
});
