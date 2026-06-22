// Supabase Edge Function: food-ai-audio
//
// Voice dictation: the client uploads a base64-encoded audio clip; Gemini
// transcribes it, splits it into individual foods with portions, and we enrich
// each with USDA ground truth (shared with food-ai). Keys stay server-side.
//
// Deploy:
//   supabase functions deploy food-ai-audio
// Uses the same secrets as food-ai (GEMINI_API_KEY, GEMINI_MODEL, USDA_API_KEY).
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

// Reject oversized clips before sending to Gemini (base64 chars). ~3MB of base64
// ≈ ~2.2MB audio ≈ a few minutes of compressed speech.
const MAX_AUDIO_BASE64_CHARS = 3_000_000;

const AUDIO_PROMPT =
    `You are a precise nutrition expert assistant. The user is dictating what they ate.

STEP 1 - Transcribe: Listen carefully and identify every food item and quantity mentioned.
STEP 2 - Standardize: Convert each to a typical serving weight in grams.
  Examples: "2 eggs" → 100g. "a bowl of rice" → cooked white rice, 186g. "a banana" → 1 medium banana, 118g.
STEP 3 - Calculate calories based on the portion weight, not a generic 100g serving.
STEP 4 - Output JSON array, each item: name (clean), calories (whole number), portionGrams, description.
  [{"name": "Scrambled Eggs", "calories": 182, "portionGrams": 120, "description": "2 large eggs cooked"}]

RULES:
- List EVERY distinct food item separately. Do NOT combine.
- If a quantity is mentioned, calculate for THAT quantity.
- RETURN ONLY a valid JSON array. No markdown, no extra text.`;

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
