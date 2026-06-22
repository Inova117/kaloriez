import { supabase } from './supabase';
import { logger } from '../utils/logger';

export interface FoodSuggestion {
    name: string;
    calories: number;
    description?: string;
    verified?: boolean; // true when the calories came from USDA ground truth
}

/**
 * Ask the server-side `food-ai` Edge Function for calorie suggestions.
 *
 * The Gemini + USDA keys live on the server; this client only sends the query
 * (the user's Supabase JWT is attached automatically by functions.invoke).
 * Numeric fields are validated server-side and re-checked here as defense in
 * depth. Returns [] on any failure so callers can fall back to a local estimate.
 */
export async function getFoodSuggestions(query: string): Promise<FoodSuggestion[]> {
    try {
        const { data, error } = await supabase.functions.invoke('food-ai', {
            body: { query },
        });
        if (error) {
            logger.error('food-ai function error', error);
            return [];
        }

        const raw = (data?.suggestions ?? []) as any[];
        return raw
            .map((s) => ({
                name: String(s?.name ?? '').trim() || 'Food',
                calories: Number(s?.calories),
                description: s?.description,
                verified: s?.verified === true,
            }))
            .filter((s) => Number.isFinite(s.calories) && s.calories >= 0)
            .map((s) => ({ ...s, calories: Math.round(s.calories) }));
    } catch (error) {
        logger.error('food-ai invoke failed', error);
        return [];
    }
}
