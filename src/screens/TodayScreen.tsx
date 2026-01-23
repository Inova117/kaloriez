import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, FlatList, StyleSheet, KeyboardAvoidingView, Platform, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Header } from '../components/Header';
import { QuickAddBar } from '../components/QuickAddBar';
import { FoodEntryCard } from '../components/FoodEntryCard';
import { InputBar } from '../components/InputBar';
import { FoodMenu } from '../components/FoodMenu';
import { EditFoodModal } from '../components/EditFoodModal';
import { GoalSettingsModal } from '../components/GoalSettingsModal';
import { DayNavigator } from '../components/DayNavigator';
import { CalendarModal } from '../components/CalendarModal';
import { EmptyState } from '../components/EmptyState';
import { StatsScreen } from './StatsScreen';
import { colors } from '../theme/colors';
import { FoodEntry, QuickAddItem, ProcessingState, MEAL_CONFIGS, MealType } from '../types';
import { detectCalories } from '../utils/calorieAI';
import { getMealTypeFromTime } from '../utils/mealUtils';
import { formatDateKey, isToday } from '../utils/dateUtils';
import { saveEntriesForDate, loadEntriesForDate, getDatesWithEntries } from '../utils/storageUtils';

const GOAL_STORAGE_KEY = '@daily_goal';
const DEFAULT_GOAL = 2000;

