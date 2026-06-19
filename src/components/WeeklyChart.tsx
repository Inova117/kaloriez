import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withDelay
} from 'react-native-reanimated';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { isToday } from '../utils/dateUtils';

interface DailyStat {
    dayLabel: string; // "M", "T", "W"...
    date: Date;
    calories: number;
}

interface WeeklyChartProps {
    data: DailyStat[];
    dailyGoal: number;
}

const CHART_HEIGHT = 200;

export function WeeklyChart({ data, dailyGoal }: WeeklyChartProps) {
    const maxCalories = Math.max(...data.map(d => d.calories), dailyGoal * 1.2); // Ensure goal is visible

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <Text style={styles.title}>Weekly Progress</Text>
                <Text style={styles.subtitle}>Last 7 Days</Text>
            </View>

            <View style={styles.chartContainer}>
                {/* Goal Line */}
                <View
                    style={[
                        styles.goalLine,
                        { bottom: (dailyGoal / maxCalories) * CHART_HEIGHT }
                    ]}
                >
                    <Text style={styles.goalLabel}>Goal</Text>
                </View>

                {/* Bars */}
                <View style={styles.barsRow}>
                    {data.map((day, index) => (
                        <Bar
                            key={index}
                            item={day}
                            maxCalories={maxCalories}
                            index={index}
                            isGoalMet={day.calories >= dailyGoal}
                        />
                    ))}
                </View>
            </View>
        </View>
    );
}

function Bar({ item, maxCalories, index, isGoalMet }: {
    item: DailyStat;
    maxCalories: number;
    index: number;
    isGoalMet: boolean;
}) {
    const isCurrentDay = isToday(item.date);
    const heightPercentage = Math.min((item.calories / maxCalories) * 100, 100);

    // Animation
    const height = useSharedValue(0);

    React.useEffect(() => {
        height.value = withDelay(index * 50, withTiming(heightPercentage, { duration: 1000 }));
    }, [heightPercentage]);

    const animatedStyle = useAnimatedStyle(() => ({
        height: `${height.value}%`
    }));

    return (
        <View style={styles.barContainer}>
            <View style={styles.barTrack}>
                <Animated.View
                    style={[
                        styles.bar,
                        animatedStyle,
                        {
                            backgroundColor: isCurrentDay
                                ? colors.accent
                                : isGoalMet
                                    ? colors.success
                                    : colors.textSecondary
                        },
                        isCurrentDay && styles.activeBarShadow
                    ]}
                />
            </View>
            <Text style={[
                styles.dayLabel,
                isCurrentDay && styles.activeDayLabel
            ]}>
                {item.dayLabel}
            </Text>
            <Text style={styles.valueLabel}>
                {item.calories > 0 ? Math.round(item.calories / 13) : ''}
                {/* Mocking a mini value or just dot? No, let's keep it clean, maybe just label */}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.cardBackground,
        borderRadius: 24,
        padding: 24,
        marginHorizontal: 16,
        marginBottom: 24,
        boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.05)',
        elevation: 4,
        borderWidth: 1,
        borderColor: colors.cardBorder,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 24,
    },
    title: {
        fontSize: 18,
        fontWeight: '400',
        color: colors.textPrimary,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 13,
        fontWeight: '400',
        color: colors.textSecondary,
    },
    chartContainer: {
        height: CHART_HEIGHT,
        justifyContent: 'flex-end',
        position: 'relative',
    },
    goalLine: {
        position: 'absolute',
        left: 0,
        right: 0,
        borderTopWidth: 1,
        borderTopColor: colors.textDimmed,
        borderStyle: 'dashed',
        zIndex: 0,
    },
    goalLabel: {
        position: 'absolute',
        right: 0,
        top: -16,
        fontSize: 10,
        color: colors.textMuted,
        fontWeight: '400',
        backgroundColor: colors.cardBackground,
        paddingHorizontal: 4,
    },
    barsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        height: '100%',
        zIndex: 1,
    },
    barContainer: {
        alignItems: 'center',
        flex: 1,
    },
    barTrack: {
        height: '85%', // Reserve space for labels
        width: 8,
        backgroundColor: colors.ghostBorder,
        borderRadius: 4,
        justifyContent: 'flex-end',
        overflow: 'hidden',
    },
    bar: {
        width: '100%',
        borderRadius: 4,
    },
    activeBarShadow: {
        boxShadow: '0px 0px 8px rgba(99, 102, 241, 0.4)',
    },
    dayLabel: {
        marginTop: 8,
        fontSize: 12,
        fontWeight: '400',
        color: colors.textMuted,
    },
    activeDayLabel: {
        color: colors.accent,
        fontWeight: '400',
    },
    valueLabel: {
        fontSize: 9,
        color: colors.textDimmed,
        height: 12, // Fixed height to prevent jumps
    }
});
