import {
    formatDateKey,
    isSameDay,
    addDays,
    isFuture,
    getLastNDays,
} from '../dateUtils';

describe('formatDateKey', () => {
    it('formats as YYYY-MM-DD with zero padding (local date)', () => {
        expect(formatDateKey(new Date(2024, 0, 5))).toBe('2024-01-05');
        expect(formatDateKey(new Date(2024, 11, 31))).toBe('2024-12-31');
    });
});

describe('isSameDay', () => {
    it('ignores the time component', () => {
        expect(isSameDay(new Date(2024, 5, 1, 8), new Date(2024, 5, 1, 23))).toBe(true);
        expect(isSameDay(new Date(2024, 5, 1), new Date(2024, 5, 2))).toBe(false);
    });
});

describe('addDays', () => {
    it('adds and subtracts days without mutating the input', () => {
        const base = new Date(2024, 0, 10);
        expect(formatDateKey(addDays(base, 5))).toBe('2024-01-15');
        expect(formatDateKey(addDays(base, -10))).toBe('2023-12-31');
        expect(formatDateKey(base)).toBe('2024-01-10'); // unchanged
    });
});

describe('getLastNDays', () => {
    it('returns N days ending at the given date, most recent first', () => {
        const days = getLastNDays(new Date(2024, 0, 7), 7);
        expect(days).toHaveLength(7);
        expect(formatDateKey(days[0])).toBe('2024-01-07');
        expect(formatDateKey(days[6])).toBe('2024-01-01');
    });
});

describe('isFuture', () => {
    it('returns false for today and past, true for tomorrow', () => {
        expect(isFuture(new Date())).toBe(false);
        expect(isFuture(addDays(new Date(), -1))).toBe(false);
        expect(isFuture(addDays(new Date(), 1))).toBe(true);
    });
});