export function TodayScreen() {
    const [currentDate, setCurrentDate] = useState<Date>(new Date());
    const [entries, setEntries] = useState<FoodEntry[]>([]);
    const [processingState, setProcessingState] = useState<ProcessingState>('idle');
    const [menuVisible, setMenuVisible] = useState(false);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [goalSettingsVisible, setGoalSettingsVisible] = useState(false);
    const [calendarVisible, setCalendarVisible] = useState(false);
    const [statsVisible, setStatsVisible] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState<FoodEntry | null>(null);
    const [dailyGoal, setDailyGoal] = useState(DEFAULT_GOAL);
    const [hasReachedGoal, setHasReachedGoal] = useState(false);
    const [daysWithData, setDaysWithData] = useState<Set<string>>(new Set());

    const totalCalories = entries.reduce((sum, entry) => sum + entry.calories, 0);

    // Generate quick add items from favorites
    const quickAddItems = useMemo<QuickAddItem[]>(() => {
        const uniqueFavorites = new Map<string, QuickAddItem>();
        const favoriteEntries = entries.filter(e => e.isFavorite);

        favoriteEntries.forEach(entry => {
            const key = `${entry.name}-${entry.calories}`;
            if (!uniqueFavorites.has(key)) {
                const mealConfig = MEAL_CONFIGS[entry.mealType || 'snacks'];
                uniqueFavorites.set(key, {
                    id: entry.id,
                    name: entry.name,
                    emoji: mealConfig.icon,
                    calories: entry.calories,
                });
            }
        });

        return Array.from(uniqueFavorites.values()).slice(0, 5);
    }, [entries]);

    useEffect(() => {
        loadDailyGoal();
        loadDaysWithData();
    }, []);

    useEffect(() => {
        loadEntriesForCurrentDate();
    }, [currentDate]);

    // Save and update days with data
    useEffect(() => {
        if (entries.length >= 0) {
            saveEntriesForDate(currentDate, entries).then(() => {
                loadDaysWithData();
            });
        }
    }, [entries, currentDate]);

    useEffect(() => {
        if (!isToday(currentDate)) return;
        if (totalCalories >= dailyGoal && !hasReachedGoal && totalCalories > 0) {
            celebrateGoalReached();
        } else if (totalCalories < dailyGoal && hasReachedGoal) {
            setHasReachedGoal(false);
        }
    }, [totalCalories, dailyGoal, hasReachedGoal, currentDate]);

    const loadEntriesForCurrentDate = async () => {
        const loaded = await loadEntriesForDate(currentDate);
        setEntries(loaded);
        setHasReachedGoal(false);
    };

    const loadDaysWithData = async () => {
        const dates = await getDatesWithEntries();
        setDaysWithData(dates);
    };

    const loadDailyGoal = async () => {
        try {
            const stored = await AsyncStorage.getItem(GOAL_STORAGE_KEY);
            if (stored) {
                setDailyGoal(parseInt(stored));
            }
        } catch (error) {
            console.error('Failed to load goal:', error);
        }
    };

    const saveDailyGoal = async (goal: number) => {
        try {
            await AsyncStorage.setItem(GOAL_STORAGE_KEY, goal.toString());
            setDailyGoal(goal);
        } catch (error) {
            console.error('Failed to save goal:', error);
        }
    };

    const celebrateGoalReached = async () => {
        setHasReachedGoal(true);
        if (Platform.OS === 'ios') {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        Alert.alert('Goal Reached! 🎯', `You've reached your daily goal of ${dailyGoal} kcal!`);
    };

    const handleAddEntry = useCallback(async (text: string) => {
        setProcessingState('processing');
        try {
            const calories = await detectCalories(text);
            const mealType = getMealTypeFromTime();
            const newEntry: FoodEntry = {
                id: Date.now().toString(),
                name: text,
                calories,
                isFavorite: false,
                timestamp: currentDate,
                mealType,
            };
            setEntries(prev => [newEntry, ...prev]);
            setProcessingState('done');
            if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setTimeout(() => setProcessingState('idle'), 300);
        } catch (error) {
            setProcessingState('idle');
        }
    }, [currentDate]);

    const handleQuickAdd = useCallback(async (item: QuickAddItem) => {
        const mealType = getMealTypeFromTime();
        const newEntry: FoodEntry = {
            id: Date.now().toString(),
            name: item.name,
            calories: item.calories,
            isFavorite: false,
            timestamp: currentDate,
            mealType,
        };
        setEntries(prev => [newEntry, ...prev]);
        if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, [currentDate]);

    const handleCardPress = useCallback((entry: FoodEntry) => {
        setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, isFavorite: !e.isFavorite } : e));
    }, []);

    const handleCardLongPress = useCallback(async (entry: FoodEntry) => {
        if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setSelectedEntry(entry);
        setMenuVisible(true);
    }, []);

    const handleEditOption = () => {
        setMenuVisible(false);
        setTimeout(() => setEditModalVisible(true), 100);
    };

    const handleSaveEdit = async (newName: string) => {
        if (selectedEntry && newName) {
            const calories = await detectCalories(newName);
            setEntries(prev => prev.map(e => e.id === selectedEntry.id ? { ...e, name: newName.trim(), calories } : e));
        }
    };

    const handleDelete = useCallback(async () => {
        setMenuVisible(false);
        if (!selectedEntry) return;
        Alert.alert('Delete Entry', `Remove "${selectedEntry.name}"?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: () => {
                    setEntries(prev => prev.filter(e => e.id !== selectedEntry.id));
                }
            }
        ]);
    }, [selectedEntry]);

    const handleMoveTo = useCallback((mealType: MealType) => {
        if (!selectedEntry) return;
        setEntries(prev => prev.map(e => e.id === selectedEntry.id ? { ...e, mealType } : e));
    }, [selectedEntry]);

    const handleToggleFavorite = useCallback(() => {
        setMenuVisible(false);
        if (selectedEntry) handleCardPress(selectedEntry); // Reuse logic
    }, [selectedEntry, handleCardPress]);

    const handleDateChange = (newDate: Date) => setCurrentDate(newDate);
    const handleDateSelect = (date: Date) => setCurrentDate(date);

    const renderEntry = useCallback(({ item, index }: { item: FoodEntry; index: number }) => (
        <FoodEntryCard
            entry={item}
            index={index}
            onPress={handleCardPress}
            onLongPress={handleCardLongPress}
        />
    ), [handleCardPress]);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <DayNavigator currentDate={currentDate} onDateChange={handleDateChange}>
                <KeyboardAvoidingView
                    style={styles.keyboardView}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={0}
                >
                    <View style={styles.content}>
                        <Header
                            totalCalories={totalCalories}
                            dailyGoal={dailyGoal}
                            currentDate={currentDate}
                            onGoalPress={() => setGoalSettingsVisible(true)}
                            onDatePress={() => setCalendarVisible(true)}
                            onTodayPress={() => setCurrentDate(new Date())}
                            onStatsPress={() => setStatsVisible(true)}
                        />

                        <QuickAddBar
                            items={quickAddItems}
                            onItemPress={handleQuickAdd}
                        />

                        <FlatList
                            data={entries}
                            renderItem={renderEntry}
                            keyExtractor={(item) => item.id}
                            contentContainerStyle={entries.length === 0 ? styles.emptyList : styles.listContent}
                            showsVerticalScrollIndicator={false}
                            ListEmptyComponent={<EmptyState date={currentDate} />}
                        />
                    </View>

                    <InputBar
                        onSubmit={handleAddEntry}
                        processingState={processingState}
                    />
                </KeyboardAvoidingView>
            </DayNavigator>

            <Modal
                visible={statsVisible}
                animationType="slide"
                presentationStyle="pageSheet"
            >
                <StatsScreen onClose={() => setStatsVisible(false)} />
            </Modal>

            <FoodMenu
                visible={menuVisible}
                entry={selectedEntry}
                onEdit={handleEditOption}
                onDelete={handleDelete}
                onToggleFavorite={handleToggleFavorite}
                onMoveTo={handleMoveTo}
                onClose={() => setMenuVisible(false)}
            />

            <EditFoodModal
                visible={editModalVisible}
                entry={selectedEntry}
                onSave={handleSaveEdit}
                onClose={() => setEditModalVisible(false)}
            />

            <GoalSettingsModal
                visible={goalSettingsVisible}
                currentGoal={dailyGoal}
                onSave={saveDailyGoal}
                onClose={() => setGoalSettingsVisible(false)}
            />

            <CalendarModal
                visible={calendarVisible}
                currentDate={currentDate}
                daysWithData={daysWithData}
                onSelectDate={handleDateSelect}
                onClose={() => setCalendarVisible(false)}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    keyboardView: {
        flex: 1,
    },
    content: {
        flex: 1,
    },
    listContent: {
        paddingTop: 8,
        paddingBottom: 100,
    },
    emptyList: {
        flex: 1,
    },
});
