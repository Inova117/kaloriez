// Shared helpers for the food-ai and food-ai-audio Edge Functions:
// auth, CORS, USDA enrichment, and numeric validation. Keeping this in one place
// means the kJ/kcal fix and validation live in a single spot.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

/** Returns the authenticated user, or null if the JWT is missing/invalid. */
export async function getUser(req: Request): Promise<{ id: string } | null> {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return { id: user.id };
}

const MAX_ENTRY_CALORIES = 20000;
const MAX_KCAL_PER_100G = 902; // above pure fat ⇒ almost certainly a kJ value
const USDA_BASE_URL = "https://api.nal.usda.gov/fdc/v1";
const USDA_API_KEY = Deno.env.get("USDA_API_KEY") ?? "";

export function toSafeCalories(value: unknown): number | null {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || n > MAX_ENTRY_CALORIES) return null;
    return Math.round(n);
}

async function usdaCaloriesPer100g(foodName: string): Promise<number | null> {
    if (!USDA_API_KEY) return null;
    try {
        const url =
            `${USDA_BASE_URL}/foods/search?query=${encodeURIComponent(foodName)}` +
            `&dataType=SR%20Legacy,Foundation,Branded&pageSize=5&api_key=${USDA_API_KEY}`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        const foods = data.foods as any[];
        if (!foods || foods.length === 0) return null;

        const preferred = foods.find(
            (f: any) => f.dataType === "Foundation" || f.dataType === "SR Legacy",
        ) || foods[0];
        const nutrients = (preferred.foodNutrients as any[]) ?? [];

        // Require unitName === 'KCAL': USDA returns Energy in both kcal and kJ.
        const energy = nutrients.find((n: any) =>
            n.nutrientName?.toLowerCase().includes("energy") &&
            n.unitName?.toUpperCase() === "KCAL"
        );
        const kcal = energy?.value ?? 0;
        if (!kcal || kcal > MAX_KCAL_PER_100G) return null;
        return kcal;
    } catch (_e) {
        return null;
    }
}

async function caloriesFromUSDA(
    foodName: string,
    portionGrams: number,
): Promise<number | null> {
    const per100 = await usdaCaloriesPer100g(foodName);
    if (per100 == null) return null;
    return Math.round((per100 / 100) * portionGrams);
}

export interface EnrichedSuggestion {
    name: string;
    calories: number;
    verified: boolean;
    description?: string;
}

/**
 * Given the model's parsed JSON array, enrich each item with USDA ground truth
 * and validate every numeric field. Drops items we cannot trust a number for.
 */
export async function enrichSuggestions(parsed: any[]): Promise<EnrichedSuggestion[]> {
    const enriched = await Promise.all((parsed ?? []).map(async (s: any) => {
        const portionRaw = Number(s?.portionGrams);
        const portionGrams = Number.isFinite(portionRaw) && portionRaw > 0 ? portionRaw : 100;

        const usda = await caloriesFromUSDA(String(s?.name ?? ""), portionGrams);
        const ai = toSafeCalories(s?.calories);
        const calories = usda ?? ai;
        if (calories == null) return null;

        const name = String(s?.name ?? "").trim() || "Food";
        return {
            name,
            calories,
            verified: usda != null,
            description: s?.description
                ? `${s.description}${usda != null ? " (USDA verified)" : " (AI estimate)"}`
                : undefined,
        } as EnrichedSuggestion;
    }));
    return enriched.filter((e): e is EnrichedSuggestion => e !== null);
}

export function stripJsonFences(text: string): string {
    return String(text).replace(/```json/g, "").replace(/```/g, "").trim();
}
