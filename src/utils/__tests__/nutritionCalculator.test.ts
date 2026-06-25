import {
    calculateBMR,
    calculateTDEE,
    calculateDailyCalorieGoal,
    getCalorieAdjustment,
    getKgPerWeek,
    paceToWeightGoal,
    calculateGoalBreakdown,
    isGoalClampedBySafetyFloor,
    UserProfile,
} from '../nutritionCalculator';

const baseMale: UserProfile = {
    gender: 'male',
    age: 30,
    weight: 80,
    height: 180,
    activityLevel: 'sedentary',
    weightGoal: 'maintain',
};

describe('calculateBMR (Mifflin-St Jeor)', () => {
    it('computes male BMR', () => {
        // 10*80 + 6.25*180 - 5*30 + 5 = 1780
        expect(calculateBMR(baseMale)).toBe(1780);
    });

    it('computes female BMR (-161 constant)', () => {
        // 10*80 + 6.25*180 - 5*30 - 161 = 1614
        expect(calculateBMR({ ...baseMale, gender: 'female' })).toBe(1614);
    });
});

describe('calculateTDEE', () => {
    it('applies the activity multiplier', () => {
        expect(calculateTDEE(1780, 'sedentary')).toBeCloseTo(2136);
        expect(calculateTDEE(1780, 'very_active')).toBeCloseTo(3070.5);
    });
});

describe('calculateDailyCalorieGoal', () => {
    it('applies the weight-goal deficit', () => {
        // tdee 2136 - 550 = 1586
        expect(calculateDailyCalorieGoal({ ...baseMale, weightGoal: 'lose_0_50' })).toBe(1586);
    });

    it('never returns below the safe minimum (female 1200)', () => {
        const tiny: UserProfile = {
            gender: 'female',
            age: 25,
            weight: 40,
            height: 150,
            activityLevel: 'sedentary',
            weightGoal: 'lose_1_00',
        };
        expect(calculateDailyCalorieGoal(tiny)).toBe(1200);
    });

    it('never returns below the safe minimum (male 1500)', () => {
        const tiny: UserProfile = {
            gender: 'male',
            age: 25,
            weight: 50,
            height: 160,
            activityLevel: 'sedentary',
            weightGoal: 'lose_1_00',
        };
        expect(calculateDailyCalorieGoal(tiny)).toBe(1500);
    });
});

describe('onboarding helpers', () => {
    it('getCalorieAdjustment maps goals to daily deltas', () => {
        expect(getCalorieAdjustment('lose_0_50')).toBe(-550);
        expect(getCalorieAdjustment('maintain')).toBe(0);
        expect(getCalorieAdjustment('gain_0_25')).toBe(275);
    });

    it('getKgPerWeek is signed and proportional', () => {
        expect(getKgPerWeek('lose_0_50')).toBeCloseTo(-0.5);
        expect(getKgPerWeek('gain_0_50')).toBeCloseTo(0.5);
        expect(getKgPerWeek('maintain')).toBe(0);
    });

    it('paceToWeightGoal maps direction + index (clamped)', () => {
        expect(paceToWeightGoal('lose', 1)).toBe('lose_0_50');
        expect(paceToWeightGoal('maintain', 0)).toBe('maintain');
        expect(paceToWeightGoal('gain', 1)).toBe('gain_0_50');
        expect(paceToWeightGoal('lose', 99)).toBe('lose_1_00'); // clamped
    });

    it('calculateGoalBreakdown is consistent with the goal', () => {
        const b = calculateGoalBreakdown({
            gender: 'male', age: 30, weight: 80, height: 180,
            activityLevel: 'sedentary', weightGoal: 'lose_0_50',
        });
        expect(b.bmr).toBe(1780);
        expect(b.tdee).toBe(2136);
        expect(b.goal).toBe(1586);
        expect(b.effectiveAdjustment).toBe(-550);
        expect(b.floored).toBe(false);
    });

    it('flags the safety floor when the goal is clamped', () => {
        expect(isGoalClampedBySafetyFloor({
            gender: 'female', age: 25, weight: 40, height: 150,
            activityLevel: 'sedentary', weightGoal: 'lose_1_00',
        })).toBe(true);
    });
});
