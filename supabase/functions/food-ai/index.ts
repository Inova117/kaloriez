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

// Provider is swappable without code changes. Set AI_PROVIDER=openrouter +
// OPENROUTER_API_KEY (+ OPENROUTER_MODEL, e.g. "openai/gpt-4o-mini",
// "anthropic/claude-3.5-haiku", "deepseek/deepseek-chat") to A/B other models.
// Both Gemini's OpenAI-compatible endpoint and OpenRouter use the same schema.
const AI_PROVIDER = (Deno.env.get("AI_PROVIDER") ?? "gemini").toLowerCase();
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") ?? "";
const OPENROUTER_MODEL = Deno.env.get("OPENROUTER_MODEL") ?? "openai/gpt-4o-mini";

function aiEndpoint(): { url: string; headers: Record<string, string>; model: string } {
    if (AI_PROVIDER === "openrouter") {
        return {
            url: "https://openrouter.ai/api/v1/chat/completions",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                "HTTP-Referer": "https://kaloriez.app",
                "X-Title": "Kaloriez",
            },
            model: OPENROUTER_MODEL,
        };
    }
    return {
        url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${GEMINI_API_KEY}`,
        },
        model: GEMINI_MODEL,
    };
}

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

type DbClient = ReturnType<typeof createClient>;

async function getUser(req: Request): Promise<{ id: string; client: DbClient } | null> {
    const authHeader = req.headers.get("Authorization") ?? "";
    const client = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return null;
    return { id: user.id, client };
}

// Per-user cost guardrail: atomically counts this call against the user's
// per-minute and per-day budget in Postgres (consume_ai_quota, see
// supabase/rate_limit.sql). Fail-closed — if the limiter is unreachable we skip
// the paid AI call rather than risk runaway spend.
// NOTE: apply supabase/rate_limit.sql BEFORE deploying this function.
async function withinQuota(client: DbClient, perMinute: number, perDay: number): Promise<boolean> {
    const { data, error } = await client.rpc("consume_ai_quota", {
        p_per_minute: perMinute,
        p_per_day: perDay,
    });
    if (error) {
        console.error("consume_ai_quota failed", error.message);
        return false;
    }
    return data === true;
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
            const candidate = Math.round((usda.kcal / 100) * portionGrams);
            // Agreement gate: only trust USDA (and stamp "verified") when the
            // model gave no number, or USDA roughly agrees with the AI estimate.
            // A large divergence means a wrong-food/wrong-portion match (common
            // for Latin dishes like ceviche), so we keep the AI estimate instead.
            if (ai == null || (candidate >= ai * 0.6 && candidate <= ai * 1.6)) {
                usdaCalories = candidate;
            }
        }

        const calories = usdaCalories ?? ai;
        if (calories == null) return null;

        // Optional size choices, only when the model deemed the portion ambiguous.
        const options = Array.isArray(s?.options)
            ? s.options
                .map((o: any) => ({ label: String(o?.label ?? "").trim(), calories: toSafeCalories(o?.calories) }))
                .filter((o: any) => o.label && o.calories != null)
                .slice(0, 4)
            : [];

        return {
            name,
            calories,
            portionGrams,
            verified: usdaCalories != null,
            description: s?.description
                ? `${s.description}${usdaCalories != null ? " (USDA verified)" : " (AI estimate)"}`
                : undefined,
            options,
        };
    }));
    return enriched.filter((e) => e !== null);
}

function stripJsonFences(text: string): string {
    return String(text).replace(/```json/g, "").replace(/```/g, "").trim();
}

// Normalized cache key for the ai_suggestions table: trim, lowercase and
// collapse internal whitespace so "  Tacos   Al Pastor " and "tacos al pastor"
// share one cached result. Capped at 300 chars to match the prompt's query.slice.
function cacheKey(raw: string): string {
    return raw.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 300);
}

// Cached suggestions are already enriched/validated, so we can return them
// verbatim. 30-day TTL keeps the table bounded (alongside the existing
// cleanup_expired_suggestions cron) while sparing repeat queries a Gemini bill.
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

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
  - Devuelve un arreglo JSON donde cada item tiene: name (nombre limpio EN ESPAÑOL, Title Case, sin palabras de más), calories (entero, para la porción exacta — usa tu mejor estimado del tamaño más común), portionGrams (el peso usado), description (en español, p.ej. "2 huevos estrellados, ~120g"), usdaQuery (nombre genérico EN INGLÉS para buscar en la base USDA, p.ej. "pork tacos", "grilled chicken breast"; usa "" si es un platillo compuesto/mexicano poco probable en USDA).
  - options (OPCIONAL): SOLO si el tamaño/porción es AMBIGUO (p.ej. "personal", "un vaso", "un plato", "una rebanada", "un puño"), incluye 2-4 tamaños comunes: [{"label": "355ml", "calories": 140}, {"label": "600ml", "calories": 250}] — calories de cada opción calculado para ESE tamaño. Si la porción es clara (p.ej. "200g de pollo", "2 huevos"), OMITE options o usa [].
  - Ejemplo ambiguo: [{"name": "Coca-Cola", "calories": 140, "portionGrams": 355, "description": "Coca-Cola, lata 355ml", "usdaQuery": "cola soda", "options": [{"label": "355ml lata", "calories": 140}, {"label": "600ml", "calories": 250}, {"label": "1L", "calories": 420}]}]
  - Ejemplo claro: [{"name": "Tacos Al Pastor", "calories": 285, "portionGrams": 190, "description": "2 tacos al pastor con tortilla de maíz", "usdaQuery": "pork tacos"}]

REGLAS:
- Si el usuario menciona cantidad (2 huevos, 200g de pollo), calcula para ESA cantidad, no para 100g.
- Para cantidades, calcula POR UNIDAD y multiplica por la cantidad, de forma consistente (p.ej. 3 ceviches = 3 × las calorías de un ceviche).
- Usa tamaños/porciones realistas del platillo; no exageres la porción.
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

        // Cost guardrail: 6/min, 100/day per user. On limit we return 200 with an
        // empty list so the client silently degrades to its local estimate (and
        // we avoid Sentry noise from an expected condition).
        if (!(await withinQuota(user.client, 6, 100))) {
            return jsonResponse({ suggestions: [], error: "rate_limited" });
        }

        const { query } = await req.json().catch(() => ({ query: "" }));
        if (!query || typeof query !== "string") {
            return jsonResponse({ suggestions: [] });
        }

        // Cache lookup: identical text queries must NOT re-bill Gemini. Per-user
        // and RLS-scoped (user.client), so one user's cache is never reachable by
        // another. Only non-expired rows count; cached values are already enriched.
        const key = cacheKey(query);
        const { data: cached } = await user.client
            .from("ai_suggestions")
            .select("suggestions")
            .eq("user_id", user.id)
            .eq("query", key)
            .gt("expires_at", new Date().toISOString())
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
        if (cached?.suggestions) {
            // Cache HIT: return without touching Gemini or USDA.
            return jsonResponse({ suggestions: cached.suggestions });
        }

        const ai = aiEndpoint();
        const completion = await fetch(ai.url, {
            method: "POST",
            headers: ai.headers,
            body: JSON.stringify({
                model: ai.model,
                temperature: 0.1,
                max_tokens: 600,
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: query.slice(0, 300) },
                ],
            }),
        });

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

        const suggestions = await enrichSuggestions(parsed);

        // Cache write: best-effort, only for real (non-empty) results so we never
        // persist a "no suggestions" answer that should be retried. Relies on the
        // UNIQUE (user_id, query) index in supabase_schema.sql for onConflict. A
        // write failure must never break the response, so it's swallowed.
        if (suggestions.length > 0) {
            try {
                const expires_at = new Date(Date.now() + CACHE_TTL_MS).toISOString();
                await user.client.from("ai_suggestions").upsert(
                    { user_id: user.id, query: key, suggestions, expires_at },
                    { onConflict: "user_id,query" },
                );
            } catch (_e) {
                // Non-fatal: serving the result matters more than caching it.
            }
        }

        return jsonResponse({ suggestions });
    } catch (_e) {
        return jsonResponse({ suggestions: [], error: "internal" });
    }
});
