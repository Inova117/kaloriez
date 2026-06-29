import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    View, Text, StyleSheet, Pressable, Animated, Easing,
    KeyboardAvoidingView, Platform, ScrollView, LayoutAnimation, UIManager, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { RollingNumber } from '../../components/RollingNumber';
import { useAuth } from '../../contexts/AuthContext';
import { updateDailyGoalInSupabase } from '../../services/dataMigration';
import { logger } from '../../utils/logger';
import {
    UserProfile,
    calculateBMR,
    calculateTDEE,
    calculateGoalBreakdown,
    getKgPerWeek,
    getCalorieAdjustment,
    paceToWeightGoal,
} from '../../utils/nutritionCalculator';
import {
    ProgressDots, SegmentedControl, BigNumberInput, OptionRow, PaceChips, LiveEstimate,
} from '../../components/onboarding/OnboardingControls';
import { PremiumPanel, PremiumPlan } from '../../components/onboarding/PremiumPanel';
import { notify } from '../../utils/notify';
import { MEDICAL_DISCLAIMER_URL } from '../../lib/legal';

export const HAS_COMPLETED_ONBOARDING_KEY = '@has_completed_onboarding';
export const USER_PROFILE_KEY = '@user_profile';
export const GOAL_STORAGE_KEY = '@daily_goal';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Direction = 'lose' | 'maintain' | 'gain';

const ACTIVITIES: { value: UserProfile['activityLevel']; title: string; desc: string }[] = [
    { value: 'sedentary', title: 'Sedentario', desc: 'Trabajo de escritorio, poco o nada de ejercicio.' },
    { value: 'lightly_active', title: 'Ligero', desc: 'Camino o entreno 1–3 días por semana.' },
    { value: 'moderately_active', title: 'Moderado', desc: 'Entreno 3–5 días por semana.' },
    { value: 'very_active', title: 'Muy activo', desc: 'Entreno fuerte 6–7 días por semana.' },
    { value: 'extra_active', title: 'Extra activo', desc: 'Trabajo físico o doble sesión diaria.' },
];

const LOSE_PACE = [
    { label: 'Suave', sublabel: '0.25 kg' },
    { label: 'Cómodo', sublabel: '0.50 kg' },
    { label: 'Ambicioso', sublabel: '0.75 kg' },
    { label: 'Intenso', sublabel: '1.0 kg' },
];
const GAIN_PACE = [
    { label: 'Suave', sublabel: '0.25 kg' },
    { label: 'Constante', sublabel: '0.50 kg' },
];

const TOTAL_INPUT_STEPS = 4; // gender/age, body, activity, goal (result is the payoff)

interface OnboardingFlowProps {
    onComplete: () => void;
    isEditing?: boolean;
}

