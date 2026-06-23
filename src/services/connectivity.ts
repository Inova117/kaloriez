import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

/**
 * Single source of truth for online/offline state. Web uses the browser's
 * online/offline events; native uses NetInfo. Subscribers are notified only on
 * actual transitions.
 */
type Listener = (online: boolean) => void;

let online = true;
const listeners = new Set<Listener>();

function setOnline(next: boolean) {
    if (next === online) return;
    online = next;
    listeners.forEach((l) => l(online));
}

if (Platform.OS === 'web') {
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
        online = navigator.onLine;
    }
    const w: any = (globalThis as any);
    if (w?.addEventListener) {
        w.addEventListener('online', () => setOnline(true));
        w.addEventListener('offline', () => setOnline(false));
    }
} else {
    NetInfo.fetch().then((s) => setOnline(Boolean(s.isConnected))).catch(() => {});
    NetInfo.addEventListener((state) => {
        // isConnected can be true while still validating; treat connected as online.
        setOnline(Boolean(state.isConnected));
    });
}

export function isOnline(): boolean {
    return online;
}

export function subscribeConnectivity(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
