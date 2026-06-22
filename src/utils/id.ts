/**
 * RFC4122-ish v4 id generator. Used for food-entry ids so the client and the
 * Supabase UUID column agree (the table's id is a UUID; client-generated ids
 * must be valid UUIDs to be inserted with an explicit id for optimistic UI).
 * Not cryptographically strong — fine for row identifiers.
 */
export function generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
