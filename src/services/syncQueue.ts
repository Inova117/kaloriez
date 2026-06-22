import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';

/**
 * Durable offline write queue.
 *
 * Remote writes (food/weight mutations) are enqueued and then flushed. When the
 * device is online the flush drains the queue immediately; when offline the ops
 * persist in AsyncStorage and are retried on the next flush (app launch or the
 * next mutation). All ops are idempotent (upsert / delete-by-id) so replaying a
 * partially-applied queue is safe.
 */
export type SyncOp =
    | { kind: 'food_upsert'; row: Record<string, unknown> }
    | { kind: 'food_update'; id: string; patch: Record<string, unknown> }
    | { kind: 'food_delete'; id: string }
    | { kind: 'weight_upsert'; row: Record<string, unknown> };

const QUEUE_KEY = '@sync_queue';
let isFlushing = false;

async function readQueue(): Promise<SyncOp[]> {
    try {
        const raw = await AsyncStorage.getItem(QUEUE_KEY);
        return raw ? (JSON.parse(raw) as SyncOp[]) : [];
    } catch {
        return [];
    }
}

async function writeQueue(queue: SyncOp[]): Promise<void> {
    try {
        await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
        logger.error('Failed to persist sync queue', error);
    }
}

async function apply(op: SyncOp): Promise<void> {
    if (op.kind === 'food_upsert') {
        const { error } = await supabase.from('food_entries').upsert(op.row, { onConflict: 'id' });
        if (error) throw error;
    } else if (op.kind === 'food_update') {
        const { error } = await supabase.from('food_entries').update(op.patch).eq('id', op.id);
        if (error) throw error;
    } else if (op.kind === 'food_delete') {
        const { error } = await supabase.from('food_entries').delete().eq('id', op.id);
        if (error) throw error;
    } else if (op.kind === 'weight_upsert') {
        const { error } = await supabase
            .from('weight_entries')
            .upsert(op.row, { onConflict: 'user_id,date' });
        if (error) throw error;
    }
}

export async function enqueue(op: SyncOp): Promise<void> {
    const queue = await readQueue();
    queue.push(op);
    await writeQueue(queue);
}

/**
 * Replay queued ops in order. Stops at the first failure (assumed offline) and
 * keeps that op + the rest for the next attempt, preserving ordering.
 */
export async function flushQueue(): Promise<void> {
    if (isFlushing) return;
    isFlushing = true;
    try {
        let queue = await readQueue();
        while (queue.length > 0) {
            const op = queue[0];
            try {
                await apply(op);
            } catch (error) {
                logger.error('Sync flush halted (will retry later)', error);
                break; // still offline / server error — keep remaining ops
            }
            queue = queue.slice(1);
            await writeQueue(queue);
        }
    } finally {
        isFlushing = false;
    }
}

/** Enqueue an op and immediately attempt to flush (online → applies now). */
export async function enqueueAndFlush(op: SyncOp): Promise<void> {
    await enqueue(op);
    await flushQueue();
}
