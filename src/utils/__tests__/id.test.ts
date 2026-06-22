import { generateId } from '../id';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('generateId', () => {
    it('produces a valid v4 UUID', () => {
        expect(generateId()).toMatch(UUID_V4);
    });

    it('produces unique ids', () => {
        const ids = new Set(Array.from({ length: 1000 }, () => generateId()));
        expect(ids.size).toBe(1000);
    });
});
