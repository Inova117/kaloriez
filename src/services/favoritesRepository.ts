import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import { enqueueAndFlush } from './syncQueue';
import { generateId } from '../utils/id';

/**
 * Unified favorites store, backed by the Supabase `quick_add_items` table with
 * an AsyncStorage cache and the offline write queue. Replaces the old, separate
 * per-entry isFavorite flag and the local-only `@favorite_items` list.
 */
export interface Favorite {
    id: string;
    name: string;
    calories: number;
    portionGrams?: number;
    usageCount: number;
}

const CACHE_KEY = '@favorites_cache';

function mapRow(r: any): Favorite {
    return {
        id: r.id,
        name: r.name,
        calories: r.calories,
        portionGrams: r.portion_grams ?? undefined,
        usageCount: r.usage_count ?? 0,
    };
}

function rowFor(userId: string, fav: Favorite): Record<string, unknown> {
    return {
        id: fav.id,
        user_id: userId,
        name: fav.name,
        emoji: '',
        calories: fav.calories,
        portion_grams: fav.portionGrams ?? null,
        usage_count: fav.usageCount,
    };
}

export async function fetchFavorites(userId: string): Promise<Favorite[]> {
    try {
        const { data, error } = await supabase
            .from('quick_add_items')
            .select('id, name, calories, portion_grams, usage_count')
            .eq('user_id', userId)
            .order('usage_count', { ascending: false })
            .order('created_at', { ascending: false });
        if (error) throw error;

        const favs = (data ?? []).map(mapRow);
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(favs));
        return favs;
    } catch (error) {
        logger.error('fetchFavorites failed; using local cache', error);
        try {
            const cached = await AsyncStorage.getItem(CACHE_KEY);
            return cached ? (JSON.parse(cached) as Favorite[]) : [];
        } catch {
            return [];
        }
    }
}

export async function addFavorite(
    userId: string,
    data: { name: string; calories: number; portionGrams?: number }
): Promise<Favorite> {
    const fav: Favorite = {
        id: generateId(),
        name: data.name.trim(),
        calories: Math.round(data.calories),
        portionGrams: data.portionGrams,
        usageCount: 0,
    };
    await enqueueAndFlush({ kind: 'favorite_upsert', row: rowFor(userId, fav) });
    return fav;
}

export async function updateFavorite(userId: string, fav: Favorite): Promise<void> {
    await enqueueAndFlush({ kind: 'favorite_upsert', row: rowFor(userId, fav) });
}

export async function removeFavorite(id: string): Promise<void> {
    await enqueueAndFlush({ kind: 'favorite_delete', id });
}

/** Bump usage so most-used favorites float to the top of the quick-add bar. */
export async function bumpUsage(userId: string, fav: Favorite): Promise<void> {
    await enqueueAndFlush({
        kind: 'favorite_upsert',
        row: rowFor(userId, { ...fav, usageCount: (fav.usageCount ?? 0) + 1 }),
    });
}
