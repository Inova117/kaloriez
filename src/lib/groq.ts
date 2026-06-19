import Groq from 'groq-sdk';
import { GEMINI_API_KEY, GEMINI_MODEL } from '@env';
import * as FileSystem from 'expo-file-system';
import { getCaloriesFromUSDA } from './usda';

// Environment variables
const geminiApiKey = GEMINI_API_KEY || '';
const geminiModel = GEMINI_MODEL || 'gemini-2.5-flash';

if (!geminiApiKey) {
    console.error('⚠️ Missing Gemini API key. Please check your .env file.');
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
    console.log('🤖 getFoodSuggestions called with query:', query);
    
    try {
        console.log('📞 Creating Gemini API request...');
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
        console.log('📥 Raw AI response:', response);
        
        const cleanResponse = response.replace(/```json/g, '').replace(/```/g, '').trim();
        console.log('🧹 Cleaned response:', cleanResponse);

        let suggestions: any[] = [];
        try {
            suggestions = JSON.parse(cleanResponse);
            console.log('✅ Parsed suggestions:', suggestions);
        } catch (parseError) {
            console.error('❌ Failed to parse AI response:', parseError);
            console.error('Response was:', cleanResponse);
            return [];
        }

        // Step 2: Enrich each suggestion with USDA ground-truth calories if available
        console.log('🔍 Enriching with USDA data...');
        const enriched = await Promise.all(
            suggestions.map(async (s: any) => {
                const portionGrams: number = s.portionGrams || 100;
                console.log(`📊 Looking up USDA data for: ${s.name} (${portionGrams}g)`);
                const usdaCalories = await getCaloriesFromUSDA(s.name, portionGrams);

                const result = {
                    name: s.name,
                    calories: usdaCalories ?? s.calories, // Prefer USDA, fallback to AI
                    description: s.description
                        ? `${s.description}${usdaCalories ? ' (USDA verified)' : ' (AI estimate)'}`
                        : undefined,
                } as FoodSuggestion;
                
                console.log(`✅ Enriched result:`, result);
                return result;
            })
        );

        console.log('🎉 Final enriched suggestions:', enriched);
        return enriched;
    } catch (error) {
        console.error('❌ AI API error:', error);
        if (error instanceof Error) {
            console.error('Error details:', error.message, error.stack);
        }
        return [];
    }
}

/**
 * Analyze a food image and return nutritional information
 */
export async function analyzeFoodImage(imageDescription: string): Promise<any> {
    try {
        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: `You are a nutrition expert. Based on the description of a food image, estimate:
1. What food items are present
2. Approximate portion sizes
3. Total estimated calories
4. Macronutrient breakdown (protein, carbs, fats)

Return as JSON: {"foods": [...], "totalCalories": number, "macros": {...}}`,
                },
                {
                    role: 'user',
                    content: `Analyze this food: ${imageDescription}`,
                },
            ],
            model: geminiModel,
            temperature: 0.5,
            max_tokens: 400,
        });

        const response = completion.choices[0]?.message?.content || '{}';
        return JSON.parse(response);
    } catch (error) {
        console.error('Groq image analysis error:', error);
        throw new Error('Failed to analyze food image');
    }
}

/**
 * Get personalized meal suggestions based on user's daily intake
 */
export async function getMealSuggestions(
    currentCalories: number,
    dailyGoal: number,
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snacks'
): Promise<string[]> {
    const remaining = dailyGoal - currentCalories;

    try {
        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: `You are a nutrition coach. Suggest healthy meal options based on the user's calorie budget.
Return as JSON array: [{"name": "Food name", "calories": number, "reason": "why it's a good choice"}]`,
                },
                {
                    role: 'user',
                    content: `Suggest 3-5 ${mealType} options. I have ${remaining} calories remaining out of ${dailyGoal} daily goal.`,
                },
            ],
            model: geminiModel,
            temperature: 0.8,
            max_tokens: 400,
        });

        const response = completion.choices[0]?.message?.content || '[]';
        return JSON.parse(response);
    } catch (error) {
        console.error('Groq meal suggestions error:', error);
        throw new Error('Failed to get meal suggestions');
    }
}

/**
 * Shorten a food name to be more concise and readable
 * Example: "2 large eggs cooked in 1 tsp butter (AI estimate)" → "2 Eggs"
 */
export async function shortenFoodName(foodName: string): Promise<string> {
    try {
        console.log('✂️ Shortening food name:', foodName);
        
        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: `You are a text simplifier. Your job is to shorten food names to be concise and readable.

RULES:
- Keep quantity numbers (e.g., "2", "12", "1 cup")
- Remove unnecessary details like cooking method, portion descriptions, source labels
- Keep it under 25 characters if possible
- Use title case
- Remove parenthetical notes like "(AI estimate)" or "(USDA verified)"
- Examples:
  * "2 large eggs cooked in 1 tsp butter (AI estimate)" → "2 Eggs"
  * "12 KFC chicken wings, fried (AI estimate)" → "12 KFC Wings"
  * "1 scoop whey protein powder (USDA verified)" → "Whey Protein"
  * "Honey BBQ sauce, 1 tablespoon" → "Honey BBQ Sauce"

Return ONLY the shortened name, nothing else.`,
                },
                {
                    role: 'user',
                    content: foodName,
                },
            ],
            model: geminiModel,
            temperature: 0.3,
            max_tokens: 50,
        });

        const shortened = completion.choices[0]?.message?.content?.trim() || foodName;
        console.log('✅ Shortened to:', shortened);
        
        // Fallback: if AI returns something too long or fails, truncate manually
        if (shortened.length > 35) {
            const truncated = foodName.substring(0, 30) + '...';
            console.log('⚠️ AI result too long, truncating:', truncated);
            return truncated;
        }
        
        return shortened;
    } catch (error) {
        console.error('❌ Failed to shorten name:', error);
        // Fallback: simple truncation
        return foodName.length > 35 ? foodName.substring(0, 30) + '...' : foodName;
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
            const errorText = await response.text();
            console.error('Gemini API Error details:', errorText);
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
            console.error('Failed to parse Gemini audio response:', parseError);
            return [];
        }
    } catch (error) {
        console.error('Audio processing error:', error);
        return [];
    }
}
