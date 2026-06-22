import Groq from 'groq-sdk';
import { GEMINI_API_KEY, GEMINI_MODEL } from '@env';
import * as FileSystem from 'expo-file-system';
import { getCaloriesFromUSDA } from './usda';
import { logger } from '../utils/logger';

// Upper bound for a single logged item's calories. Guards against a model
// returning an absurd value (or a string that coerces oddly) poisoning totals.
const MAX_ENTRY_CALORIES = 20000;

/** Coerce an untrusted model numeric field to a safe, finite, non-negative integer or null. */
function toSafeCalories(value: unknown): number | null {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || n > MAX_ENTRY_CALORIES) return null;
    return Math.round(n);
}

// Environment variables
const geminiApiKey = GEMINI_API_KEY || '';
const geminiModel = GEMINI_MODEL || 'gemini-2.5-flash';

if (!geminiApiKey) {
    logger.warn('⚠️ Missing Gemini API key. Please check your .env file.');
}

// Initialize Groq client
export const groq = new Groq({
    apiKey: geminiApiKey,
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    dangerouslyAllowBrowser: true
});

export interface FoodSuggestion {
    name: string;
    calories: number;
    description?: string;
}

/**
 * Get AI-powered food suggestions based on user query.
 * Uses a 2-step process:
 *   1. Gemini identifies food name + standardizes portion to grams
 *   2. USDA FoodData Central provides official calories for accuracy
 *   3. Falls back to Gemini estimate if USDA has no data
 */
export async function getFoodSuggestions(query: string): Promise<FoodSuggestion[]> {
    logger.debug('getFoodSuggestions called');

    try {
        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: `You are a precise nutrition expert assistant. When analyzing a food or meal:

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
- Return ONLY valid JSON. No markdown, no extra text.`,
                },
                {
                    role: 'user',
                    content: query,
                },
            ],
            model: geminiModel,
            temperature: 0.1,   // Low temp = factual recall, not creative guessing
            max_tokens: 600,
        });

        const response = completion.choices[0]?.message?.content || '[]';
        const cleanResponse = response.replace(/```json/g, '').replace(/```/g, '').trim();

        let suggestions: any[] = [];
        try {
            const parsed = JSON.parse(cleanResponse);
            suggestions = Array.isArray(parsed) ? parsed : [];
        } catch (parseError) {
            logger.error('Failed to parse AI response', parseError);
            return [];
        }

        // Step 2: Enrich each suggestion with USDA ground-truth calories if available.
        // All numeric fields coming from the model are untrusted, so coerce/validate
        // them here at the boundary before they can ever reach the daily total.
        const enriched = await Promise.all(
            suggestions.map(async (s: any) => {
                const portionRaw = Number(s.portionGrams);
                const portionGrams = Number.isFinite(portionRaw) && portionRaw > 0 ? portionRaw : 100;

                const usdaCalories = await getCaloriesFromUSDA(s.name, portionGrams);
                const aiCalories = toSafeCalories(s.calories);
                const finalCalories = usdaCalories ?? aiCalories;

                // Drop suggestions we cannot attach a trustworthy number to.
                if (finalCalories === null) {
                    logger.warn('Dropping AI suggestion with invalid calories');
                    return null;
                }

                const name = String(s.name ?? '').trim() || 'Food';
                return {
                    name,
                    calories: finalCalories,
                    description: s.description
                        ? `${s.description}${usdaCalories != null ? ' (USDA verified)' : ' (AI estimate)'}`
                        : undefined,
                } as FoodSuggestion;
            })
        );

        return enriched.filter((e): e is FoodSuggestion => e !== null);
    } catch (error) {
        logger.error('AI API error in getFoodSuggestions', error);
        return [];
    }
}

/**
 * Process audio dictation using Gemini to extract food items
 */
export async function processAudioDictation(audioUri: string): Promise<FoodSuggestion[]> {
    try {
        // Read the audio file as base64
        const base64Audio = await FileSystem.readAsStringAsync(audioUri, {
            encoding: 'base64',
        });

        // Use the native fetch API directly to access Gemini's vision/audio endpoint
        // since the OpenAI compatible endpoint might not support audio uploads perfectly yet
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    inlineData: {
                                        mimeType: 'audio/m4a', // expo-av default on iOS
                                        data: base64Audio
                                    }
                                },
                                {
                                    text: `You are a precise nutrition expert assistant. The user is dictating what they ate.

STEP 1 - Transcribe: Listen carefully and identify every food item and quantity mentioned.
STEP 2 - Standardize: Convert each to a typical serving weight in grams.
  Examples: "2 eggs" → 100g. "a bowl of rice" → cooked white rice, 186g. "a banana" → 1 medium banana, 118g.
STEP 3 - Calculate calories based on the portion weight, not a generic 100g serving.
STEP 4 - Output JSON:
  [{"name": "Scrambled Eggs", "calories": 182, "portionGrams": 120, "description": "2 large eggs cooked"}, {"name": "Orange Juice", "calories": 112, "portionGrams": 240, "description": "1 cup (240ml)"}]

RULES:
- List EVERY distinct food item separately. Do NOT combine.
- Use WHOLE NUMBERS for calories.
- If a quantity is mentioned, calculate for THAT quantity.
- RETURN ONLY valid JSON array. No markdown, no extra text.`
                                }
                            ]
                        }
                    ],
                    generationConfig: {
                        temperature: 0.1,
                        responseMimeType: "application/json",
                    }
                }),
            }
        );

        if (!response.ok) {
            throw new Error(`Gemini API responded with status ${response.status}`);
        }

        const data = await response.json();

        // Extract the text response
        const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

        // Clean response if it contains markdown code blocks
        const cleanResponse = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();

        // Parse the JSON response
        try {
            const suggestions = JSON.parse(cleanResponse);
            return suggestions;
        } catch (parseError) {
            logger.error('Failed to parse Gemini audio response', parseError);
            return [];
        }
    } catch (error) {
        logger.error('Audio processing error', error);
        return [];
    }
}
