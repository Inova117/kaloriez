import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MealSectionHeader } from './MealSectionHeader';
import { FoodEntryCard } from './FoodEntryCard';
import { MealType, FoodEntry } from '../types';
import { colors } from '../theme/colors';

interface MealSectionProps {
    mealType: MealType;
    entries: FoodEntry[];
    isExpanded: boolean;
    onToggleExpand: () => void;
    onAddToMeal: () => void;
    onEntryPress: (entry: FoodEntry) => void;
    onEntryLongPress: (entry: FoodEntry) => void;
}

export function MealSection({
    mealType,
    entries,
    isExpanded,
    onToggleExpand,
    onAddToMeal,
    onEntryPress,
    onEntryLongPress,
}: MealSectionProps) {
    const totalCalories = entries.reduce((sum, e) => sum + e.calories, 0);

    return (
        <View style={styles.container}>
            <MealSectionHeader
                mealType={mealType}
                totalCalories={totalCalories}
                itemCount={entries.length}
                isExpanded={isExpanded}
                onToggle={onToggleExpand}
                onAddPress={onAddToMeal}
            />

            {isExpanded && (
                <View style={styles.entriesContainer}>
                    {entries.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No items yet</Text>
                            <Text style={styles.emptySubtext}>Tap + to add</Text>
                        </View>
                    ) : (
                        entries.map((entry) => (
                            <FoodEntryCard
                                key={entry.id}
                                entry={entry}
                                onPress={onEntryPress}
                                onLongPress={onEntryLongPress}
                            />
                        ))
                    )}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 4,
    },
    entriesContainer: {
        paddingTop: 4,
    },
    emptyState: {
        paddingVertical: 32,
        paddingHorizontal: 20,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 15,
        color: colors.textMuted,
        marginBottom: 4,
    },
    emptySubtext: {
        fontSize: 13,
        color: colors.textDimmed,
    },
});
