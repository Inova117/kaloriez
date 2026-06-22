// Supabase Edge Function: food-ai-audio
//
// Voice dictation: the client uploads a base64-encoded audio clip; Gemini
// transcribes it, splits it into individual foods with portions, and we enrich
// each with USDA ground truth. Keys stay server-side.
//
// Self-contained on purpose (no shared-module imports) so it deploys cleanly via
// the Dashboard or the CLI.
//
// Deploy:  supabase functions deploy food-ai-audio
// Uses the same secrets as food-ai (GEMINI_API_KEY, GEMINI_MODEL, USDA_API_KEY).
//
// Deno runtime.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";
const USDA_API_KEY = Deno.env.get("USDA_API_KEY") ?? "";
const USDA_BASE_URL = "https://api.nal.usda.gov/fdc/v1";

const MAX_ENTRY_CALORIES = 20000;
const MAX_KCAL_PER_100G = 902;
// ~3MB of base64 ≈ ~2.2MB audio ≈ a few minutes of compressed speech.
const MAX_AUDIO_BASE64_CHARS = 3_000_000;

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

const AUDIO_PROMPT =
    `Eres un experto en nutrición especializado en cocina MEXICANA y latinoamericana. El usuario dicta (normalmente en español) lo que comió.

PASO 1 - Transcribe: escucha con cuidado e identifica cada alimento y cantidad, incluyendo comida mexicana, callejera y regional (tacos, pozole, chilaquiles, tamales, etc.) y términos coloquiales.
PASO 2 - Estandariza: convierte cada uno a un peso de porción típico en gramos.
  Ejemplos: "2 huevos" → 100g. "un plato de pozole" → ~450g. "un taco al pastor" → ~95g.
PASO 3 - Calcula calorías según el peso de la porción, no por 100g genéricos.
PASO 4 - Salida: arreglo JSON, cada item: name (limpio, EN ESPAÑOL, Title Case), calories (entero), portionGrams, description (en español).
  [{"name": "Huevos Estrellados", "calories": 182, "portionGrams": 120, "description": "2 huevos estrellados"}]

REGLAS:
- Lista CADA alimento por separado. NO los combines.
- Si se menciona una cantidad, calcula para ESA cantidad.
- Devuelve SOLO un arreglo JSON válido. Sin markdown, sin texto extra.`;

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const user = await getUser(req);
        if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

        const { audio, mimeType } = await req.json().catch(() => ({ audio: "", mimeType: "" }));
        if (!audio || typeof audio !== "string") {
            return jsonResponse({ suggestions: [] });
        }
        if (audio.length > MAX_AUDIO_BASE64_CHARS) {
            return jsonResponse({ suggestions: [], error: "audio_too_large" }, 413);
        }

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": GEMINI_API_KEY,
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                { inlineData: { mimeType: mimeType || "audio/mp4", data: audio } },
                                { text: AUDIO_PROMPT },
                            ],
                        },
                    ],
                    generationConfig: {
                        temperature: 0.1,
                        responseMimeType: "application/json",
                    },
                }),
            },
        );

        if (!response.ok) {
            return jsonResponse({ suggestions: [], error: "ai_unavailable" });
        }

        const data = await response.json();
        const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";

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
