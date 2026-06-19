export interface UserProfile {
    gender: 'male' | 'female';
    age: number;
    weight: number; // in kg
    height: number; // in cm
    activityLevel: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extra_active';
    weightGoal: 'lose_0_25' | 'lose_0_50' | 'lose_0_75' | 'lose_1_00' | 'maintain' | 'gain_0_25' | 'gain_0_50';
}

/**
 * Calculate Base Metabolic Rate (BMR) using Mifflin-St Jeor Equation
 */
export function calculateBMR(profile: UserProfile): number {
    // Mifflin-St Jeor Equation
    // Men: (10 × weight in kg) + (6.25 × height in cm) - (5 × age in years) + 5
    // Women: (10 × weight in kg) + (6.25 × height in cm) - (5 × age in years) - 161
    
    let bmr = (10 * profile.weight) + (6.25 * profile.height) - (5 * profile.age);
    
    if (profile.gender === 'male') {
        bmr += 5;
    } else {
        bmr -= 161;
    }
    
    return bmr;
}

/**
 * Calculate Total Daily Energy Expenditure (TDEE)
 */
export function calculateTDEE(bmr: number, activityLevel: UserProfile['activityLevel']): number {
    const activityMultipliers = {
        'sedentary': 1.2, // Little or no exercise
        'lightly_active': 1.375, // Light exercise/sports 1-3 days/week
        'moderately_active': 1.55, // Moderate exercise/sports 3-5 days/week
        'very_active': 1.725, // Hard exercise/sports 6-7 days a week
        'extra_active': 1.9 // Very hard exercise/sports & physical job or 2x training
    };
    
    return bmr * activityMultipliers[activityLevel];
}

/**
 * Calculate final daily calorie goal based on TDEE and weight goal
 */
export function calculateDailyCalorieGoal(profile: UserProfile): number {
    const bmr = calculateBMR(profile);
    const tdee = calculateTDEE(bmr, profile.activityLevel);
    
    // 1 kg of fat is roughly 7700 calories
    // To lose 0.5kg per week = 3850 calories deficit per week = 550 calories deficit per day
    // The formula is: kg * 7700 / 7 days = kg * 1100
    
    let calorieAdjustment = 0;
    
    switch (profile.weightGoal) {
        case 'lose_1_00': calorieAdjustment = -1100; break;
        case 'lose_0_75': calorieAdjustment = -825; break;
        case 'lose_0_50': calorieAdjustment = -550; break;
        case 'lose_0_25': calorieAdjustment = -275; break;
        case 'maintain': calorieAdjustment = 0; break;
        case 'gain_0_25': calorieAdjustment = 275; break;
        case 'gain_0_50': calorieAdjustment = 550; break;
    }
    
    // Calculate final goal and ensure it doesn't go below dangerous levels
    // Men shouldn't go below 1500, women shouldn't go below 1200
    let finalGoal = Math.round(tdee + calorieAdjustment);
    const minCalories = profile.gender === 'male' ? 1500 : 1200;
    
    return Math.max(finalGoal, minCalories);
}
