export type ProcessingState = 'idle' | 'processing' | 'done';
import { colors } from '../theme/colors';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

// How trustworthy the calorie number is:
//  - 'verified': USDA ground-truth
//  - 'estimate': AI / local-database estimate
//  - 'guess':    blind fallback when nothing matched (show prominently)
export type CalorieSource = 'verified' | 'estimate' | 'guess';

export interface FoodEntry {
    id: string;
    name: string;
    calories: number;
    isFavorite: boolean;
    timestamp: Date;
    mealType: MealType;
    source?: CalorieSource;
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
