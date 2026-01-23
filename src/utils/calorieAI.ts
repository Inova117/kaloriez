// AI Simulation for calorie detection
// Maps common foods to approximate calorie values

interface FoodMatch {
    pattern: RegExp;
    baseCalories: number;
    perGram?: number;
}

const foodDatabase: FoodMatch[] = [
    // Proteins
    { pattern: /chicken|pollo/i, baseCalories: 165, perGram: 1.65 },
    { pattern: /beef|carne|steak/i, baseCalories: 250, perGram: 2.5 },
    { pattern: /salmon|salmón/i, baseCalories: 208, perGram: 2.08 },
    { pattern: /egg|huevo/i, baseCalories: 78 },
    { pattern: /tuna|atún/i, baseCalories: 132, perGram: 1.32 },

    // Fruits
    { pattern: /apple|manzana/i, baseCalories: 95 },
    { pattern: /banana|plátano|banano/i, baseCalories: 105 },
    { pattern: /orange|naranja/i, baseCalories: 62 },
    { pattern: /berries|fresas|arándanos/i, baseCalories: 50 },

    // Dairy
    { pattern: /yogurt|yogur/i, baseCalories: 120 },
    { pattern: /milk|leche/i, baseCalories: 103 },
    { pattern: /cheese|queso/i, baseCalories: 113, perGram: 4.0 },

    // Grains
    { pattern: /rice|arroz/i, baseCalories: 206, perGram: 1.3 },
    { pattern: /bread|pan|toast/i, baseCalories: 79 },
    { pattern: /oatmeal|avena/i, baseCalories: 150 },
    { pattern: /pasta/i, baseCalories: 220, perGram: 1.5 },

    // Beverages
    { pattern: /coffee|café/i, baseCalories: 2 },
    { pattern: /tea|té/i, baseCalories: 2 },
    { pattern: /juice|jugo/i, baseCalories: 112 },
    { pattern: /soda|cola|refresco/i, baseCalories: 140 },

    // Common meals
    { pattern: /salad|ensalada/i, baseCalories: 150 },
    { pattern: /pizza/i, baseCalories: 285 },
    { pattern: /burger|hamburguesa/i, baseCalories: 354 },
    { pattern: /sandwich|sándwich/i, baseCalories: 350 },
    { pattern: /soup|sopa/i, baseCalories: 100 },
];

// Extract quantity from text (e.g., "200g", "2 eggs", "1 cup")
function extractQuantity(text: string): { quantity: number; unit: string } {
    // Match patterns like "200g", "2 eggs", "1.5 cups"
    const gramMatch = text.match(/(\d+(?:\.\d+)?)\s*g(?:rams?)?/i);
    if (gramMatch) {
        return { quantity: parseFloat(gramMatch[1]), unit: 'g' };
    }

    const countMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:x|pcs?|pieces?)?/i);
    if (countMatch) {
        return { quantity: parseFloat(countMatch[1]), unit: 'count' };
    }

    return { quantity: 1, unit: 'serving' };
}

import { getFoodSuggestions } from '../lib/groq';

export async function detectCalories(input: string): Promise<number> {
    try {
        // Use real AI to get suggestions
        const suggestions = await getFoodSuggestions(input);

        if (suggestions.length > 0) {
            // Return calories from the best match
            return suggestions[0].calories;
        }

        // Fallback to local regex if AI fails (keep existing logic as backup)
        const { quantity, unit } = extractQuantity(input);
        for (const food of foodDatabase) {
            if (food.pattern.test(input)) {
                if (unit === 'g' && food.perGram) {
                    return Math.round(quantity * food.perGram);
                }
                return Math.round(food.baseCalories * quantity);
            }
        }

        // Last resort fallback
        return 0;
    } catch (error) {
        console.error('AI Error:', error);
        return 0;
    }
}

// Quick add items for the shortcuts bar
export const defaultQuickAddItems = [
    { id: '1', emoji: '☕', name: 'Black Coffee', calories: 2 },
    { id: '2', emoji: '🥚', name: '2 Eggs', calories: 156 },
    { id: '3', emoji: '🍞', name: 'Toast', calories: 79 },
    { id: '4', emoji: '🙏', name: 'Prayer', calories: 0 },
    { id: '5', emoji: '🥗', name: 'Salad', calories: 150 },
    { id: '6', emoji: '🍌', name: 'Banana', calories: 105 },
    { id: '7', emoji: '🥛', name: 'Milk', calories: 103 },
];
