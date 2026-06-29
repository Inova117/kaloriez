import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Alert, Modal, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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
import { FoodEntry, QuickAddItem, ProcessingState, MealType } from '../types';
import { detectCalories } from '../utils/calorieAI';
import { processAudioDictation, PortionOption } from '../lib/foodAI';
import { getMealTypeFromTime } from '../utils/mealUtils';
import { formatDateKey, isToday } from '../utils/dateUtils';
import { saveEntriesForDate, loadEntriesForDate, getDatesWithEntries } from '../utils/storageUtils';
import {
    fetchEntriesForDate,
    addEntryRemote,
    updateEntryRemote,
    deleteEntryRemote,
} from '../services/entriesRepository';
import {
    fetchFavorites,
    addFavorite,
    removeFavorite,
    bumpUsage,
    Favorite,
} from '../services/favoritesRepository';
import { recallFood, rememberFood, parseFoodPhrase } from '../services/foodMemory';
import { useAuth } from '../contexts/AuthContext';
import { generateId } from '../utils/id';
import { logger } from '../utils/logger';

const GOAL_STORAGE_KEY = '@daily_goal';
const DEFAULT_GOAL = 2000;

interface TodayScreenProps {
    pendingAdd?: QuickAddItem | null;
    onPendingAddConsumed?: () => void;
}

