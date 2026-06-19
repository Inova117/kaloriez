/**
 * Date formatting and manipulation utilities
 */

/**
 * Formats a date to storage key format (YYYY-MM-DD) in local timezone
 */
export function formatDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Checks if a date is today
 */
export function isToday(date: Date): boolean {
    const today = new Date();
    return formatDateKey(date) === formatDateKey(today);
}

/**
 * Formats date for display
 */
export function formatDisplayDate(date: Date): string {
    if (isToday(date)) return 'Today';

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (formatDateKey(date) === formatDateKey(yesterday)) return 'Yesterday';

    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
}

/**
 * Gets the last N days including today
 */
export function getLastNDays(date: Date, n: number): Date[] {
    const days: Date[] = [];
    for (let i = 0; i < n; i++) {
        const day = new Date(date);
        day.setDate(day.getDate() - i);
        days.push(day);
    }
    return days;
}

/**
 * Checks if date is in the future
 */
export function isFuture(date: Date): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    return compareDate > today;
}

/**
 * Adds days to a date
 */
export function addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

/**
 * Checks if two dates are the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
    return formatDateKey(date1) === formatDateKey(date2);
}
