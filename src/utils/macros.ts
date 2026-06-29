import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from './logger';

/** Daily macronutrient targets, in grams. */
export interface MacroGoals {
    protein: number;
    carbs: number;
    fat: number;
}

const KEY = '@macro_goals';

// Default split: 30% protein / 40% carbs / 30% fat. Protein & carbs = 4 kcal/g,
// fat = 9 kcal/g.
export function defaultMacros(dailyGoal: number): MacroGoals {
    const goal = dailyGoal > 0 ? dailyGoal : 2000;
    return {
        protein: Math.round((goal * 0.30) / 4),
        carbs: Math.round((goal * 0.40) / 4),
        fat: Math.round((goal * 0.30) / 9),
    };
}

/** Stored custom macros, or the derived defaults if the user hasn't set any. */
export async function loadMacros(dailyGoal: number): Promise<{ macros: MacroGoals; custom: boolean }> {
    try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) {
            const m = JSON.parse(raw) as MacroGoals;
            if (Number.isFinite(m.protein) && Number.isFinite(m.carbs) && Number.isFinite(m.fat)) {
                return { macros: m, custom: true };
            }
        }
    } catch (error) {
        logger.error('loadMacros failed', error);
    }
    return { macros: defaultMacros(dailyGoal), custom: false };
}

export async function saveMacros(m: MacroGoals): Promise<void> {
    try {
        await AsyncStorage.setItem(KEY, JSON.stringify({
            protein: Math.max(0, Math.round(m.protein)),
            carbs: Math.max(0, Math.round(m.carbs)),
            fat: Math.max(0, Math.round(m.fat)),
        }));
    } catch (error) {
        logger.error('saveMacros failed', error);
    }
}

/** Forget custom macros so they fall back to the goal-derived defaults. */
export async function resetMacros(): Promise<void> {
    try {
        await AsyncStorage.removeItem(KEY);
    } catch (error) {
        logger.error('resetMacros failed', error);
    }
}

/** kcal represented by a macro set (sanity/sum display). */
export function macroCalories(m: MacroGoals): number {
    return Math.round(m.protein * 4 + m.carbs * 4 + m.fat * 9);
}