export function TodayScreen({ pendingAdd, onPendingAddConsumed }: TodayScreenProps = {}) {
    const { user } = useAuth();
    const [currentDate, setCurrentDate] = useState<Date>(new Date());
    const [favorites, setFavorites] = useState<Favorite[]>([]);
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
    // Non-blocking "I detected this — fix it?" review of the last AI entry.
    const [reviewEntry, setReviewEntry] = useState<FoodEntry | null>(null);
    const [reviewDetail, setReviewDetail] = useState<string | undefined>(undefined);
    const [reviewOptions, setReviewOptions] = useState<PortionOption[]>([]);
    const reviewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const showReview = useCallback((entry: FoodEntry, detail?: string, options?: PortionOption[]) => {
        if (reviewTimer.current) clearTimeout(reviewTimer.current);
        setReviewEntry(entry);
        setReviewDetail(detail);
        setReviewOptions(options ?? []);
        // Give a bit longer when there are size choices to pick from.
        reviewTimer.current = setTimeout(() => setReviewEntry(null), options && options.length ? 9000 : 6000);
    }, []);

    const dismissReview = useCallback(() => {
        if (reviewTimer.current) clearTimeout(reviewTimer.current);
        setReviewEntry(null);
    }, []);

    const handlePickOption = useCallback((opt: PortionOption) => {
        setReviewEntry(prev => {
            if (!prev) return prev;
            const updated = { ...prev, calories: opt.calories };
            setEntries(list => list.map(e => e.id === prev.id ? updated : e));
            updateEntryRemote(updated);
            return updated;
        });
        if (Platform.OS === 'ios') Haptics.selectionAsync();
    }, []);

    useEffect(() => () => {
        if (reviewTimer.current) clearTimeout(reviewTimer.current);
    }, []);

    const handleReviewEdit = useCallback(() => {
        if (!reviewEntry) return;
        setSelectedEntry(reviewEntry);
        dismissReview();
        setEditModalVisible(true);
    }, [reviewEntry, dismissReview]);

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

    // Quick-add chips come from the persistent favorites list (most-used first),
    // so they're available every day, not just for foods favorited today.
    const quickAddItems = useMemo<QuickAddItem[]>(
        () => favorites.slice(0, 8).map(f => ({ id: f.id, name: f.name, emoji: '', calories: f.calories })),
        [favorites]
    );

    const loadFavorites = useCallback(async () => {
        if (!user) return;
        setFavorites(await fetchFavorites(user.id));
    }, [user?.id]);

    useEffect(() => { loadFavorites(); }, [loadFavorites]);

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
        Alert.alert('¡Meta alcanzada!', `Llegaste a tu meta diaria de ${dailyGoal} kcal.`);
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
            
            const mealType = getMealTypeFromTime();
            const parsed = parseFoodPhrase(sanitizedText); // amount the user typed

            // Personalized memory: if the user has logged this food before, reuse
            // (and scale to the amount given) THEIR calories instead of re-asking
            // the AI — faster, free, and it respects the value they set.
            const remembered = user ? await recallFood(user.id, sanitizedText) : null;
            if (remembered) {
                const memEntry: FoodEntry = {
                    id: generateId(),
                    name: remembered.name,
                    calories: remembered.calories,
                    isFavorite: false,
                    timestamp: currentDate,
                    mealType,
                    source: undefined, // the user's own value — no AI/estimate badge
                    portionGrams: remembered.portionGrams,
                    unitCount: remembered.unitCount,
                };
                setEntries(prev => [memEntry, ...prev]);
                if (user) addEntryRemote(user.id, memEntry);
                showReview(memEntry, 'Recordado de tus registros', undefined);
                setProcessingState('done');
                if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setTimeout(() => setProcessingState('idle'), 300);
                return;
            }

            const { calories, source, name, detail, options, portionGrams } = await detectCalories(sanitizedText);
            const newEntry: FoodEntry = {
                id: generateId(),
                // Prefer the AI-resolved clean name (Spanish); fall back to raw text.
                name: name?.trim() || sanitizedText,
                calories,
                isFavorite: false,
                timestamp: currentDate,
                mealType,
                source,
                portionGrams,
                unitCount: parsed.count,
            };
            setEntries(prev => [newEntry, ...prev]);
            if (user) {
                addEntryRemote(user.id, newEntry);
                // Remember it (and the kcal/g + kcal/unit ratios) for next time,
                // keyed by both the raw phrase and the AI-resolved clean name.
                rememberFood(
                    user.id,
                    [sanitizedText, newEntry.name],
                    {
                        name: newEntry.name,
                        calories: newEntry.calories,
                        portionGrams: newEntry.portionGrams,
                        unitCount: parsed.count,
                    }
                );
            }
            showReview(newEntry, detail, options);
            setProcessingState('done');
            if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setTimeout(() => setProcessingState('idle'), 300);
        } catch (error) {
            setProcessingState('idle');
        }
    }, [currentDate, user?.id, showReview]);

    const handleAudioEntry = useCallback(async (uri: string) => {
        setProcessingState('processing');
        try {
            const suggestions = await processAudioDictation(uri);
            if (suggestions.length === 0) {
                setProcessingState('idle');
                Alert.alert(
                    'No te entendí bien',
                    'Intenta decir lo que comiste, por ejemplo "dos huevos y un plátano".'
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
            if (user) newEntries.forEach(e => {
                addEntryRemote(user.id, e);
                rememberFood(user.id, [e.name], { name: e.name, calories: e.calories, portionGrams: e.portionGrams });
            });
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
            const fav = favorites.find(f => f.id === item.id);
            const mealType = getMealTypeFromTime();
            const newEntry: FoodEntry = {
                id: generateId(),
                name: item.name,
                calories: item.calories,
                isFavorite: false,
                timestamp: currentDate,
                mealType,
                portionGrams: fav?.portionGrams,
            };
            setEntries(prev => [newEntry, ...prev]);
            if (user) {
                addEntryRemote(user.id, newEntry);
                if (fav) bumpUsage(user.id, fav); // most-used floats to the top
            }
            if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (error) {
            logger.error('Failed to add quick item', error);
        }
    }, [currentDate, user?.id, favorites]);

    // Consume a favorite tapped on the Favorites tab (handed in via MainApp).
    useEffect(() => {
        if (pendingAdd) {
            handleQuickAdd(pendingAdd);
            onPendingAddConsumed?.();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pendingAdd]);

    // Tap a card = quick edit (grams/calories). Favorite/move/delete live in the
    // long-press menu.
    const handleCardPress = useCallback((entry: FoodEntry) => {
        setSelectedEntry(entry);
        setEditModalVisible(true);
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

    const handleSaveEdit = (newName: string, newCalories: number, newGrams?: number) => {
        if (!selectedEntry) return;
        const trimmed = newName.trim();
        // Honour the calories the user explicitly typed instead of re-estimating.
        if (!trimmed || !Number.isFinite(newCalories) || newCalories <= 0) return;
        // A manual correction is user-authoritative — clear any AI/estimate badge.
        const updated = {
            ...selectedEntry,
            name: trimmed,
            calories: Math.round(newCalories),
            portionGrams: newGrams,
            source: undefined,
        };
        setEntries(prev => prev.map(e => e.id === selectedEntry.id ? updated : e));
        updateEntryRemote(updated);
        // A manual correction is the strongest signal — remember it (incl. the
        // per-gram and, if we know the count, per-unit ratios) so this food uses
        // the user's value next time it's logged.
        if (user) rememberFood(
            user.id,
            [trimmed],
            { name: trimmed, calories: updated.calories, portionGrams: newGrams, unitCount: selectedEntry.unitCount }
        );
    };

    const handleDelete = useCallback(async () => {
        setMenuVisible(false);
        if (!selectedEntry) return;
        Alert.alert('Eliminar', `¿Quitar "${selectedEntry.name}"?`, [
            { text: 'Cancelar', style: 'cancel' },
            {
                text: 'Eliminar',
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

    const handleToggleFavorite = useCallback(async () => {
        setMenuVisible(false);
        if (!selectedEntry || !user) return;
        const existing = favorites.find(f => f.name.toLowerCase() === selectedEntry.name.toLowerCase());
        if (existing) {
            removeFavorite(existing.id);
            setFavorites(prev => prev.filter(f => f.id !== existing.id));
            setEntries(prev => prev.map(e => e.id === selectedEntry.id ? { ...e, isFavorite: false } : e));
        } else {
            const fav = await addFavorite(user.id, {
                name: selectedEntry.name,
                calories: selectedEntry.calories,
                portionGrams: selectedEntry.portionGrams,
            });
            setFavorites(prev => [fav, ...prev]);
            setEntries(prev => prev.map(e => e.id === selectedEntry.id ? { ...e, isFavorite: true } : e));
        }
    }, [selectedEntry, user?.id, favorites]);

    const handleDateChange = (newDate: Date) => { dismissReview(); setCurrentDate(newDate); };
    const handleDateSelect = (date: Date) => { dismissReview(); setCurrentDate(date); };

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

                    {reviewEntry && (
                        <View style={styles.reviewBanner}>
                            <View style={styles.reviewRow}>
                                <View style={styles.reviewInfo}>
                                    <Text style={styles.reviewLabel}>
                                        {reviewOptions.length > 0 ? 'Detecté · ¿qué tamaño?' : 'Detecté'}
                                    </Text>
                                    <Text style={styles.reviewText} numberOfLines={1}>
                                        {reviewEntry.name} · {reviewEntry.calories} kcal
                                    </Text>
                                    {reviewDetail && (
                                        <Text style={styles.reviewSub} numberOfLines={1}>{reviewDetail}</Text>
                                    )}
                                </View>
                                <Pressable
                                    onPress={dismissReview}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    accessibilityRole="button"
                                    accessibilityLabel="Está bien"
                                >
                                    <Ionicons name="checkmark" size={22} color={colors.accent} />
                                </Pressable>
                            </View>

                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.reviewChips}
                                keyboardShouldPersistTaps="handled"
                            >
                                {reviewOptions.map((opt) => {
                                    const active = opt.calories === reviewEntry.calories;
                                    return (
                                        <Pressable
                                            key={opt.label}
                                            style={[styles.reviewChip, active && styles.reviewChipActive]}
                                            onPress={() => handlePickOption(opt)}
                                            accessibilityRole="button"
                                            accessibilityLabel={`${opt.label}, ${opt.calories} kilocalorías`}
                                        >
                                            <Text style={[styles.reviewChipText, active && styles.reviewChipTextActive]}>
                                                {opt.label} · {opt.calories}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                                <Pressable
                                    style={[styles.reviewChip, styles.reviewChipEdit]}
                                    onPress={handleReviewEdit}
                                    accessibilityRole="button"
                                    accessibilityLabel="Corregir manualmente"
                                >
                                    <Text style={styles.reviewEditText}>✎ Otro</Text>
                                </Pressable>
                            </ScrollView>
                        </View>
                    )}

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
    reviewBanner: {
        position: 'absolute',
        bottom: 84,
        left: 16,
        right: 16,
        zIndex: 1001,
        flexDirection: 'column',
        gap: 10,
        backgroundColor: colors.cardBackground,
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        shadowColor: colors.textPrimary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 6,
    },
    reviewRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    reviewInfo: {
        flex: 1,
    },
    reviewChips: {
        flexDirection: 'row',
        gap: 8,
        paddingRight: 4,
    },
    reviewChip: {
        paddingVertical: 7,
        paddingHorizontal: 12,
        borderRadius: 999,
        backgroundColor: colors.inputBackground,
        borderWidth: 1,
        borderColor: colors.cardBorder,
    },
    reviewChipActive: {
        backgroundColor: colors.accentSubtle,
        borderColor: colors.accent,
    },
    reviewChipText: {
        fontSize: 13,
        fontWeight: '500',
        color: colors.textSecondary,
    },
    reviewChipTextActive: {
        color: colors.accent,
    },
    reviewChipEdit: {
        backgroundColor: 'transparent',
    },
    reviewLabel: {
        fontSize: 11,
        color: colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    reviewText: {
        fontSize: 15,
        fontWeight: '400',
        color: colors.textPrimary,
    },
    reviewSub: {
        fontSize: 12,
        color: colors.textMuted,
        marginTop: 1,
    },
    reviewEditBtn: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 10,
        backgroundColor: colors.accentSubtle,
    },
    reviewEditText: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.accent,
    },
});
