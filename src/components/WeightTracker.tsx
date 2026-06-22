import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme/colors';
import Svg, { Line, Circle, Text as SvgText } from 'react-native-svg';
import { logger } from '../utils/logger';

interface WeightEntry {
    date: string;
    weight: number;
}

const WEIGHT_HISTORY_KEY = '@weight_history';
const CHART_HEIGHT = 200;

export function WeightTracker() {
    const { width: windowWidth } = useWindowDimensions();
    const CHART_WIDTH = windowWidth - 64;
    
    const [weightHistory, setWeightHistory] = useState<WeightEntry[]>([]);
    const [isAddingWeight, setIsAddingWeight] = useState(false);
    const [newWeight, setNewWeight] = useState('');

    useEffect(() => {
        loadWeightHistory();
    }, []);

    const loadWeightHistory = async () => {
        try {
            const saved = await AsyncStorage.getItem(WEIGHT_HISTORY_KEY);
            if (saved) {
                setWeightHistory(JSON.parse(saved));
            }
        } catch (error) {
            logger.error('Error loading weight history', error);
        }
    };

    const saveWeightHistory = async (history: WeightEntry[]) => {
        try {
            await AsyncStorage.setItem(WEIGHT_HISTORY_KEY, JSON.stringify(history));
            setWeightHistory(history);
        } catch (error) {
            logger.error('Error saving weight history', error);
        }
    };

    const handleAddWeight = () => {
        const weight = parseFloat(newWeight);
        
        // Validate weight is a number and within reasonable range (30-300 kg)
        if (isNaN(weight)) {
            return;
        }
        
        if (weight < 30 || weight > 300) {
            // Could add Alert here if needed
            return;
        }

        const today = new Date().toISOString().split('T')[0];
        const newEntry: WeightEntry = { date: today, weight };
        
        // Remove today's entry if exists and add new one
        const filtered = weightHistory.filter(e => e.date !== today);
        const updated = [...filtered, newEntry].sort((a, b) => 
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        saveWeightHistory(updated);
        setNewWeight('');
        setIsAddingWeight(false);
    };

    const renderChart = () => {
        if (weightHistory.length === 0) {
            return (
                <View style={styles.emptyChart}>
                    <Text style={styles.emptyText}>No weight data yet</Text>
                    <Text style={styles.emptySubtext}>Start tracking your progress</Text>
                </View>
            );
        }

        const weights = weightHistory.map(e => e.weight);
        const minWeight = Math.min(...weights);
        const maxWeight = Math.max(...weights);
        const weightRange = maxWeight - minWeight || 1;

        const padding = 40;
        const chartInnerWidth = CHART_WIDTH - padding * 2;
        const chartInnerHeight = CHART_HEIGHT - padding * 2;

        const points = weightHistory.map((entry, index) => {
            const x = padding + (index / Math.max(weightHistory.length - 1, 1)) * chartInnerWidth;
            const y = padding + chartInnerHeight - ((entry.weight - minWeight) / weightRange) * chartInnerHeight;
            return { x, y, weight: entry.weight, date: entry.date };
        });

        return (
            <View style={styles.chartContainer}>
                <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
                    {/* Grid lines */}
                    {[0, 1, 2, 3, 4].map((i) => {
                        const y = padding + (i / 4) * chartInnerHeight;
                        return (
                            <Line
                                key={`grid-${i}`}
                                x1={padding}
                                y1={y}
                                x2={CHART_WIDTH - padding}
                                y2={y}
                                stroke={colors.ghostBorder}
                                strokeWidth="1"
                                opacity="0.3"
                            />
                        );
                    })}

                    {/* Weight line */}
                    {points.map((point, index) => {
                        if (index === 0) return null;
                        const prevPoint = points[index - 1];
                        return (
                            <Line
                                key={`line-${index}`}
                                x1={prevPoint.x}
                                y1={prevPoint.y}
                                x2={point.x}
                                y2={point.y}
                                stroke={colors.accent}
                                strokeWidth="3"
                                strokeLinecap="round"
                            />
                        );
                    })}

                    {/* Data points */}
                    {points.map((point, index) => (
                        <Circle
                            key={`point-${index}`}
                            cx={point.x}
                            cy={point.y}
                            r="5"
                            fill={colors.accent}
                            stroke="#FFFFFF"
                            strokeWidth="2"
                        />
                    ))}

                    {/* Y-axis labels */}
                    {[0, 2, 4].map((i) => {
                        const weight = maxWeight - (i / 4) * weightRange;
                        const y = padding + (i / 4) * chartInnerHeight;
                        return (
                            <SvgText
                                key={`y-label-${i}`}
                                x={padding - 10}
                                y={y + 5}
                                fontSize="12"
                                fill={colors.textMuted}
                                textAnchor="end"
                            >
                                {weight.toFixed(1)}
                            </SvgText>
                        );
                    })}
                </Svg>

                {/* Current weight display */}
                {weightHistory.length > 0 && (
                    <View style={styles.currentWeight}>
                        <Text style={styles.currentWeightLabel}>Current</Text>
                        <Text style={styles.currentWeightValue}>
                            {weightHistory[weightHistory.length - 1].weight} kg
                        </Text>
                    </View>
                )}
            </View>
        );
    };

    const latestWeight = weightHistory.length > 0 ? weightHistory[weightHistory.length - 1].weight : null;
    const firstWeight = weightHistory.length > 0 ? weightHistory[0].weight : null;
    const weightChange = latestWeight && firstWeight ? latestWeight - firstWeight : null;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>Weight Progress</Text>
                    {weightChange !== null && (
                        <Text style={[
                            styles.change,
                            weightChange < 0 ? styles.changeNegative : styles.changePositive
                        ]}>
                            {weightChange > 0 ? '+' : ''}{weightChange.toFixed(1)} kg
                        </Text>
                    )}
                </View>
                <Pressable 
                    style={styles.addButton}
                    onPress={() => setIsAddingWeight(!isAddingWeight)}
                >
                    <Ionicons 
                        name={isAddingWeight ? "close" : "add"} 
                        size={20} 
                        color={colors.accent} 
                    />
                </Pressable>
            </View>

            {isAddingWeight && (
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter weight (kg)"
                        placeholderTextColor={colors.textDimmed}
                        keyboardType="decimal-pad"
                        value={newWeight}
                        onChangeText={setNewWeight}
                        autoFocus
                    />
                    <Pressable 
                        style={styles.saveButton}
                        onPress={handleAddWeight}
                    >
                        <Text style={styles.saveButtonText}>Save</Text>
                    </Pressable>
                </View>
            )}

            {renderChart()}

            {weightHistory.length > 0 && (
                <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    style={styles.historyScroll}
                    contentContainerStyle={styles.historyContent}
                >
                    {weightHistory.slice().reverse().map((entry, index) => (
                        <View key={index} style={styles.historyItem}>
                            <Text style={styles.historyWeight}>{entry.weight} kg</Text>
                            <Text style={styles.historyDate}>
                                {new Date(entry.date).toLocaleDateString('en-US', { 
                                    month: 'short', 
                                    day: 'numeric' 
                                })}
                            </Text>
                        </View>
                    ))}
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.cardBackground,
        borderRadius: 16,
        padding: 20,
        marginHorizontal: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: colors.cardBorder,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: '400',
        color: colors.textPrimary,
        marginBottom: 4,
    },
    change: {
        fontSize: 14,
        fontWeight: '400',
    },
    changeNegative: {
        color: '#10B981',
    },
    changePositive: {
        color: colors.error,
    },
    addButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.accent + '15',
        alignItems: 'center',
        justifyContent: 'center',
    },
    inputContainer: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    input: {
        flex: 1,
        backgroundColor: colors.inputBackground,
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: colors.textPrimary,
        borderWidth: 1,
        borderColor: colors.ghostBorder,
    },
    saveButton: {
        backgroundColor: colors.accent,
        borderRadius: 8,
        paddingHorizontal: 20,
        justifyContent: 'center',
    },
    saveButtonText: {
        fontSize: 16,
        fontWeight: '400',
        color: colors.textInverse,
    },
    chartContainer: {
        marginVertical: 16,
        position: 'relative',
    },
    emptyChart: {
        height: CHART_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '400',
        color: colors.textMuted,
        marginBottom: 4,
    },
    emptySubtext: {
        fontSize: 14,
        color: colors.textDimmed,
    },
    currentWeight: {
        position: 'absolute',
        top: 16,
        right: 16,
        alignItems: 'flex-end',
    },
    currentWeightLabel: {
        fontSize: 12,
        color: colors.textMuted,
        marginBottom: 2,
    },
    currentWeightValue: {
        fontSize: 20,
        fontWeight: '400',
        color: colors.accent,
    },
    historyScroll: {
        marginTop: 12,
    },
    historyContent: {
        gap: 12,
        paddingVertical: 4,
    },
    historyItem: {
        backgroundColor: colors.inputBackground,
        borderRadius: 8,
        padding: 12,
        minWidth: 80,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.ghostBorder,
    },
    historyWeight: {
        fontSize: 16,
        fontWeight: '400',
        color: colors.textPrimary,
        marginBottom: 4,
    },
    historyDate: {
        fontSize: 12,
        color: colors.textMuted,
    },
});
