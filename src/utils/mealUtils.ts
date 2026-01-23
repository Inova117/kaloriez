import { MealType } from '../types';

/**
 * Determines meal type based on time of day
 */
export function getMealTypeFromTime(date: Date = new Date()): MealType {
    const hour = date.getHours();

    if (hour >= 5 && hour < 11) return 'breakfast';
    if (hour >= 11 && hour < 15) return 'lunch';
    if (hour >= 15 && hour < 20) return 'dinner';
    return 'snacks';
}

/**
 * Gets a friendly time range description for a meal type
 */
export function getMealTimeRange(mealType: MealType): string {
    const ranges: Record<MealType, string> = {
        breakfast: '5am - 11am',
        lunch: '11am - 3pm',
        dinner: '3pm - 8pm',
        snacks: '8pm - 5am',
    };
    return ranges[mealType];
}
