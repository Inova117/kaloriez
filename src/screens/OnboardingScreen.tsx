import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    ScrollView,
    Pressable,
    KeyboardAvoidingView,
    Platform,
    Alert,
    ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { colors } from '../theme/colors';
import { UserProfile, calculateDailyCalorieGoal } from '../utils/nutritionCalculator';
import { useAuth } from '../contexts/AuthContext';
import { updateDailyGoalInSupabase } from '../services/dataMigration';
import { logger } from '../utils/logger';

export const HAS_COMPLETED_ONBOARDING_KEY = '@has_completed_onboarding';
export const USER_PROFILE_KEY = '@user_profile';
export const GOAL_STORAGE_KEY = '@daily_goal';

interface OnboardingScreenProps {
    onComplete: () => void;
    isEditing?: boolean;
}

export function OnboardingScreen({ onComplete, isEditing = false }: OnboardingScreenProps) {
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [gender, setGender] = useState<'male' | 'female'>('male');
    const [age, setAge] = useState('');
    const [weight, setWeight] = useState('');
    const [height, setHeight] = useState('');
    const [activityLevel, setActivityLevel] = useState<UserProfile['activityLevel']>('moderately_active');
    const [weightGoal, setWeightGoal] = useState<UserProfile['weightGoal']>('lose_0_50');

    useEffect(() => {
        loadExistingProfile();
    }, []);

    const loadExistingProfile = async () => {
        try {
            const storedProfile = await AsyncStorage.getItem(USER_PROFILE_KEY);
            if (storedProfile) {
                const profile: UserProfile = JSON.parse(storedProfile);
                setGender(profile.gender);
                setAge(profile.age.toString());
                setWeight(profile.weight.toString());
                setHeight(profile.height.toString());
                setActivityLevel(profile.activityLevel);
                setWeightGoal(profile.weightGoal);
            }
        } catch (error) {
            logger.error('Failed to load profile', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCalculate = async () => {
        const parsedAge = parseInt(age);
        const parsedWeight = parseFloat(weight);
        const parsedHeight = parseFloat(height);

        if (!parsedAge || !parsedWeight || !parsedHeight) {
            Alert.alert('Missing Info', 'Please fill in your age, weight, and height correctly.');
            return;
        }

        const profile: UserProfile = {
            gender,
            age: parsedAge,
            weight: parsedWeight,
            height: parsedHeight,
            activityLevel,
            weightGoal,
        };

        const dailyGoal = calculateDailyCalorieGoal(profile);

        try {
            await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
            await AsyncStorage.setItem(GOAL_STORAGE_KEY, dailyGoal.toString());
            await AsyncStorage.setItem(HAS_COMPLETED_ONBOARDING_KEY, 'true');

            if (user) {
                await updateDailyGoalInSupabase(user.id, dailyGoal);
            }

            if (Platform.OS === 'ios') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            
            Alert.alert(
                'Goal Updated! 🎯',
                `Based on your profile, your daily goal is ${dailyGoal} calories.`,
                [{ text: "Awesome!", onPress: onComplete }]
            );
        } catch (error) {
            logger.error('Failed to save onboarding data', error);
            Alert.alert('Error', 'Something went wrong while saving your profile.');
        }
    };

    if (isLoading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={colors.accent} />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView 
                style={styles.keyboardView} 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    {!isEditing && (
                        <>
                            <Text style={styles.title}>Welcome! 👋</Text>
                            <Text style={styles.subtitle}>Let's set up your personalized daily calorie goal.</Text>
                        </>
                    )}
                    {isEditing && (
                        <Text style={styles.title}>Edit Profile ⚙️</Text>
                    )}

                    {/* Gender */}
                    <Text style={styles.label}>Gender</Text>
                    <View style={styles.row}>
                        <Pressable 
                            style={[styles.segmentBtn, gender === 'male' && styles.segmentBtnActive]} 
                            onPress={() => setGender('male')}
                        >
                            <Text style={[styles.segmentText, gender === 'male' && styles.segmentTextActive]}>Male</Text>
                        </Pressable>
                        <Pressable 
                            style={[styles.segmentBtn, gender === 'female' && styles.segmentBtnActive]} 
                            onPress={() => setGender('female')}
                        >
                            <Text style={[styles.segmentText, gender === 'female' && styles.segmentTextActive]}>Female</Text>
                        </Pressable>
                    </View>

                    {/* Age, Weight, Height */}
                    <Text style={styles.label}>Age (years)</Text>
                    <TextInput 
                        style={styles.input} 
                        keyboardType="number-pad" 
                        value={age} 
                        onChangeText={setAge} 
                        placeholder="e.g. 25"
                        placeholderTextColor={colors.textDimmed}
                    />

                    <Text style={styles.label}>Weight (kg)</Text>
                    <TextInput 
                        style={styles.input} 
                        keyboardType="decimal-pad" 
                        value={weight} 
                        onChangeText={setWeight} 
                        placeholder="e.g. 70"
                        placeholderTextColor={colors.textDimmed}
                    />

                    <Text style={styles.label}>Height (cm)</Text>
                    <TextInput 
                        style={styles.input} 
                        keyboardType="number-pad" 
                        value={height} 
                        onChangeText={setHeight} 
                        placeholder="e.g. 175"
                        placeholderTextColor={colors.textDimmed}
                    />

                    {/* Activity Level */}
                    <Text style={styles.label}>Activity Level</Text>
                    <View style={styles.pickerContainer}>
                        <Picker
                            selectedValue={activityLevel}
                            onValueChange={(itemValue) => setActivityLevel(itemValue as UserProfile['activityLevel'])}
                            style={styles.picker}
                        >
                            <Picker.Item label="Sedentary (Little/no exercise)" value="sedentary" />
                            <Picker.Item label="Lightly Active (1-3 days/week)" value="lightly_active" />
                            <Picker.Item label="Moderately Active (3-5 days/week)" value="moderately_active" />
                            <Picker.Item label="Very Active (6-7 days/week)" value="very_active" />
                            <Picker.Item label="Extra Active (Physical job/2x training)" value="extra_active" />
                        </Picker>
                    </View>

                    {/* Weight Goal */}
                    <Text style={styles.label}>Weekly Goal</Text>
                    <View style={styles.pickerContainer}>
                        <Picker
                            selectedValue={weightGoal}
                            onValueChange={(itemValue) => setWeightGoal(itemValue as UserProfile['weightGoal'])}
                            style={styles.picker}
                        >
                            <Picker.Item label="Lose 1.00 kg / week" value="lose_1_00" />
                            <Picker.Item label="Lose 0.75 kg / week" value="lose_0_75" />
                            <Picker.Item label="Lose 0.50 kg / week" value="lose_0_50" />
                            <Picker.Item label="Lose 0.25 kg / week" value="lose_0_25" />
                            <Picker.Item label="Maintain weight" value="maintain" />
                            <Picker.Item label="Gain 0.25 kg / week" value="gain_0_25" />
                            <Picker.Item label="Gain 0.50 kg / week" value="gain_0_50" />
                        </Picker>
                    </View>

                    <Pressable style={styles.submitBtn} onPress={handleCalculate}>
                        <Text style={styles.submitText}>Calculate My Goal</Text>
                    </Pressable>

                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        padding: 24,
        paddingBottom: 40,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: colors.textPrimary,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: colors.textSecondary,
        marginBottom: 32,
    },
    label: {
        fontSize: 15,
        fontWeight: '400',
        color: colors.textPrimary,
        marginBottom: 8,
        marginTop: 16,
    },
    input: {
        backgroundColor: colors.cardBackground,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        color: colors.textPrimary,
    },
    row: {
        flexDirection: 'row',
        gap: 12,
    },
    segmentBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: colors.cardBackground,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        alignItems: 'center',
    },
    segmentBtnActive: {
        backgroundColor: colors.accent,
        borderColor: colors.accent,
    },
    segmentText: {
        fontSize: 16,
        color: colors.textPrimary,
        fontWeight: '400',
    },
    segmentTextActive: {
        color: '#FFFFFF',
    },
    pickerContainer: {
        backgroundColor: colors.cardBackground,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        borderRadius: 12,
        overflow: 'hidden',
    },
    picker: {
        height: Platform.OS === 'ios' ? 150 : 50,
        color: colors.textPrimary,
    },
    submitBtn: {
        backgroundColor: colors.accent,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 40,
    },
    submitText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
});
