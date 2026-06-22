import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Header } from '../components/Header';
import { QuickAddBar } from '../components/QuickAddBar';
import { FoodEntryCard } from '../components/FoodEntryCard';
import { MealSection } from '../components/MealSection';
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
import { processAudioDictation } from '../lib/foodAI';
import { getMealTypeFromTime } from '../utils/mealUtils';
import { formatDateKey, isToday } from '../utils/dateUtils';
import { saveEntriesForDate, loadEntriesForDate, getDatesWithEntries } from '../utils/storageUtils';
import {
    fetchEntriesForDate,
    addEntryRemote,
    updateEntryRemote,
    deleteEntryRemote,
} from '../services/entriesRepository';
import { useAuth } from '../contexts/AuthContext';
import { generateId } from '../utils/id';
import { logger } from '../utils/logger';

const GOAL_STORAGE_KEY = '@daily_goal';
const DEFAULT_GOAL = 2000;

export function TodayScreen() {
    const { user } = useAuth();
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
    const [expandedSections, setExpandedSections] = useState<Set<MealType>>(new Set(['breakfast', 'lunch', 'dinner', 'snacks']));
    const [focusTrigger, setFocusTrigger] = useState(0);

    const totalCalories = entries.reduce((sum, entry) => sum + (Number(entry.calories) || 0), 0);

    // Group entries by meal type
    const entriesByMeal = useMemo(() => {
        const grouped: Record<MealType, FoodEntry[]> = {
            breakfast: [],
            lunch: [],
            dinner: [],
            snacks: [],
        };
        entries.forEach(entry => {
            const mealType = entry.mealType || 'snacks';
            grouped[mealType].push(entry);
        });
        return grouped;
    }, [entries]);

    const toggleSection = (mealType: MealType) => {
        setExpandedSections(prev => {
            const newSet = new Set(prev);
            if (newSet.has(mealType)) {
                newSet.delete(mealType);
            } else {
                newSet.add(mealType);
            }
            return newSet;
        });
    };

    const handleAddToMeal = (mealType: MealType) => {
        // Expand the section if collapsed
        if (!expandedSections.has(mealType)) {
            setExpandedSections(prev => new Set([...prev, mealType]));
        }
        // Trigger focus on InputBar
        setFocusTrigger(prev => prev + 1);
    };

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
    }, [currentDate, user?.id]);

    // Save and update days with data
    useEffect(() => {
        let isMounted = true;
        
        saveEntriesForDate(currentDate, entries).then(() => {
            if (isMounted) {
                loadDaysWithData();
            }
        });

        return () => {
            isMounted = false;
        };
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
        try {
            // Supabase is the source of truth; falls back to local cache offline.
            const loaded = user
                ? await fetchEntriesForDate(user.id, currentDate)
                : await loadEntriesForDate(currentDate);
            setEntries(loaded);
            setHasReachedGoal(false);
        } catch (error) {
            logger.error('Failed to load entries', error);
            setEntries([]);
        }
    };

    const loadDaysWithData = async () => {
        const dates = await getDatesWithEntries();
        setDaysWithData(dates);
    };

    const loadDailyGoal = async () => {
        try {
            const stored = await AsyncStorage.getItem(GOAL_STORAGE_KEY);
            const parsed = stored ? parseInt(stored, 10) : NaN;
            if (Number.isFinite(parsed) && parsed > 0) {
                setDailyGoal(parsed);
            }
        } catch (error) {
            logger.error('Failed to load goal', error);
        }
    };

    const saveDailyGoal = async (goal: number) => {
        try {
            await AsyncStorage.setItem(GOAL_STORAGE_KEY, goal.toString());
            setDailyGoal(goal);
        } catch (error) {
            logger.error('Failed to save goal', error);
        }
    };

    const celebrateGoalReached = async () => {
        setHasReachedGoal(true);
        if (Platform.OS === 'ios') {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        Alert.alert('Goal Reached', `You've reached your daily goal of ${dailyGoal} kcal!`);
    };

    const handleAddEntry = useCallback(async (text: string) => {
        setProcessingState('processing');
        try {
            // Sanitize input: trim whitespace and limit length
            const sanitizedText = text.trim().substring(0, 200);
            
            if (!sanitizedText) {
                setProcessingState('idle');
                return;
            }
            
            const { calories, source, name } = await detectCalories(sanitizedText);
            const mealType = getMealTypeFromTime();
            const newEntry: FoodEntry = {
                id: generateId(),
                // Prefer the AI-resolved clean name (Spanish); fall back to raw text.
                name: name?.trim() || sanitizedText,
                calories,
                isFavorite: false,
                timestamp: currentDate,
                mealType,
                source,
            };
            setEntries(prev => [newEntry, ...prev]);
            if (user) addEntryRemote(user.id, newEntry);
            setProcessingState('done');
            if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setTimeout(() => setProcessingState('idle'), 300);
        } catch (error) {
            setProcessingState('idle');
        }
    }, [currentDate]);

    const handleAudioEntry = useCallback(async (uri: string) => {
        setProcessingState('processing');
        try {
            const suggestions = await processAudioDictation(uri);
            if (suggestions.length === 0) {
                setProcessingState('idle');
                Alert.alert(
                    "Couldn't catch that",
                    'Try saying what you ate, e.g. "two eggs and a banana".'
                );
                return;
            }
            const mealType = getMealTypeFromTime();
            const newEntries: FoodEntry[] = suggestions.map(s => ({
                id: generateId(),
                name: s.name,
                calories: s.calories,
                isFavorite: false,
                timestamp: currentDate,
                mealType,
                source: s.verified ? 'verified' : 'estimate',
            }));
            setEntries(prev => [...newEntries, ...prev]);
            if (user) newEntries.forEach(e => addEntryRemote(user.id, e));
            setProcessingState('done');
            if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setTimeout(() => setProcessingState('idle'), 300);
        } catch (error) {
            logger.error('Voice entry failed', error);
            setProcessingState('idle');
        }
    }, [currentDate, user?.id]);

    const handleQuickAdd = useCallback(async (item: QuickAddItem) => {
        try {
            const mealType = getMealTypeFromTime();
            const newEntry: FoodEntry = {
                id: generateId(),
                name: item.name,
                calories: item.calories,
                isFavorite: false,
                timestamp: currentDate,
                mealType,
            };
            setEntries(prev => [newEntry, ...prev]);
            if (user) addEntryRemote(user.id, newEntry);
            if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (error) {
            logger.error('Failed to add quick item', error);
        }
    }, [currentDate, user?.id]);

    const handleCardPress = useCallback((entry: FoodEntry) => {
        const updated = { ...entry, isFavorite: !entry.isFavorite };
        setEntries(prev => prev.map(e => e.id === entry.id ? updated : e));
        updateEntryRemote(updated);
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

    const handleSaveEdit = (newName: string, newCalories: number) => {
        if (!selectedEntry) return;
        const trimmed = newName.trim();
        // Honour the calories the user explicitly typed instead of re-estimating
        // them from the name (which silently discarded their correction).
        if (!trimmed || !Number.isFinite(newCalories) || newCalories <= 0) return;
        // A manual correction is user-authoritative — clear any AI/estimate badge.
        const updated = { ...selectedEntry, name: trimmed, calories: Math.round(newCalories), source: undefined };
        setEntries(prev => prev.map(e => e.id === selectedEntry.id ? updated : e));
        updateEntryRemote(updated);
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
                    deleteEntryRemote(selectedEntry.id);
                }
            }
        ]);
    }, [selectedEntry]);

    const handleMoveTo = useCallback((mealType: MealType) => {
        if (!selectedEntry) return;
        const updated = { ...selectedEntry, mealType };
        setEntries(prev => prev.map(e => e.id === selectedEntry.id ? updated : e));
        updateEntryRemote(updated);
    }, [selectedEntry]);

    const handleToggleFavorite = useCallback(() => {
        setMenuVisible(false);
        if (selectedEntry) handleCardPress(selectedEntry); // Reuse logic
    }, [selectedEntry, handleCardPress]);

    const handleDateChange = (newDate: Date) => setCurrentDate(newDate);
    const handleDateSelect = (date: Date) => setCurrentDate(date);

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

                        <View style={styles.mealsContainer}>
                            <ScrollView
                                contentContainerStyle={entries.length === 0 ? styles.emptyList : styles.listContent}
                                showsVerticalScrollIndicator={false}
                            >
                            {entries.length === 0 ? (
                                <EmptyState date={currentDate} />
                            ) : (
                                <>
                                    <MealSection
                                        mealType="breakfast"
                                        entries={entriesByMeal.breakfast}
                                        isExpanded={expandedSections.has('breakfast')}
                                        onToggleExpand={() => toggleSection('breakfast')}
                                        onAddToMeal={() => handleAddToMeal('breakfast')}
                                        onEntryPress={handleCardPress}
                                        onEntryLongPress={handleCardLongPress}
                                    />
                                    <MealSection
                                        mealType="lunch"
                                        entries={entriesByMeal.lunch}
                                        isExpanded={expandedSections.has('lunch')}
                                        onToggleExpand={() => toggleSection('lunch')}
                                        onAddToMeal={() => handleAddToMeal('lunch')}
                                        onEntryPress={handleCardPress}
                                        onEntryLongPress={handleCardLongPress}
                                    />
                                    <MealSection
                                        mealType="dinner"
                                        entries={entriesByMeal.dinner}
                                        isExpanded={expandedSections.has('dinner')}
                                        onToggleExpand={() => toggleSection('dinner')}
                                        onAddToMeal={() => handleAddToMeal('dinner')}
                                        onEntryPress={handleCardPress}
                                        onEntryLongPress={handleCardLongPress}
                                    />
                                    <MealSection
                                        mealType="snacks"
                                        entries={entriesByMeal.snacks}
                                        isExpanded={expandedSections.has('snacks')}
                                        onToggleExpand={() => toggleSection('snacks')}
                                        onAddToMeal={() => handleAddToMeal('snacks')}
                                        onEntryPress={handleCardPress}
                                        onEntryLongPress={handleCardLongPress}
                                    />
                                </>
                            )}
                            </ScrollView>
                        </View>
                    </View>

                    <InputBar
                        onSubmit={handleAddEntry}
                        onAudioRecorded={handleAudioEntry}
                        processingState={processingState}
                        focusTrigger={focusTrigger}
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
        overflow: 'hidden',
    },
    mealsContainer: {
        flex: 1,
        marginBottom: 80,
        overflow: 'hidden',
    },
    listContent: {
        paddingTop: 8,
        paddingBottom: 20,
    },
    emptyList: {
        flex: 1,
    },
});
