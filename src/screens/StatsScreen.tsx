import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { WeeklyChart } from '../components/WeeklyChart';
import { WeightTracker } from '../components/WeightTracker';
import { getLastNDays, formatDateKey } from '../utils/dateUtils';
import { loadEntriesForDateRange } from '../utils/storageUtils';
import { fetchEntriesForRange } from '../services/entriesRepository';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GOAL_STORAGE_KEY = '@daily_goal';
const DEFAULT_GOAL = 2000;

interface StatsScreenProps {
    onClose: () => void;
}

interface DailyStat {
    dayLabel: string;
    date: Date;
    calories: number;
}

export function StatsScreen({ onClose }: StatsScreenProps) {
    const { user } = useAuth();
    const [weeklyData, setWeeklyData] = useState<DailyStat[]>([]);
    const [dailyGoal, setDailyGoal] = useState(DEFAULT_GOAL);
    const [averageCalories, setAverageCalories] = useState(0);

    useEffect(() => {
        loadData();
    }, [user?.id]);

    const loadData = async () => {
        try {
            // Load Goal
            const storedGoal = await AsyncStorage.getItem(GOAL_STORAGE_KEY);
            const goal = storedGoal ? parseInt(storedGoal) : DEFAULT_GOAL;
            setDailyGoal(goal);

            // Load Last 7 Days (Supabase source of truth, cache fallback offline)
            const days = getLastNDays(new Date(), 7).reverse(); // Get chronological order
            const entriesMap = user
                ? await fetchEntriesForRange(user.id, days)
                : await loadEntriesForDateRange(days);

            const stats: DailyStat[] = days.map(date => {
                const dateKey = formatDateKey(date);
                const entries = entriesMap[dateKey] || []; // Fix: Map key format might differ, checking util
                // actually loadEntriesForDateRange uses formatDateKey internally so the keys in result are YYYY-MM-DD
                const totalCalories = entries.reduce((sum, e) => sum + e.calories, 0);

                return {
                    dayLabel: date.toLocaleDateString('en-US', { weekday: 'narrow' }), // M, T, W
                    date,
                    calories: totalCalories
                };
            });

            setWeeklyData(stats);

            // Average only over days that were actually logged, so a new user
            // with 2 of 7 days filled is not shown an artificially deflated mean.
            const loggedDays = stats.filter(d => d.calories > 0);
            const total = loggedDays.reduce((sum, d) => sum + d.calories, 0);
            setAverageCalories(loggedDays.length ? Math.round(total / loggedDays.length) : 0);

        } catch (error) {
            logger.error('Failed to load stats', error);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Statistics</Text>
                <Pressable
                    onPress={onClose}
                    style={styles.closeButton}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Ionicons name="close-circle" size={28} color={colors.textMuted} />
                </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <WeightTracker />
                
                <WeeklyChart data={weeklyData} dailyGoal={dailyGoal} />

                <View style={styles.summaryCard}>
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Daily Average</Text>
                        <Text style={styles.summaryValue}>{averageCalories}</Text>
                        <Text style={styles.summaryUnit}>kcal</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Daily Goal</Text>
                        <Text style={styles.summaryValue}>{dailyGoal}</Text>
                        <Text style={styles.summaryUnit}>kcal</Text>
                    </View>
                </View>

                {/* Insight Card - Quick mocked insight */}
                <View style={[styles.summaryCard, styles.insightCard]}>
                    <Ionicons name="bulb-outline" size={24} color={colors.accent} style={{ marginBottom: 8 }} />
                    <Text style={styles.insightText}>
                        {averageCalories > dailyGoal
                            ? "You're slightly above your weekly target. Try adjusting your dinner portions."
                            : "Great job! You're consistently hitting your calorie goals this week."}
                    </Text>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: colors.textPrimary,
        letterSpacing: -0.5,
    },
    closeButton: {
        padding: 4,
    },
    content: {
        paddingBottom: 40,
    },
    summaryCard: {
        flexDirection: 'row',
        backgroundColor: colors.cardBackground,
        marginHorizontal: 16,
        marginTop: 16,
        padding: 24,
        borderRadius: 16,
        marginBottom: 20,
        boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.03)',
        elevation: 2,
    },
    summaryItem: {
        flex: 1,
        alignItems: 'center',
    },
    divider: {
        width: 1,
        backgroundColor: colors.ghostBorder,
        marginHorizontal: 16,
    },
    summaryLabel: {
        fontSize: 12,
        color: colors.textSecondary,
        fontWeight: '400',
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    summaryValue: {
        fontSize: 28,
        fontWeight: '800',
        color: colors.textPrimary,
        letterSpacing: -1,
    },
    summaryUnit: {
        fontSize: 12,
        color: colors.textMuted,
        fontWeight: '400',
    },
    insightCard: {
        flexDirection: 'column',
        alignItems: 'flex-start',
    },
    insightText: {
        fontSize: 15,
        color: colors.textSecondary,
        lineHeight: 22,
    }
});
