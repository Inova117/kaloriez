import Groq from 'groq-sdk';
import { GROQ_API_KEY, GROQ_MODEL } from '@env';

// Environment variables
const groqApiKey = GROQ_API_KEY || '';
const groqModel = GROQ_MODEL || 'llama-3.3-70b-versatile';

if (!groqApiKey) {
    console.error('⚠️ Missing Groq API key. Please check your .env file.');
}

// Initialize Groq client
export const groq = new Groq({
    apiKey: groqApiKey,
});

export interface FoodSuggestion {
    name: string;
    calories: number;
    description?: string;
}

/**
 * Get AI-powered food suggestions based on user query
 */
export async function getFoodSuggestions(query: string): Promise<FoodSuggestion[]> {
    try {
        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: `You are a nutrition expert assistant. When a user describes a food or meal, provide:
1. The most likely food name
2. Estimated calories (be realistic and accurate)
3. Brief nutritional info if relevant

Format your response as a JSON array of suggestions, each with: name, calories, and description.
Example: [{"name": "Grilled Chicken Breast", "calories": 165, "description": "100g serving, high protein"}]

IMPORTANT: Return ONLY valid JSON. No markdown formatting.`,
                },
                {
                    role: 'user',
                    content: query,
                },
            ],
            model: groqModel,
            temperature: 0.7,
            max_tokens: 500,
        });

        const response = completion.choices[0]?.message?.content || '[]';

        // Clean response if it contains markdown code blocks
        const cleanResponse = response.replace(/```json/g, '').replace(/```/g, '').trim();

        // Parse the JSON response
        try {
            const suggestions = JSON.parse(cleanResponse);
            return suggestions;
        } catch (parseError) {
            console.error('Failed to parse Groq response:', parseError);
            return [];
        }
    } catch (error) {
        console.error('Groq API error:', error);
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
            model: groqModel,
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
            model: groqModel,
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
