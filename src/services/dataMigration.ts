import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { FoodEntry } from '../types';

const ENTRIES_STORAGE_KEY = '@food_entries';
const GOAL_STORAGE_KEY = '@daily_goal';
const USER_PROFILE_KEY = '@user_profile';

export async function migrateLocalDataToSupabase(userId: string): Promise<void> {
    try {
        const [entriesJson, goalJson, profileJson] = await Promise.all([
            AsyncStorage.getItem(ENTRIES_STORAGE_KEY),
            AsyncStorage.getItem(GOAL_STORAGE_KEY),
            AsyncStorage.getItem(USER_PROFILE_KEY),
        ]);

        if (profileJson) {
            const profile = JSON.parse(profileJson);
            const goal = goalJson ? parseInt(goalJson) : 2000;

            await supabase
                .from('profiles')
                .update({
                    daily_calorie_goal: goal,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', userId);
        }

        if (entriesJson) {
            const entries: FoodEntry[] = JSON.parse(entriesJson);
            
            if (entries.length > 0) {
                const foodEntries = entries.map(entry => ({
                    user_id: userId,
                    name: entry.name,
                    calories: entry.calories,
                    meal_type: entry.mealType,
                    is_favorite: entry.isFavorite || false,
                    timestamp: entry.timestamp,
                }));

                const { error } = await supabase
                    .from('food_entries')
                    .insert(foodEntries);

                if (error) {
                    console.error('Error migrating food entries:', error);
                } else {
                    console.log(`✅ Migrated ${entries.length} food entries to Supabase`);
                }
            }
        }

        console.log('✅ Data migration completed successfully');
    } catch (error) {
        console.error('Error during data migration:', error);
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
        console.error('Error loading user data from Supabase:', error);
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
        console.error('Error saving food entry:', error);
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
        console.error('Error deleting food entry:', error);
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
        console.error('Error updating daily goal:', error);
        return false;
    }
}
