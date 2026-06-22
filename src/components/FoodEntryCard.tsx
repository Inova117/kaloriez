import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    FadeInDown,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { FoodEntry, MEAL_CONFIGS } from '../types';

interface FoodEntryCardProps {
    entry: FoodEntry;
    index?: number;
    onPress?: (entry: FoodEntry) => void;
    onLongPress?: (entry: FoodEntry) => void;
}

export function FoodEntryCard({ entry, index = 0, onPress, onLongPress }: FoodEntryCardProps) {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: scale.value }],
        };
    });

    const handlePressIn = () => {
        scale.value = withSpring(0.98);
    };

    const handlePressOut = () => {
        scale.value = withSpring(1);
    };

    const mealConfig = MEAL_CONFIGS[entry.mealType || 'snacks'];

    return (
        <Animated.View
            entering={FadeInDown.delay(index * 50).springify()}
            style={[styles.container, animatedStyle]}
        >
            <Pressable
                style={styles.pressable}
                onPress={() => onPress?.(entry)}
                onLongPress={() => onLongPress?.(entry)}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                delayLongPress={500}
                accessibilityRole="button"
                accessibilityLabel={`${entry.name}, ${entry.calories} kilocalories${
                    entry.source === 'verified' ? ', USDA verified'
                    : entry.source === 'guess' ? ', rough estimate'
                    : ''
                }${entry.isFavorite ? ', favorite' : ''}`}
                accessibilityHint="Tap to toggle favorite, long press for more options"
            >
                <View style={styles.leftSection}>
                    <Text style={styles.foodName} numberOfLines={1}>{entry.name}</Text>
                </View>

                <View style={styles.rightSection}>
                    {entry.source === 'verified' && (
                        <Ionicons
                            name="checkmark-circle"
                            size={13}
                            color={colors.success}
                            style={styles.badgeIcon}
                        />
                    )}
                    {entry.source === 'guess' && (
                        <Text style={styles.guessBadge}>est.</Text>
                    )}
                    <Text style={styles.calories}>{entry.calories}</Text>
                    <Text style={styles.unit}> kcal</Text>
                </View>
            </Pressable>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginHorizontal: 16,
        marginBottom: 4,
    },
    pressable: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.cardBackground,
        borderRadius: 12,
        padding: 12,
        marginBottom: 6,
        boxShadow: '0px 1px 4px rgba(0, 0, 0, 0.04)',
        elevation: 1,
        borderWidth: 1,
    },
    leftSection: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 12,
    },
    foodName: {
        ...typography.foodName,
        flex: 1,
    },
    rightSection: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    badgeIcon: {
        marginRight: 5,
    },
    guessBadge: {
        fontSize: 10,
        fontWeight: '500',
        color: colors.textMuted,
        marginRight: 5,
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
    calories: {
        ...typography.cardCalories,
    },
    unit: {
        ...typography.cardUnit,
    },
});
