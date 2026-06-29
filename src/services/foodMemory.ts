import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';

/**
 * Per-user "food memory": remembers the calories the user has logged for a food
 * and scales them when the amount changes. Each account builds its own values —
 * and reusing them skips a paid AI call for foods the user already logged.
 *
 * It stores, per BASE food (the name without the amount), two independent
 * ratios derived from consistent observations:
 *   - perGram   (kcal/g)    → scale when the user gives grams ("pollo 200g")
 *   - perUnit   (kcal/unit) → scale when the user gives a count ("3 tacos")
 * Keeping them separate means editing one dimension never corrupts the other.
 *
 * Local-first: AsyncStorage under a per-user key (isolated per account, wiped on
 * sign-out). Can be promoted to a synced Supabase table later without changing
 * these call sites.
 */
export interface RememberedFood {
    name: string;          // display name as last logged/edited
    calories: number;      // last reference calories (fallback when no amount given)
    portionGrams?: number; // last reference grams (fallback / display)
    perGram?: number;      // kcal per gram
    perUnit?: number;      // kcal per unit/count
    gramsPerUnit?: number; // grams per unit (to recover grams when scaling by count)
    updatedAt: number;
}

/** What recall returns: ready-to-use, already scaled to the requested amount. */
export interface RecalledFood {
    name: string;
    calories: number;
    portionGrams?: number;
    unitCount?: number;
}

const PREFIX = '@food_memory_';

function keyFor(userId: string): string {
    return `${PREFIX}${userId}`;
}

// Normalize a food phrase so "  Tortitas  De Arroz " and "tortitas de arroz"
// resolve to the same slot.
export function normalizeFoodKey(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Split a food phrase into its base name and the amount the user specified.
 * "200g de pollo" -> { base: "pollo", grams: 200 }
 * "3 tacos al pastor" -> { base: "tacos al pastor", count: 3 }
 * "tortitas de arroz" -> { base: "tortitas de arroz" }
 */
export function parseFoodPhrase(text: string): { base: string; grams?: number; count?: number } {
    const lower = ` ${text.trim().toLowerCase()} `;
    let grams: number | undefined;
    let count: number | undefined;
    let stripped = lower;

    // grams: "200g", "200 g", "200gr", "200 gramos"
    const gm = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:gramos?|grams?|grs?|gr|g)\b/);
    if (gm) {
        grams = parseFloat(gm[1].replace(',', '.'));
        stripped = stripped.replace(gm[0], ' ');
    } else {
        // plain count: a standalone number ("2 tacos", "3 huevos", "1.5 tazas")
        const cm = lower.match(/(?:^|\s)(\d+(?:[.,]\d+)?)(?=\s)/);
        if (cm) {
            count = parseFloat(cm[1].replace(',', '.'));
            stripped = stripped.replace(cm[1], ' ');
        }
    }

    let base = stripped.replace(/\s+/g, ' ').trim();
    base = base.replace(/^(?:de|del|of)\s+/, '').trim(); // "de pollo" -> "pollo"
    return { base, grams, count };
}

type MemoryMap = Record<string, RememberedFood>;
const cache = new Map<string, MemoryMap>();

async function load(userId: string): Promise<MemoryMap> {
    const hit = cache.get(userId);
    if (hit) return hit;
    try {
        const raw = await AsyncStorage.getItem(keyFor(userId));
        const map: MemoryMap = raw ? JSON.parse(raw) : {};
        cache.set(userId, map);
        return map;
    } catch (error) {
        logger.error('foodMemory load failed', error);
        return {};
    }
}

async function persist(userId: string, map: MemoryMap): Promise<void> {
    cache.set(userId, map);
    try {
        await AsyncStorage.setItem(keyFor(userId), JSON.stringify(map));
    } catch (error) {
        logger.error('foodMemory persist failed', error);
    }
}

// Fold a single consistent observation (calories for a known amount) into the
// record, updating only the ratios the observation actually supports.
function fold(prev: RememberedFood | undefined, obs: {
    name: string; calories: number; portionGrams?: number; unitCount?: number;
}): RememberedFood {
    const calories = Math.round(obs.calories);
    const grams = obs.portionGrams && obs.portionGrams > 0 ? obs.portionGrams : undefined;
    const count = obs.unitCount && obs.unitCount > 0 ? obs.unitCount : undefined;
    return {
        name: obs.name.trim() || prev?.name || obs.name,
        calories,
        portionGrams: grams ?? prev?.portionGrams,
        perGram: grams ? calories / grams : prev?.perGram,
        perUnit: count ? calories / count : prev?.perUnit,
        gramsPerUnit: grams && count ? grams / count : prev?.gramsPerUnit,
        updatedAt: Date.now(),
    };
}

/**
 * Remember an observation for a food, indexed under one or more name phrases
 * (e.g. the raw text the user typed and the AI-resolved clean name). All keys
 * point at the same merged record.
 */
export async function rememberFood(
    userId: string,
    keyPhrases: string[],
    obs: { name: string; calories: number; portionGrams?: number; unitCount?: number }
): Promise<void> {
    if (!Number.isFinite(obs.calories) || obs.calories <= 0) return;
    const keys = Array.from(
        new Set(keyPhrases.map((p) => normalizeFoodKey(parseFoodPhrase(p).base)).filter(Boolean))
    );
    if (keys.length === 0) return;

    const map = await load(userId);
    const prev = keys.map((k) => map[k]).find(Boolean);
    const record = fold(prev, obs);
    for (const k of keys) map[k] = record;
    await persist(userId, map);
}

/**
 * Look up a food by phrase and scale it to the amount the phrase specifies.
 * Returns null if the base food is unknown.
 */
export async function recallFood(userId: string, phrase: string): Promise<RecalledFood | null> {
    const { base, grams, count } = parseFoodPhrase(phrase);
    const key = normalizeFoodKey(base);
    if (!key) return null;
    const map = await load(userId);
    const rec = map[key];
    if (!rec) return null;

    // Grams given → scale by density.
    if (grams != null && grams > 0 && rec.perGram) {
        return { name: rec.name, calories: Math.round(rec.perGram * grams), portionGrams: grams };
    }
    // Count given → scale by per-unit (and recover grams if we know grams/unit).
    if (count != null && count > 0 && rec.perUnit) {
        return {
            name: rec.name,
            calories: Math.round(rec.perUnit * count),
            portionGrams: rec.gramsPerUnit ? Math.round(rec.gramsPerUnit * count) : undefined,
            unitCount: count,
        };
    }
    // No (scalable) amount → last reference value.
    return {
        name: rec.name,
        calories: rec.calories,
        portionGrams: rec.portionGrams,
        unitCount: rec.perUnit ? Math.round(rec.calories / rec.perUnit) : undefined,
    };
}

/** Drop the in-memory cache (the AsyncStorage entries are wiped by clearLocalAppData). */
export function clearFoodMemoryCache(): void {
    cache.clear();
}
