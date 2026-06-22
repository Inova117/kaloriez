import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import { enqueueAndFlush } from './syncQueue';

export interface WeightEntry {
    date: string; // YYYY-MM-DD
    weight: number;
}

const WEIGHT_HISTORY_KEY = '@weight_history';

/**
 * Weight history repository. Supabase (weight_entries) is the source of truth;
 * AsyncStorage mirrors it for offline reads. One row per (user, date).
 */
export async function fetchWeights(userId: string): Promise<WeightEntry[]> {
    try {
        const { data, error } = await supabase
            .from('weight_entries')
            .select('date, weight')
            .eq('user_id', userId)
            .order('date', { ascending: true });
        if (error) throw error;

        const entries: WeightEntry[] = (data ?? []).map((r: any) => ({
            date: r.date,
            weight: Number(r.weight),
        }));
        await AsyncStorage.setItem(WEIGHT_HISTORY_KEY, JSON.stringify(entries));
        return entries;
    } catch (error) {
        logger.error('fetchWeights failed; falling back to local cache', error);
        try {
            const cached = await AsyncStorage.getItem(WEIGHT_HISTORY_KEY);
            return cached ? JSON.parse(cached) : [];
        } catch {
            return [];
        }
    }
}

export async function saveWeightLocal(history: WeightEntry[]): Promise<void> {
    try {
        await AsyncStorage.setItem(WEIGHT_HISTORY_KEY, JSON.stringify(history));
    } catch (error) {
        logger.error('saveWeightLocal failed', error);
    }
}

export async function upsertWeightRemote(
    userId: string,
    date: string,
    weight: number
): Promise<void> {
    await enqueueAndFlush({
        kind: 'weight_upsert',
        row: { user_id: userId, date, weight },
    });
}
