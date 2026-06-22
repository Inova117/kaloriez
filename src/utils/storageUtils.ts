import AsyncStorage from '@react-native-async-storage/async-storage';
import { FoodEntry } from '../types';
import { formatDateKey } from './dateUtils';
import { logger } from './logger';

const ENTRIES_PREFIX = '@entries_';

/**
 * Save entries for a specific date
 */
export async function saveEntriesForDate(date: Date, entries: FoodEntry[]): Promise<void> {
    const key = `${ENTRIES_PREFIX}${formatDateKey(date)}`;
    try {
        await AsyncStorage.setItem(key, JSON.stringify(entries));
    } catch (error) {
        logger.error('Failed to save entries', error);
    }
}

/**
 * Load entries for a specific date
 */
export async function loadEntriesForDate(date: Date): Promise<FoodEntry[]> {
    const key = `${ENTRIES_PREFIX}${formatDateKey(date)}`;
    try {
        const stored = await AsyncStorage.getItem(key);
        if (stored) {
            const parsed = JSON.parse(stored);
            // Convert timestamp strings back to Date objects
            return parsed.map((entry: any) => ({
                ...entry,
                timestamp: new Date(entry.timestamp),
            }));
        }
    } catch (error) {
        logger.error('Failed to load entries', error);
    }
    return [];
}

/**
 * Get all dates that have entries
 */
export async function getDatesWithEntries(): Promise<Set<string>> {
    try {
        const allKeys = await AsyncStorage.getAllKeys();
        const entryKeys = allKeys.filter(key => key.startsWith(ENTRIES_PREFIX));
        const dates = entryKeys.map(key => key.replace(ENTRIES_PREFIX, ''));
        return new Set(dates);
    } catch (error) {
        logger.error('Failed to get dates with entries', error);
        return new Set();
    }
}

/**
 * Load entries for multiple dates
 */
export async function loadEntriesForDateRange(dates: Date[]): Promise<Record<string, FoodEntry[]>> {
    const result: Record<string, FoodEntry[]> = {};

    await Promise.all(
        dates.map(async (date) => {
            const key = formatDateKey(date);
            result[key] = await loadEntriesForDate(date);
        })
    );

    return result;
}

/**
 * Delete entries for a specific date
 */
export async function deleteEntriesForDate(date: Date): Promise<void> {
    const key = `${ENTRIES_PREFIX}${formatDateKey(date)}`;
    try {
        await AsyncStorage.removeItem(key);
    } catch (error) {
        logger.error('Failed to delete entries', error);
    }
}
