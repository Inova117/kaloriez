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
            >
                <View style={styles.leftSection}>
                    <Text style={styles.mealEmoji}>{mealConfig.icon}</Text>
                    {entry.isFavorite && (
                        <Ionicons
                            name={entry.isFavorite ? 'star' : 'star-outline'}
                            size={16}
                            color={entry.isFavorite ? colors.favorite : colors.textMuted}
                            style={styles.starIcon}
                        />
                    )}
                    <Text style={styles.foodName} numberOfLines={1}>{entry.name}</Text>
                </View>

                <View style={styles.rightSection}>
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
        marginBottom: 6,
    },
    pressable: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.cardBackground,
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    leftSection: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 12,
    },
    mealEmoji: {
        fontSize: 16,
        marginRight: 8,
    },
    starIcon: {
        marginRight: 8,
    },
    foodName: {
        ...typography.foodName,
        flex: 1,
    },
    rightSection: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    calories: {
        ...typography.cardCalories,
    },
    unit: {
        ...typography.cardUnit,
    },
});
