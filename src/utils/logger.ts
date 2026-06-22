import * as Sentry from '@sentry/react-native';

/**
 * Lightweight logger.
 *
 * In development it mirrors console so the existing debugging experience is
 * unchanged. In production it stays silent on the JS thread (avoiding the cost
 * and the privacy leak of logging raw user food queries / AI responses to the
 * device console) and routes real errors to Sentry, which the app previously
 * initialised but never fed via captureException.
 */
const isDev = typeof __DEV__ !== 'undefined' && __DEV__;

export const logger = {
    debug: (...args: unknown[]): void => {
        if (isDev) console.log(...args);
    },
    warn: (...args: unknown[]): void => {
        if (isDev) console.warn(...args);
    },
    error: (message: string, error?: unknown): void => {
        if (isDev) {
            console.error(message, error);
            return;
        }
        if (error instanceof Error) {
            Sentry.captureException(error, { extra: { message } });
        } else {
            Sentry.captureMessage(message, 'error');
        }
    },
};
