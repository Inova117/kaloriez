// Supabase Edge Function: food-ai
//
// Holds the Gemini + USDA API keys SERVER-SIDE so they are never shipped in the
// mobile bundle. The client calls this with its Supabase JWT (attached
// automatically by supabase.functions.invoke) and receives validated calorie
// suggestions.
//
// Deploy:
//   supabase functions deploy food-ai
// Set secrets (server-side, never in the app):
//   supabase secrets set GEMINI_API_KEY=... GEMINI_MODEL=gemini-2.5-flash USDA_API_KEY=...
//
// Deno runtime.
import {
    corsHeaders,
    enrichSuggestions,
    getUser,
    jsonResponse,
    stripJsonFences,
} from "../_shared/nutrition.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";

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
