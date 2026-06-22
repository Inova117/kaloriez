// Supabase Edge Function: food-ai
//
// Holds the Gemini + USDA API keys SERVER-SIDE so they are never shipped in the
// mobile bundle. The client calls this with its Supabase JWT (attached
// automatically by supabase.functions.invoke) and receives validated calorie
// suggestions.
//
// Self-contained on purpose (no shared-module imports) so it deploys cleanly via
// the Dashboard or the CLI.
//
// Deploy:  supabase functions deploy food-ai
// Secrets: supabase secrets set GEMINI_API_KEY=... GEMINI_MODEL=gemini-2.5-flash USDA_API_KEY=...
//
// Deno runtime.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";
const USDA_API_KEY = Deno.env.get("USDA_API_KEY") ?? "";
const USDA_BASE_URL = "https://api.nal.usda.gov/fdc/v1";

const MAX_ENTRY_CALORIES = 20000;
const MAX_KCAL_PER_100G = 902; // above pure fat ⇒ almost certainly a kJ value

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

async function getUser(req: Request): Promise<{ id: string } | null> {
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

function toSafeCalories(value: unknown): number | null {
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

async function caloriesFromUSDA(foodName: string, portionGrams: number): Promise<number | null> {
    const per100 = await usdaCaloriesPer100g(foodName);
    if (per100 == null) return null;
    return Math.round((per100 / 100) * portionGrams);
}

async function enrichSuggestions(parsed: any[]): Promise<any[]> {
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
        };
    }));
    return enriched.filter((e) => e !== null);
}

function stripJsonFences(text: string): string {
    return String(text).replace(/```json/g, "").replace(/```/g, "").trim();
}

const SYSTEM_PROMPT =
    `You are a precise nutrition expert assistant. When analyzing a food or meal:

STEP 1 - Standardize: Identify the exact food item and standard portion.
  - Convert vague descriptions to a standard serving size and weight in grams.
  - Examples: "2 eggs" → 2 large eggs, 100g total. "a cup of rice" → cooked white rice, 186g.

STEP 2 - Estimate calories carefully:
  - Use well-known nutritional databases as your reference.
  - Base calories on the exact portion weight you determined in Step 1.
  - Be specific: "chicken breast" is NOT the same as "fried chicken".

STEP 3 - Output format:
  - Return a JSON array where each item has: name (cleanly named, no extra words), calories (whole number, for the exact portion described), portionGrams (the weight used), description (e.g. "2 large eggs, ~100g").
  - Example: [{"name": "Scrambled Eggs", "calories": 182, "portionGrams": 120, "description": "2 large eggs cooked in 1 tsp butter"}]

RULES:
- If the user mentions a quantity (2 eggs, 200g chicken), calculate for THAT quantity, not a standard 100g serving.
- If no quantity is given, assume 1 typical serving.
- NEVER guess wildly — it is important that users trust these numbers.
- Return ONLY valid JSON. No markdown, no extra text.`;

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const user = await getUser(req);
        if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

        const { query } = await req.json().catch(() => ({ query: "" }));
        if (!query || typeof query !== "string") {
            return jsonResponse({ suggestions: [] });
        }

        const completion = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${GEMINI_API_KEY}`,
                },
                body: JSON.stringify({
                    model: GEMINI_MODEL,
                    temperature: 0.1,
                    max_tokens: 600,
                    messages: [
                        { role: "system", content: SYSTEM_PROMPT },
                        { role: "user", content: query.slice(0, 300) },
                    ],
                }),
            },
        );

        if (!completion.ok) {
            return jsonResponse({ suggestions: [], error: "ai_unavailable" });
        }

        const aiData = await completion.json();
        const raw = aiData.choices?.[0]?.message?.content ?? "[]";

        let parsed: any[] = [];
        try {
            const j = JSON.parse(stripJsonFences(raw));
            parsed = Array.isArray(j) ? j : [];
        } catch (_e) {
            return jsonResponse({ suggestions: [] });
        }

        return jsonResponse({ suggestions: await enrichSuggestions(parsed) });
    } catch (_e) {
        return jsonResponse({ suggestions: [], error: "internal" });
    }
});
