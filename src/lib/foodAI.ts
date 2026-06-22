import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';
import { logger } from '../utils/logger';

export interface FoodSuggestion {
    name: string;
    calories: number;
    description?: string;
    verified?: boolean; // true when the calories came from USDA ground truth
}

/** Validate/normalize the function's suggestions array (defense in depth). */
function mapSuggestions(raw: unknown): FoodSuggestion[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((s: any) => ({
            name: String(s?.name ?? '').trim() || 'Food',
            calories: Number(s?.calories),
            description: s?.description,
            verified: s?.verified === true,
        }))
        .filter((s) => Number.isFinite(s.calories) && s.calories >= 0)
        .map((s) => ({ ...s, calories: Math.round(s.calories) }));
}

/**
 * Ask the server-side `food-ai` Edge Function for calorie suggestions from text.
 * Gemini + USDA keys live on the server; this only sends the query (the user's
 * JWT is attached automatically). Returns [] on failure so callers can fall back.
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
        return mapSuggestions(data?.suggestions);
    } catch (error) {
        logger.error('food-ai invoke failed', error);
        return [];
    }
}

function guessMimeType(uri: string): string {
    const lower = uri.toLowerCase();
    if (lower.endsWith('.wav')) return 'audio/wav';
    if (lower.endsWith('.mp3')) return 'audio/mp3';
    if (lower.endsWith('.aac')) return 'audio/aac';
    if (lower.endsWith('.3gp') || lower.endsWith('.amr')) return 'audio/3gpp';
    // expo-av HIGH_QUALITY produces .m4a (AAC in an MP4 container) on both platforms.
    return 'audio/mp4';
}

/**
 * Transcribe a recorded audio clip into food entries via the `food-ai-audio`
 * Edge Function. Always deletes the temp recording afterwards. Returns [] on
 * failure.
 */
export async function processAudioDictation(uri: string): Promise<FoodSuggestion[]> {
    try {
        const audio = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
        });
        const { data, error } = await supabase.functions.invoke('food-ai-audio', {
            body: { audio, mimeType: guessMimeType(uri) },
        });
        if (error) {
            logger.error('food-ai-audio function error', error);
            return [];
        }
        return mapSuggestions(data?.suggestions);
    } catch (error) {
        logger.error('processAudioDictation failed', error);
        return [];
    } finally {
        try {
            await FileSystem.deleteAsync(uri, { idempotent: true });
        } catch {
            // best-effort cleanup
        }
    }
}
