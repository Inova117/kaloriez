import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import { FoodEntry } from '../types';
import { formatDateKey } from '../utils/dateUtils';
import {
    saveEntriesForDate,
    loadEntriesForDate as loadCachedEntriesForDate,
    loadEntriesForDateRange as loadCachedEntriesForDateRange,
} from '../utils/storageUtils';
import { enqueueAndFlush } from './syncQueue';

/**
 * Repository for food entries. Supabase is the source of truth; AsyncStorage is
 * a per-date offline cache that is refreshed on every successful fetch and used
 * as a fallback when the network is unavailable.
 *
 * Known limitation: writes made while offline are persisted to the local cache
 * (so they are not lost) but are not yet retried against Supabase — there is no
 * offline write queue. A reconciliation/queue is the next iteration.
 */

function localDayBounds(date: Date): { startISO: string; endISO: string } {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return { startISO: start.toISOString(), endISO: end.toISOString() };
}

function mapRow(row: any): FoodEntry {
    return {
        id: row.id,
        name: row.name,
        calories: row.calories,
        mealType: row.meal_type,
        isFavorite: row.is_favorite,
        timestamp: new Date(row.timestamp),
        source: row.source ?? undefined,
        portionGrams: row.portion_grams ?? undefined,
        unitCount: row.unit_count ?? undefined,
    };
}

export async function fetchEntriesForDate(userId: string, date: Date): Promise<FoodEntry[]> {
    const { startISO, endISO } = localDayBounds(date);
    try {
        const { data, error } = await supabase
            .from('food_entries')
            .select('*')
            .eq('user_id', userId)
            .gte('timestamp', startISO)
            .lte('timestamp', endISO)
            .order('timestamp', { ascending: false });
        if (error) throw error;

        const entries = (data ?? []).map(mapRow);
        await saveEntriesForDate(date, entries); // refresh offline cache
        return entries;
    } catch (error) {
        logger.error('fetchEntriesForDate failed; falling back to local cache', error);
        return loadCachedEntriesForDate(date);
    }
}

export async function fetchEntriesForRange(
    userId: string,
    dates: Date[]
): Promise<Record<string, FoodEntry[]>> {
    if (dates.length === 0) return {};
    const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
    const startISO = (() => { const d = new Date(sorted[0]); d.setHours(0, 0, 0, 0); return d.toISOString(); })();
    const endISO = (() => { const d = new Date(sorted[sorted.length - 1]); d.setHours(23, 59, 59, 999); return d.toISOString(); })();

    try {
        const { data, error } = await supabase
            .from('food_entries')
            .select('*')
            .eq('user_id', userId)
            .gte('timestamp', startISO)
            .lte('timestamp', endISO)
            .order('timestamp', { ascending: false });
        if (error) throw error;

        const result: Record<string, FoodEntry[]> = {};
        for (const date of dates) result[formatDateKey(date)] = [];
        for (const row of data ?? []) {
            const entry = mapRow(row);
            const key = formatDateKey(entry.timestamp);
            if (result[key]) result[key].push(entry);
        }
        // Refresh cache for each day we now have authoritative data for.
        await Promise.all(dates.map((date) => saveEntriesForDate(date, result[formatDateKey(date)] ?? [])));
        return result;
    } catch (error) {
        logger.error('fetchEntriesForRange failed; falling back to local cache', error);
        return loadCachedEntriesForDateRange(dates);
    }
}

// All mutations go through the durable sync queue so they survive being offline
// and are retried on reconnect (the queue flushes immediately when online).
export async function addEntryRemote(userId: string, entry: FoodEntry): Promise<void> {
    await enqueueAndFlush({
        kind: 'food_upsert',
        row: {
            id: entry.id,
            user_id: userId,
            name: entry.name,
            calories: entry.calories,
            meal_type: entry.mealType,
            is_favorite: entry.isFavorite ?? false,
            timestamp: new Date(entry.timestamp).toISOString(),
            source: entry.source ?? null,
            portion_grams: entry.portionGrams ?? null,
            unit_count: entry.unitCount ?? null,
        },
    });
}

export async function updateEntryRemote(entry: FoodEntry): Promise<void> {
    await enqueueAndFlush({
        kind: 'food_update',
        id: entry.id,
        patch: {
            name: entry.name,
            calories: entry.calories,
            meal_type: entry.mealType,
            is_favorite: entry.isFavorite ?? false,
            source: entry.source ?? null,
            portion_grams: entry.portionGrams ?? null,
            unit_count: entry.unitCount ?? null,
        },
    });
}

export async function deleteEntryRemote(entryId: string): Promise<void> {
    await enqueueAndFlush({ kind: 'food_delete', id: entryId });
}