export function OnboardingFlow({ onComplete, isEditing = false }: OnboardingFlowProps) {
    const { user } = useAuth();

    const [step, setStep] = useState(0);
    const [gender, setGender] = useState<UserProfile['gender']>('male');
    const [age, setAge] = useState('');
    const [weight, setWeight] = useState('');
    const [height, setHeight] = useState('');
    const [activityLevel, setActivityLevel] = useState<UserProfile['activityLevel']>('moderately_active');
    const [direction, setDirection] = useState<Direction>('lose');
    const [paceIndex, setPaceIndex] = useState(1); // lose_0_50 by default
    const [showBreakdown, setShowBreakdown] = useState(false);
    const [resultDisplay, setResultDisplay] = useState(0);

    const fade = useRef(new Animated.Value(1)).current;

    // Prefill when editing / returning.
    useEffect(() => {
        (async () => {
            try {
                const stored = await AsyncStorage.getItem(USER_PROFILE_KEY);
                if (!stored) return;
                const p: UserProfile = JSON.parse(stored);
                setGender(p.gender);
                setAge(String(p.age));
                setWeight(String(p.weight));
                setHeight(String(p.height));
                setActivityLevel(p.activityLevel);
                if (p.weightGoal === 'maintain') { setDirection('maintain'); }
                else if (p.weightGoal.startsWith('gain')) {
                    setDirection('gain');
                    setPaceIndex(p.weightGoal === 'gain_0_50' ? 1 : 0);
                } else {
                    setDirection('lose');
                    setPaceIndex(['lose_0_25', 'lose_0_50', 'lose_0_75', 'lose_1_00'].indexOf(p.weightGoal));
                }
            } catch (e) {
                logger.error('Failed to prefill onboarding', e);
            }
        })();
    }, []);

    useEffect(() => {
        // Only the active step is mounted (no fixed-width track that could
        // overflow on web); a quick fade smooths the transition.
        fade.setValue(0);
        Animated.timing(fade, {
            toValue: 1,
            duration: 220,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();
    }, [step]);

    const ageNum = parseInt(age, 10);
    const weightNum = parseFloat(weight);
    const heightNum = parseFloat(height);
    const ageValid = Number.isFinite(ageNum) && ageNum >= 13 && ageNum <= 100;
    const weightValid = Number.isFinite(weightNum) && weightNum >= 30 && weightNum <= 250;
    const heightValid = Number.isFinite(heightNum) && heightNum >= 100 && heightNum <= 230;

    const weightGoal = paceToWeightGoal(direction, paceIndex);

    const liveProfile: UserProfile | null = useMemo(() => {
        if (!ageValid || !weightValid || !heightValid) return null;
        return { gender, age: ageNum, weight: weightNum, height: heightNum, activityLevel, weightGoal };
    }, [gender, ageNum, weightNum, heightNum, activityLevel, weightGoal, ageValid, weightValid, heightValid]);

    const liveBmr = liveProfile ? Math.round(calculateBMR(liveProfile)) : 0;
    const liveTdee = liveProfile ? Math.round(calculateTDEE(calculateBMR(liveProfile), activityLevel)) : 0;
    const breakdown = liveProfile ? calculateGoalBreakdown(liveProfile) : null;

    // Animate the result number from maintenance (TDEE) toward the goal.
    useEffect(() => {
        if (step === 4 && breakdown) {
            setResultDisplay(breakdown.tdee);
            const t = setTimeout(() => setResultDisplay(breakdown.goal), 350);
            return () => clearTimeout(t);
        }
    }, [step, breakdown?.tdee, breakdown?.goal]);

    const canAdvance =
        step === 0 ? ageValid :
        step === 1 ? (weightValid && heightValid) :
        true;

    // When editing the profile we stop at the result (no first-run paywall).
    const lastStep = isEditing ? 4 : 5;
    const goNext = () => {
        if (step < lastStep) {
            if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setStep(step + 1);
        }
    };
    const goBack = () => { if (step > 0) setStep(step - 1); };

    const handleFinish = async () => {
        if (!liveProfile) return;
        const goal = breakdown!.goal;
        try {
            await AsyncStorage.multiSet([
                [USER_PROFILE_KEY, JSON.stringify(liveProfile)],
                [GOAL_STORAGE_KEY, String(goal)],
                [HAS_COMPLETED_ONBOARDING_KEY, 'true'],
            ]);
            if (user) updateDailyGoalInSupabase(user.id, goal);
            if (Platform.OS === 'ios') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onComplete();
        } catch (e) {
            logger.error('Failed to save onboarding', e);
        }
    };

    const primaryLabel = step < 3 ? 'Siguiente'
        : step === 3 ? 'Ver mi meta'
        : isEditing ? 'Guardar'
        : 'Continuar';
    const primaryAction = (step === 4 && isEditing) ? handleFinish : goNext;
    const primaryDisabled = !canAdvance;

    const paceOptions = direction === 'lose' ? LOSE_PACE : GAIN_PACE;

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                {/* Progress */}
                <View style={styles.topBar}>
                    {isEditing && (
                        <Pressable
                            style={styles.closeX}
                            onPress={onComplete}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            accessibilityRole="button"
                            accessibilityLabel="Cerrar"
                        >
                            <Ionicons name="close" size={24} color={colors.textMuted} />
                        </Pressable>
                    )}
                    {step < 4 ? <ProgressDots total={TOTAL_INPUT_STEPS} index={step} /> : <View style={{ height: 6 }} />}
                </View>

                {/* Only the active step is rendered, full-width (no carousel
                    track), so a neighbouring panel can never bleed in. */}
                <View style={styles.viewport}>
                    <Animated.View style={[styles.flex, { opacity: fade }]}>
                        {/* Step 0 — Gender + Age */}
                        <Panel active={step === 0}>
                            <Text style={styles.title}>Hablemos de ti</Text>
                            <Text style={styles.subtitle}>Lo usamos para calcular tu metabolismo.</Text>
                            <View style={styles.block}>
                                <Text style={styles.fieldLabel}>¿Cuál es tu sexo?</Text>
                                <SegmentedControl
                                    options={[{ label: 'Hombre', value: 'male' }, { label: 'Mujer', value: 'female' }]}
                                    value={gender}
                                    onChange={(v) => setGender(v as UserProfile['gender'])}
                                />
                            </View>
                            <View style={styles.block}>
                                <Text style={styles.fieldLabel}>¿Cuántos años tienes?</Text>
                                <BigNumberInput value={age} onChangeText={setAge} unit="años" placeholder="25" min={13} max={100} />
                                {!ageValid && age.length > 0 && <Text style={styles.hint}>Pon una edad entre 13 y 100.</Text>}
                            </View>
                        </Panel>

                        {/* Step 1 — Weight + Height */}
                        <Panel active={step === 1}>
                            <Text style={styles.title}>Tus medidas</Text>
                            <Text style={styles.subtitle}>Con esto calculamos tu gasto de energía.</Text>
                            <View style={styles.block}>
                                <Text style={styles.fieldLabel}>Peso</Text>
                                <BigNumberInput value={weight} onChangeText={setWeight} unit="kg" placeholder="70" step={0.5} min={30} max={250} decimal />
                                {!weightValid && weight.length > 0 && <Text style={styles.hint}>Pon un peso entre 30 y 250 kg.</Text>}
                            </View>
                            <View style={styles.block}>
                                <Text style={styles.fieldLabel}>Estatura</Text>
                                <BigNumberInput value={height} onChangeText={setHeight} unit="cm" placeholder="170" min={100} max={230} />
                                {!heightValid && height.length > 0 && <Text style={styles.hint}>Pon una estatura entre 100 y 230 cm.</Text>}
                            </View>
                            {liveProfile && <LiveEstimate label="Tu metabolismo basal" value={liveBmr} suffix="kcal/día" />}
                        </Panel>

                        {/* Step 2 — Activity */}
                        <Panel active={step === 2}>
                            <Text style={styles.title}>¿Qué tan activo eres?</Text>
                            <Text style={styles.subtitle}>Cuenta tu actividad típica, no el ejercicio de hoy.</Text>
                            <View style={styles.block}>
                                {ACTIVITIES.map((a) => (
                                    <OptionRow
                                        key={a.value}
                                        title={a.title}
                                        description={a.desc}
                                        selected={activityLevel === a.value}
                                        onPress={() => setActivityLevel(a.value)}
                                    />
                                ))}
                            </View>
                            {liveProfile && <LiveEstimate label="Gastas al día (mantenimiento)" value={liveTdee} suffix="kcal" />}
                        </Panel>

                        {/* Step 3 — Goal + pace */}
                        <Panel active={step === 3}>
                            <Text style={styles.title}>¿Cuál es tu objetivo?</Text>
                            <Text style={styles.subtitle}>Ajusta el ritmo y mira cómo cambia tu meta.</Text>
                            <View style={styles.block}>
                                <SegmentedControl
                                    options={[
                                        { label: 'Bajar', value: 'lose' },
                                        { label: 'Mantener', value: 'maintain' },
                                        { label: 'Subir', value: 'gain' },
                                    ]}
                                    value={direction}
                                    onChange={(v) => { const d = v as Direction; setDirection(d); setPaceIndex(d === 'gain' ? 0 : 1); }}
                                />
                            </View>
                            {direction !== 'maintain' && (
                                <View style={styles.block}>
                                    <Text style={styles.fieldLabel}>Ritmo por semana</Text>
                                    <PaceChips
                                        options={paceOptions}
                                        index={Math.min(paceIndex, paceOptions.length - 1)}
                                        onChange={setPaceIndex}
                                    />
                                </View>
                            )}
                            {liveProfile && breakdown && (
                                <>
                                    <LiveEstimate label="Tu meta diaria" value={breakdown.goal} suffix="kcal" />
                                    <Text style={styles.paceLine}>
                                        {direction === 'maintain'
                                            ? 'Comes justo lo que gastas.'
                                            : `${direction === 'lose' ? 'Déficit' : 'Superávit'} de ${Math.abs(getCalorieAdjustment(weightGoal))} kcal al día · ${Math.abs(getKgPerWeek(weightGoal)).toFixed(2)} kg/semana`}
                                    </Text>
                                    {breakdown.floored && (
                                        <Text style={styles.warnLine}>
                                            Tu meta no baja de {breakdown.goal} kcal por tu seguridad; bajarás un poco más lento.
                                        </Text>
                                    )}
                                </>
                            )}
                        </Panel>

                        {/* Step 4 — Result */}
                        <Panel active={step === 4}>
                            <ScrollView contentContainerStyle={styles.resultScroll} showsVerticalScrollIndicator={false}>
                                <Text style={styles.eyebrow}>TU META DIARIA</Text>
                                <View style={styles.resultNumberRow}>
                                    <RollingNumber value={resultDisplay} style={styles.resultNumber} />
                                    <Text style={styles.resultUnit}> kcal</Text>
                                </View>
                                <Text style={styles.method}>Calculado con el método Mifflin-St Jeor.</Text>

                                <Pressable
                                    style={styles.breakdownToggle}
                                    onPress={() => {
                                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                        setShowBreakdown((s) => !s);
                                    }}
                                    accessibilityRole="button"
                                    accessibilityLabel="¿Cómo lo calculamos?"
                                >
                                    <Text style={styles.breakdownToggleText}>¿Cómo lo calculamos?</Text>
                                    <Ionicons name={showBreakdown ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
                                </Pressable>

                                {showBreakdown && breakdown && (
                                    <View style={styles.breakdownCard}>
                                        <BreakdownRow label="Metabolismo basal" value={breakdown.bmr} />
                                        <View style={styles.bdDivider} />
                                        <BreakdownRow label="Con tu actividad" value={breakdown.tdee} />
                                        <View style={styles.bdDivider} />
                                        <BreakdownRow
                                            label="Ajuste por tu objetivo"
                                            value={breakdown.effectiveAdjustment}
                                            signed
                                        />
                                    </View>
                                )}

                                {breakdown && direction !== 'maintain' && (
                                    <Text style={styles.projection}>
                                        A este ritmo, {direction === 'lose' ? 'bajarás' : 'subirás'} ~{Math.abs(getKgPerWeek(weightGoal)).toFixed(2)} kg por semana.
                                    </Text>
                                )}
                                <Text style={[styles.method, { marginTop: 18, lineHeight: 18, paddingHorizontal: 8 }]}>
                                    Es una estimación informativa, no consejo médico. Consulta a un profesional de salud antes de cambiar tu alimentación.{' '}
                                    <Text
                                        style={{ color: colors.accent, textDecorationLine: 'underline' }}
                                        onPress={() => Linking.openURL(MEDICAL_DISCLAIMER_URL)}
                                    >
                                        Aviso médico
                                    </Text>
                                </Text>
                            </ScrollView>
                        </Panel>

                        {/* Step 5 — Premium (gentle, transparent paywall) */}
                        <Panel active={step === 5}>
                            <PremiumPanel
                                onChoosePlan={(plan: PremiumPlan) => {
                                    notify(
                                        'Muy pronto 💚',
                                        'Estamos terminando de activar los pagos. Por ahora entras con todo desbloqueado.'
                                    );
                                    handleFinish();
                                }}
                                onSkip={handleFinish}
                            />
                        </Panel>
                    </Animated.View>
                </View>

                {/* Footer (hidden on the premium step, which has its own CTAs) */}
                {step < 5 && (
                <View style={styles.footer}>
                    {step > 0 ? (
                        <Pressable onPress={goBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Atrás">
                            <Text style={styles.backText}>Atrás</Text>
                        </Pressable>
                    ) : <View style={styles.backBtn} />}

                    <Pressable
                        onPress={primaryAction}
                        disabled={primaryDisabled}
                        style={[styles.primaryBtn, primaryDisabled && styles.primaryBtnDisabled]}
                        accessibilityRole="button"
                        accessibilityLabel={primaryLabel}
                    >
                        <Text style={styles.primaryText}>{primaryLabel}</Text>
                    </Pressable>
                </View>
                )}
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

function Panel({ active, children }: { active: boolean; children: React.ReactNode }) {
    if (!active) return null;
    return <View style={styles.panel}>{children}</View>;
}

function BreakdownRow({ label, value, signed }: { label: string; value: number; signed?: boolean }) {
    const text = signed ? `${value >= 0 ? '+' : '−'}${Math.abs(value)}` : String(value);
    return (
        <View style={styles.bdRow}>
            <Text style={styles.bdLabel}>{label}</Text>
            <Text style={styles.bdValue}>{text}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    viewport: { flex: 1, overflow: 'hidden' },
    topBar: { paddingTop: 12, paddingBottom: 8, alignItems: 'center', justifyContent: 'center' },
    closeX: { position: 'absolute', left: 16, top: 8, zIndex: 10, padding: 4 },
    track: { flexDirection: 'row', flex: 1 },
    panel: { flex: 1, paddingHorizontal: 28, paddingTop: 24, justifyContent: 'flex-start' },
    title: { fontSize: 28, fontWeight: '300', color: colors.textPrimary, letterSpacing: -0.5 },
    subtitle: { fontSize: 15, color: colors.textMuted, marginTop: 6, marginBottom: 8 },
    block: { marginTop: 24 },
    fieldLabel: { fontSize: 15, color: colors.textSecondary, marginBottom: 14, textAlign: 'center' },
    hint: { fontSize: 13, color: colors.error, marginTop: 10, textAlign: 'center' },
    paceLine: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 12 },
    warnLine: { fontSize: 13, color: colors.warning, textAlign: 'center', marginTop: 8, paddingHorizontal: 10 },

    // Result
    resultScroll: { alignItems: 'center', paddingTop: 24, paddingBottom: 20 },
    eyebrow: { ...typography.labelSmall, marginBottom: 10 },
    resultNumberRow: { flexDirection: 'row', alignItems: 'baseline' },
    resultNumber: { ...typography.calorieCount, fontSize: 72, letterSpacing: -2 },
    resultUnit: { fontSize: 20, fontWeight: '300', color: colors.textSecondary },
    method: { fontSize: 14, color: colors.textMuted, marginTop: 10, textAlign: 'center' },
    breakdownToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 28, paddingVertical: 8 },
    breakdownToggleText: { fontSize: 15, color: colors.textSecondary, fontWeight: '400' },
    breakdownCard: {
        alignSelf: 'stretch', marginTop: 6, backgroundColor: colors.cardBackground,
        borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, paddingHorizontal: 16,
    },
    bdRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14 },
    bdLabel: { fontSize: 15, color: colors.textSecondary },
    bdValue: { ...typography.cardCalories, fontSize: 16, color: colors.textPrimary },
    bdDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.cardBorder },
    projection: { fontSize: 14, color: colors.textMuted, marginTop: 22, textAlign: 'center', paddingHorizontal: 10 },

    // Footer
    footer: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, gap: 12,
    },
    backBtn: { minWidth: 64, paddingVertical: 12 },
    backText: { fontSize: 16, color: colors.textMuted },
    primaryBtn: {
        flex: 1, backgroundColor: colors.accent, paddingVertical: 16, borderRadius: 14, alignItems: 'center',
    },
    primaryBtnDisabled: { opacity: 0.4 },
    primaryText: { fontSize: 17, fontWeight: '400', color: colors.textInverse },
});
