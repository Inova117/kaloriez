import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { logger } from '../utils/logger';

/**
 * Water-reminder notifications: a single repeating local notification every
 * `intervalHours` while enabled. Native-only — a no-op on web (notifications
 * aren't delivered there) and requires a dev/standalone build (not Expo Go).
 */
export const DEFAULT_INTERVAL_HOURS = 2;

/**
 * Schedule the repeating reminder every `intervalHours`. Returns true if it was
 * actually scheduled (permission granted on a supported platform), false
 * otherwise so the caller can revert the toggle.
 */
export async function enableWaterReminders(intervalHours: number = DEFAULT_INTERVAL_HOURS): Promise<boolean> {
    if (Platform.OS === 'web') return false;
    try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') return false;

        const hours = Number.isFinite(intervalHours) && intervalHours > 0 ? intervalHours : DEFAULT_INTERVAL_HOURS;
        // Only one water reminder at a time.
        await Notifications.cancelAllScheduledNotificationsAsync();
        await Notifications.scheduleNotificationAsync({
            content: {
                title: '💧 Hora de hidratarte',
                body: 'Toma un vaso de agua para seguir con tu meta.',
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                seconds: Math.round(hours * 60 * 60),
                repeats: true,
            },
        });
        return true;
    } catch (error) {
        logger.error('enableWaterReminders failed', error);
        return false;
    }
}

/** Cancel the reminder. */
export async function disableWaterReminders(): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
        await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
        logger.error('disableWaterReminders failed', error);
    }
}
