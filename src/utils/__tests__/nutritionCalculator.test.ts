import {
    calculateBMR,
    calculateTDEE,
    calculateDailyCalorieGoal,
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
