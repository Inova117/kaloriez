import { USDA_API_KEY } from '@env';

const USDA_BASE_URL = 'https://api.nal.usda.gov/fdc/v1';

export interface USDANutrition {
    calories: number;        // kcal per 100g
    protein: number;         // g per 100g
    fat: number;             // g per 100g
    carbs: number;           // g per 100g
    source: 'usda' | 'ai';  // where the data came from
}

// Session-level in-memory cache to avoid duplicate USDA calls
const nutritionCache = new Map<string, USDANutrition | null>();

/**
 * Search USDA FoodData Central for a food and return nutrition per 100g.
 * Returns null if the food is not found.
 */
export async function lookupUSDANutrition(foodName: string): Promise<USDANutrition | null> {
    const cacheKey = foodName.toLowerCase().trim();

    if (nutritionCache.has(cacheKey)) {
        return nutritionCache.get(cacheKey) ?? null;
    }

    const apiKey = USDA_API_KEY || '';
    if (!apiKey || apiKey === 'your_usda_api_key_here') {
        nutritionCache.set(cacheKey, null);
        return null;
    }

    try {
        // Use the /foods/search endpoint for natural language queries
        const searchUrl = `${USDA_BASE_URL}/foods/search?query=${encodeURIComponent(foodName)}&dataType=SR%20Legacy,Foundation,Branded&pageSize=5&api_key=${apiKey}`;
        const searchRes = await fetch(searchUrl);

        if (!searchRes.ok) {
            nutritionCache.set(cacheKey, null);
            return null;
        }

        const searchData = await searchRes.json();
        const foods = searchData.foods as any[];

        if (!foods || foods.length === 0) {
            nutritionCache.set(cacheKey, null);
            return null;
        }

        // Prefer Foundation or SR Legacy over branded for generic accuracy
        const preferred = foods.find(
            (f: any) => f.dataType === 'Foundation' || f.dataType === 'SR Legacy'
        ) || foods[0];

        // Extract key nutrients from the inline food nutrients
        const nutrients = preferred.foodNutrients as any[];
        const get = (name: string): number => {
            const n = nutrients?.find((n: any) =>
                n.nutrientName?.toLowerCase().includes(name.toLowerCase())
            );
            return n?.value ?? 0;
        };

        const calories = get('Energy') || get('energy');
        const protein = get('Protein') || get('protein');
        const fat = get('Total lipid') || get('fat');
        const carbs = get('Carbohydrate') || get('carbohydrate');

        const result: USDANutrition = {
            calories: Math.round(calories),
            protein: Math.round(protein * 10) / 10,
            fat: Math.round(fat * 10) / 10,
            carbs: Math.round(carbs * 10) / 10,
            source: 'usda',
        };

        nutritionCache.set(cacheKey, result);
        return result;
    } catch (error) {
        console.error('USDA lookup failed for:', foodName, error);
        nutritionCache.set(cacheKey, null);
        return null;
    }
}

/**
 * Given a food name and portion weight in grams, compute the total calories.
 * Returns null if USDA has no data for this food.
 */
export async function getCaloriesFromUSDA(
    foodName: string,
    portionGrams: number
): Promise<number | null> {
    const nutrition = await lookupUSDANutrition(foodName);
    if (!nutrition || nutrition.calories === 0) return null;
    return Math.round((nutrition.calories / 100) * portionGrams);
}
