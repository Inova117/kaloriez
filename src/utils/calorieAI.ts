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
    { pattern: /wings|alitas/i, baseCalories: 290 }, // Chicken wings ~290 cal per 100g
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
    
    // Fast food & Sauces
    { pattern: /kfc|fried chicken/i, baseCalories: 290 },
    { pattern: /bbq|barbecue/i, baseCalories: 50 }, // BBQ sauce ~50 cal per tbsp
    { pattern: /honey/i, baseCalories: 64 }, // Honey ~64 cal per tbsp
    { pattern: /sauce|salsa/i, baseCalories: 40 },
    { pattern: /fries|papas fritas/i, baseCalories: 312, perGram: 3.12 },
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
    console.log('🔍 Detecting calories for:', input);
    
    try {
        // Use real AI to get suggestions
        console.log('📡 Calling AI API...');
        const suggestions = await getFoodSuggestions(input);

        if (suggestions && suggestions.length > 0) {
            console.log('✅ AI returned:', suggestions[0]);
            return suggestions[0].calories;
        }
        
        console.log('⚠️ AI returned no suggestions, using local fallback');
    } catch (error) {
        console.error('❌ AI Error:', error);
        console.log('🔄 Falling back to local database');
    }

    // Fallback to local regex if AI fails
    const { quantity, unit } = extractQuantity(input);
    console.log('📊 Extracted quantity:', quantity, unit);
    
    for (const food of foodDatabase) {
        if (food.pattern.test(input)) {
            let calories = 0;
            if (unit === 'g' && food.perGram) {
                calories = Math.round(quantity * food.perGram);
            } else {
                calories = Math.round(food.baseCalories * quantity);
            }
            console.log('✅ Local match found:', food.pattern, '→', calories, 'cal');
            return calories;
        }
    }

    // Last resort: estimate based on input length and common sense
    console.warn('⚠️ No match found, using smart estimation');
    const words = input.toLowerCase().split(/\s+/);
    const hasNumber = /\d+/.test(input);
    
    // If user specified a quantity, assume it's a reasonable food item
    if (hasNumber && quantity > 1) {
        const estimatedCalPerItem = 150; // Conservative estimate
        const estimated = Math.round(estimatedCalPerItem * quantity);
        console.log('💡 Smart estimate:', estimated, 'cal for', quantity, 'items');
        return estimated;
    }
    
    // Single item or vague description - use moderate estimate
    const moderateEstimate = 200;
    console.log('💡 Default estimate:', moderateEstimate, 'cal');
    return moderateEstimate;
}

// Quick add items for the shortcuts bar
export const defaultQuickAddItems = [
    { id: '1', name: 'Black Coffee', calories: 2 },
    { id: '2', name: '2 Eggs', calories: 156 },
    { id: '3', name: 'Toast', calories: 79 },
    { id: '4', name: 'Prayer', calories: 0 },
    { id: '5', name: 'Salad', calories: 150 },
    { id: '6', name: 'Banana', calories: 105 },
    { id: '7', name: 'Milk', calories: 103 },
];
