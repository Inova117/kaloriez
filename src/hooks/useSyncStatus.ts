import { useEffect, useRef, useState } from 'react';
import { isOnline, subscribeConnectivity } from '../services/connectivity';
import { getPending, isSyncing, subscribeQueue } from '../services/syncQueue';

export type SyncState = 'idle' | 'offline' | 'syncing' | 'synced';

/**
 * Derives a UI sync state from connectivity + the offline write queue:
 *  - 'offline': no connection and there are unsynced changes
 *  - 'syncing': currently flushing the queue
 *  - 'synced' : just finished flushing (shown briefly, then 'idle')
 *  - 'idle'   : nothing to show
 */
export function useSyncStatus(): SyncState {
    const [online, setOnline] = useState(isOnline());
    const [pending, setPending] = useState(getPending());
    const [syncing, setSyncing] = useState(isSyncing());
    const [justSynced, setJustSynced] = useState(false);
    const prevPending = useRef(getPending());
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const unsubConn = subscribeConnectivity(setOnline);
        const unsubQueue = subscribeQueue(() => {
            const p = getPending();
            setPending(p);
            setSyncing(isSyncing());
            // Transition from "had pending" to "nothing pending" while online = synced.
            if (prevPending.current > 0 && p === 0 && isOnline()) {
                setJustSynced(true);
                if (timer.current) clearTimeout(timer.current);
                timer.current = setTimeout(() => setJustSynced(false), 2200);
            }
            prevPending.current = p;
        });
        return () => {
            unsubConn();
            unsubQueue();
            if (timer.current) clearTimeout(timer.current);
        };
    }, []);

    if (syncing) return 'syncing';
    if (!online && pending > 0) return 'offline';
    if (justSynced) return 'synced';
    return 'idle';
}
