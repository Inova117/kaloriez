import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import { FoodEntry } from '../types';

// The app stores entries under per-date keys ('@entries_<YYYY-MM-DD>'), so the
// migration must enumerate those — the old single '@food_entries' key was never
// written by anything and silently migrated nothing.
const ENTRIES_PREFIX = '@entries_';
const GOAL_STORAGE_KEY = '@daily_goal';

export async function migrateLocalDataToSupabase(userId: string): Promise<void> {
    try {
        // 1. Daily calorie goal
        const goalJson = await AsyncStorage.getItem(GOAL_STORAGE_KEY);
        const goal = goalJson ? parseInt(goalJson, 10) : NaN;
        if (Number.isFinite(goal) && goal > 0) {
            const { error } = await supabase
                .from('profiles')
                .update({ daily_calorie_goal: goal, updated_at: new Date().toISOString() })
                .eq('id', userId);
            if (error) logger.error('Error migrating daily goal', error);
        }

        // 2. Food entries — collected from every per-date bucket.
        const allKeys = await AsyncStorage.getAllKeys();
        const entryKeys = allKeys.filter(k => k.startsWith(ENTRIES_PREFIX));

        const rows: Array<Record<string, unknown>> = [];
        for (const key of entryKeys) {
            const raw = await AsyncStorage.getItem(key);
            if (!raw) continue;
            let entries: FoodEntry[] = [];
            try {
                entries = JSON.parse(raw);
            } catch {
                continue;
            }
            for (const entry of entries) {
                rows.push({
                    user_id: userId,
                    name: entry.name,
                    calories: entry.calories,
                    meal_type: entry.mealType,
                    is_favorite: entry.isFavorite || false,
                    timestamp: new Date(entry.timestamp).toISOString(),
                });
            }
        }

        if (rows.length > 0) {
            const { error } = await supabase.from('food_entries').insert(rows);
            if (error) logger.error('Error migrating food entries', error);
            else logger.debug(`Migrated ${rows.length} food entries to Supabase`);
        }
    } catch (error) {
        logger.error('Error during data migration', error);
        throw error;
    }
}

export async function loadUserDataFromSupabase(userId: string): Promise<{
    entries: FoodEntry[];
    dailyGoal: number;
}> {
    try {
        const [profileResult, entriesResult] = await Promise.all([
            supabase
                .from('profiles')
                .select('daily_calorie_goal')
                .eq('id', userId)
                .single(),
            supabase
                .from('food_entries')
                .select('*')
                .eq('user_id', userId)
                .order('timestamp', { ascending: false }),
        ]);

        const dailyGoal = profileResult.data?.daily_calorie_goal || 2000;
        
        const entries: FoodEntry[] = (entriesResult.data || []).map(entry => ({
            id: entry.id,
            name: entry.name,
            calories: entry.calories,
            mealType: entry.meal_type,
            timestamp: entry.timestamp,
            isFavorite: entry.is_favorite,
        }));

        return { entries, dailyGoal };
    } catch (error) {
        logger.error('Error loading user data from Supabase', error);
        return { entries: [], dailyGoal: 2000 };
    }
}

export async function saveFoodEntryToSupabase(
    userId: string,
    entry: Omit<FoodEntry, 'id'>
): Promise<string | null> {
    try {
        const { data, error } = await supabase
            .from('food_entries')
            .insert({
                user_id: userId,
                name: entry.name,
                calories: entry.calories,
                meal_type: entry.mealType,
                is_favorite: entry.isFavorite || false,
                timestamp: entry.timestamp,
            })
            .select()
            .single();

        if (error) throw error;

        return data?.id || null;
    } catch (error) {
        logger.error('Error saving food entry', error);
        return null;
    }
}

export async function deleteFoodEntryFromSupabase(entryId: string): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('food_entries')
            .delete()
            .eq('id', entryId);

        if (error) throw error;

        return true;
    } catch (error) {
        logger.error('Error deleting food entry', error);
        return false;
    }
}

export async function updateDailyGoalInSupabase(
    userId: string,
    dailyGoal: number
): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('profiles')
            .update({
                daily_calorie_goal: dailyGoal,
                updated_at: new Date().toISOString(),
            })
            .eq('id', userId);

        if (error) throw error;

        return true;
    } catch (error) {
        logger.error('Error updating daily goal', error);
        return false;
    }
}
