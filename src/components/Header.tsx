import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { RollingNumber } from './RollingNumber';
import { typography } from '../theme/typography';
import { formatDisplayDate, isToday } from '../utils/dateUtils';

interface HeaderProps {
    totalCalories: number;
    dailyGoal: number;
    currentDate: Date;
    onGoalPress?: () => void;
    onDatePress?: () => void;
    onTodayPress?: () => void;
    onStatsPress?: () => void;
    onLogoutPress?: () => void;
}

export function Header({
    totalCalories,
    dailyGoal,
    currentDate,
    onGoalPress,
    onDatePress,
    onTodayPress,
    onStatsPress,
    onLogoutPress
}: HeaderProps) {
    const dateDisplay = formatDisplayDate(currentDate);
    const isCurrentDay = isToday(currentDate);

    return (
        <View style={styles.container}>
            <View style={styles.topRow}>
                {!isCurrentDay ? (
                    <Pressable onPress={onTodayPress} style={styles.todayButton}>
                        <Ionicons name="arrow-undo-outline" size={14} color={colors.accent} />
                        <Text style={styles.todayText}>Today</Text>
                    </Pressable>
                ) : (
                    <View style={{ width: 60 }} />
                )}

                <Pressable onPress={onDatePress} style={styles.dateButton}>
                    <View style={styles.dateRow}>
                        <Text style={styles.date}>{dateDisplay}</Text>
                        <Ionicons name="chevron-down" size={12} color={colors.textDimmed} style={styles.chevron} />
                    </View>
                </Pressable>

                <View style={styles.rightButtons}>
                    <Pressable onPress={onStatsPress} style={styles.statsButton}>
                        <Ionicons name="stats-chart" size={20} color={colors.textSecondary} />
                    </Pressable>
                    {onLogoutPress && (
                        <Pressable onPress={onLogoutPress} style={styles.logoutButton}>
                            <Ionicons name="log-out-outline" size={20} color={colors.textSecondary} />
                        </Pressable>
                    )}
                </View>
            </View>

            <View style={styles.caloriesContainer}>
                <View style={styles.calorieRow}>
                    <RollingNumber
                        value={totalCalories}
                        style={styles.calories}
                    />
                    <Text style={styles.separator}> / </Text>
                    <Pressable onPress={onGoalPress}>
                        <Text style={styles.goal}>{dailyGoal}</Text>
                    </Pressable>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 16,
        alignItems: 'center',
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        width: '100%',
        marginBottom: 8,
    },
    todayButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        padding: 8,
        marginLeft: -8,
    },
    todayText: {
        fontSize: 13,
        fontWeight: '400',
        color: colors.accent,
    },
    rightButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    statsButton: {
        padding: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoutButton: {
        padding: 8,
        marginRight: -8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dateButton: {
        alignItems: 'center',
        paddingVertical: 4,
        paddingHorizontal: 16,
    },
    dateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    label: {
        fontSize: 11,
        fontWeight: '400',
        color: colors.textSecondary,
        letterSpacing: 1.5,
        marginBottom: 2,
        textAlign: 'center',
    },
    date: {
        fontSize: 15,
        fontWeight: '400',
        color: colors.textMuted,
    },
    chevron: {
        marginTop: 2,
    },
    caloriesContainer: {
        alignItems: 'center',
    },
    calorieRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    calories: {
        ...typography.calorieCount,
        fontSize: 48,
        letterSpacing: -2,
    },
    separator: {
        fontSize: 32,
        fontWeight: '300',
        color: colors.textDimmed,
        marginHorizontal: 4,
    },
    goal: {
        fontSize: 32,
        fontWeight: '400',
        color: colors.textMuted,
        letterSpacing: -1,
    },
});
