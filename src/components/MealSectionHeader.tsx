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
                    <Ionicons
                        name={isExpanded ? 'chevron-down' : 'chevron-forward'}
                        size={18}
                        color={colors.textSecondary}
                        style={styles.chevron}
                    />
                    <Text style={styles.icon}>{config.icon}</Text>
                    <View>
                        <Text style={styles.title}>{config.label}</Text>
                        <Text style={styles.subtitle}>{itemCount} items</Text>
                    </View>
                </View>

                <View style={styles.rightSection}>
                    <Text style={styles.calories}>{totalCalories}</Text>
                    <Text style={styles.unit}> kcal</Text>
                </View>
            </Pressable>

            <Pressable style={styles.addButton} onPress={onAddPress}>
                <Ionicons name="add" size={20} color={colors.textSecondary} />
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: colors.background,
        marginTop: 12,
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
    chevron: {
        marginRight: 8,
    },
    icon: {
        fontSize: 20,
        marginRight: 12,
    },
    title: {
        fontSize: 17,
        fontWeight: '600',
        color: colors.textPrimary,
    },
    subtitle: {
        fontSize: 12,
        color: colors.textMuted,
        marginTop: 2,
    },
    rightSection: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginRight: 12,
    },
    calories: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    unit: {
        fontSize: 12,
        color: colors.textMuted,
    },
    addButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.cardBackground,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.cardBorder,
    },
});
