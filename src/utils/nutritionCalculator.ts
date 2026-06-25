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
 * Daily calorie adjustment for a weight goal.
 * 1 kg of fat ≈ 7700 kcal, so kg/week × 7700 / 7 = kg/week × 1100 per day.
 */
export function getCalorieAdjustment(weightGoal: UserProfile['weightGoal']): number {
    switch (weightGoal) {
        case 'lose_1_00': return -1100;
        case 'lose_0_75': return -825;
        case 'lose_0_50': return -550;
        case 'lose_0_25': return -275;
        case 'gain_0_25': return 275;
        case 'gain_0_50': return 550;
        default: return 0; // maintain
    }
}

/** Safety floor: men shouldn't go below 1500, women below 1200. */
export function getMinCalories(gender: UserProfile['gender']): number {
    return gender === 'male' ? 1500 : 1200;
}

/** Signed kg/week implied by the goal (negative = losing). */
export function getKgPerWeek(weightGoal: UserProfile['weightGoal']): number {
    return getCalorieAdjustment(weightGoal) / 1100;
}

/** True if the chosen goal would dip below the safety floor (so it's clamped). */
export function isGoalClampedBySafetyFloor(profile: UserProfile): boolean {
    const tdee = calculateTDEE(calculateBMR(profile), profile.activityLevel);
    return Math.round(tdee + getCalorieAdjustment(profile.weightGoal)) < getMinCalories(profile.gender);
}

export interface GoalBreakdown {
    bmr: number;
    tdee: number;
    adjustment: number;          // the nominal adjustment for the goal
    effectiveAdjustment: number; // goal - tdee (accounts for the safety floor)
    goal: number;
    floored: boolean;
}

/** Full breakdown for the result screen (single source of truth: calculateDailyCalorieGoal). */
export function calculateGoalBreakdown(profile: UserProfile): GoalBreakdown {
    const bmr = Math.round(calculateBMR(profile));
    const tdee = Math.round(calculateTDEE(calculateBMR(profile), profile.activityLevel));
    const goal = calculateDailyCalorieGoal(profile);
    return {
        bmr,
        tdee,
        adjustment: getCalorieAdjustment(profile.weightGoal),
        effectiveAdjustment: goal - tdee,
        goal,
        floored: isGoalClampedBySafetyFloor(profile),
    };
}

/** Map a UI direction + pace step index to the weightGoal enum (no math change). */
export function paceToWeightGoal(
    direction: 'lose' | 'maintain' | 'gain',
    stepIndex: number
): UserProfile['weightGoal'] {
    if (direction === 'maintain') return 'maintain';
    const opts: UserProfile['weightGoal'][] = direction === 'lose'
        ? ['lose_0_25', 'lose_0_50', 'lose_0_75', 'lose_1_00']
        : ['gain_0_25', 'gain_0_50'];
    return opts[Math.max(0, Math.min(stepIndex, opts.length - 1))];
}

/**
 * Calculate final daily calorie goal based on TDEE and weight goal,
 * never below the gender safety floor.
 */
export function calculateDailyCalorieGoal(profile: UserProfile): number {
    const bmr = calculateBMR(profile);
    const tdee = calculateTDEE(bmr, profile.activityLevel);
    const finalGoal = Math.round(tdee + getCalorieAdjustment(profile.weightGoal));
    return Math.max(finalGoal, getMinCalories(profile.gender));
}
