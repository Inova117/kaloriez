export type ProcessingState = 'idle' | 'processing' | 'done';
import { colors } from '../theme/colors';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

export interface FoodEntry {
    id: string;
    name: string;
    calories: number;
    isFavorite: boolean;
    timestamp: Date;
    mealType: MealType;
}

export interface QuickAddItem {
    id: string;
    name: string;
    emoji: string;
    calories: number;
}

export interface MealConfig {
    icon: string;
    color: string;
    label: string;
}

export const MEAL_CONFIGS: Record<MealType, MealConfig> = {
    breakfast: {
        icon: '🌅',
        color: colors.mealBreakfast,
        label: 'Breakfast',
    },
    lunch: {
        icon: '☀️',
        color: colors.mealLunch,
        label: 'Lunch',
    },
    dinner: {
        icon: '🌙',
        color: colors.mealDinner,
        label: 'Dinner',
    },
    snacks: {
        icon: '🍿',
        color: colors.mealSnacks,
        label: 'Snacks',
    },
};
