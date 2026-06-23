import { Alert, Platform } from 'react-native';

/**
 * Cross-platform simple alert. react-native-web does NOT implement Alert.alert,
 * so on web we fall back to the browser dialog; on native we use Alert.alert.
 * For informational/error messages only (no button callbacks).
 */
export function notify(title: string, message?: string): void {
    if (Platform.OS === 'web') {
        const text = message ? `${title}\n\n${message}` : title;
        (globalThis as any).alert?.(text);
        return;
    }
    Alert.alert(title, message);
}
