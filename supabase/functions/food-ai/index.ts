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

function usdaTokens(s: string): Set<string> {
    return new Set(
        String(s).toLowerCase().split(/[^a-záéíóúñ]+/).filter((w) => w.length >= 4),
    );
}

// True only if the matched USDA food shares a meaningful word with the query,
// so we never stamp "verified" on a fuzzy wrong-food match.
function usdaMatches(query: string, description: string): boolean {
    const q = usdaTokens(query);
    if (q.size === 0) return false;
    const d = usdaTokens(description);
    for (const t of q) if (d.has(t)) return true;
    return false;
}

async function usdaLookup(foodName: string): Promise<{ kcal: number; description: string } | null> {
    if (!USDA_API_KEY || !foodName.trim()) return null;
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
        const description = String(preferred.description ?? foodName);
        return { kcal, description };
    } catch (_e) {
        return null;
    }
}

async function enrichSuggestions(parsed: any[]): Promise<any[]> {
    const enriched = await Promise.all((parsed ?? []).map(async (s: any) => {
        const portionRaw = Number(s?.portionGrams);
        const portionGrams = Number.isFinite(portionRaw) && portionRaw > 0 ? portionRaw : 100;
        const name = String(s?.name ?? "").trim() || "Food";
        // Use the model's English query for the US-centric USDA DB; fall back to name.
        const lookupName = String(s?.usdaQuery ?? "").trim() || name;
        const ai = toSafeCalories(s?.calories);

        const usda = await usdaLookup(lookupName);
        let usdaCalories: number | null = null;
        if (usda && usdaMatches(lookupName, usda.description)) {
            usdaCalories = Math.round((usda.kcal / 100) * portionGrams);
        }

        const calories = usdaCalories ?? ai;
        if (calories == null) return null;
        return {
            name,
            calories,
            verified: usdaCalories != null,
            description: s?.description
                ? `${s.description}${usdaCalories != null ? " (USDA verified)" : " (AI estimate)"}`
                : undefined,
        };
    }));
    return enriched.filter((e) => e !== null);
}

function stripJsonFences(text: string): string {
    return String(text).replace(/```json/g, "").replace(/```/g, "").trim();
}

const SYSTEM_PROMPT =
    `Eres un experto en nutrición especializado en la cocina MEXICANA y latinoamericana. El usuario escribe (en español o inglés) lo que comió.

PASO 1 - Identifica y estandariza: reconoce el platillo exacto, incluyendo comida mexicana, callejera y regional (tacos al pastor, pozole, chilaquiles, tamales, quesadillas, mole, antojitos, etc.) y términos coloquiales/regionales.
  - Convierte descripciones vagas a una porción típica con su peso en gramos.
  - Ejemplos: "2 huevos" → 2 huevos grandes, 100g. "un taco al pastor" → ~95g. "un plato de pozole" → ~450g.

PASO 2 - Estima calorías con cuidado:
  - Basa las calorías en el peso de la porción del Paso 1.
  - Sé específico: "pechuga de pollo" NO es lo mismo que "pollo frito".
  - Para comida mexicana usa porciones y preparaciones reales (con tortilla, aceite, etc.).

PASO 3 - Formato de salida:
  - Devuelve un arreglo JSON donde cada item tiene: name (nombre limpio EN ESPAÑOL, Title Case, sin palabras de más), calories (entero, para la porción exacta), portionGrams (el peso usado), description (en español, p.ej. "2 huevos estrellados, ~120g"), usdaQuery (nombre genérico EN INGLÉS para buscar en la base USDA, p.ej. "pork tacos", "grilled chicken breast"; usa "" si es un platillo compuesto/mexicano poco probable en USDA).
  - Ejemplo: [{"name": "Tacos Al Pastor", "calories": 285, "portionGrams": 190, "description": "2 tacos al pastor con tortilla de maíz", "usdaQuery": "pork tacos"}]

REGLAS:
- Si el usuario menciona cantidad (2 huevos, 200g de pollo), calcula para ESA cantidad, no para 100g.
- Si no hay cantidad, asume 1 porción típica.
- NUNCA inventes números a la ligera — es clave que el usuario confíe en estos datos.
- Devuelve SOLO JSON válido. Sin markdown, sin texto extra.`;

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
