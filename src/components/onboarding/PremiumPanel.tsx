import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

export type PremiumPlan = 'annual' | 'monthly';

const BENEFITS: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
    { icon: 'trending-up-outline', text: 'Estadísticas y tendencias avanzadas' },
    { icon: 'nutrition-outline', text: 'Metas y macros personalizados' },
    { icon: 'cloud-done-outline', text: 'Respaldo e historial ilimitado' },
    { icon: 'ribbon-outline', text: 'Sin anuncios, para siempre' },
];

function tap() {
    if (Platform.OS === 'ios') Haptics.selectionAsync();
}

export function PremiumPanel({
    onChoosePlan,
    onSkip,
}: {
    onChoosePlan: (plan: PremiumPlan) => void;
    onSkip: () => void;
}) {
    const [plan, setPlan] = useState<PremiumPlan>('annual');

    return (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.eyebrow}>KALORIEZ PREMIUM</Text>
            <Text style={styles.title}>Saca el máximo{'\n'}provecho</Text>
            <Text style={styles.subtitle}>Lo básico siempre será gratis. Premium es para ir más lejos.</Text>

            <View style={styles.benefits}>
                {BENEFITS.map((b) => (
                    <View key={b.text} style={styles.benefitRow}>
                        <View style={styles.benefitIcon}>
                            <Ionicons name={b.icon} size={18} color={colors.accent} />
                        </View>
                        <Text style={styles.benefitText}>{b.text}</Text>
                    </View>
                ))}
            </View>

            {/* Plans */}
            <Pressable
                style={[styles.plan, plan === 'annual' && styles.planActive]}
                onPress={() => { tap(); setPlan('annual'); }}
                accessibilityRole="button"
                accessibilityState={{ selected: plan === 'annual' }}
                accessibilityLabel="Plan anual, 49.99 dólares al año"
            >
                <View style={styles.planLeft}>
                    <View style={styles.planRadio}>
                        {plan === 'annual' && <View style={styles.planRadioDot} />}
                    </View>
                    <View>
                        <Text style={styles.planName}>Anual</Text>
                        <Text style={styles.planSub}>≈ $4.17 USD / mes</Text>
                    </View>
                </View>
                <View style={styles.planRight}>
                    <View style={styles.badge}><Text style={styles.badgeText}>Ahorra 58%</Text></View>
                    <Text style={styles.planPrice}>$49.99<Text style={styles.planPer}> /año</Text></Text>
                </View>
            </Pressable>

            <Pressable
                style={[styles.plan, plan === 'monthly' && styles.planActive]}
                onPress={() => { tap(); setPlan('monthly'); }}
                accessibilityRole="button"
                accessibilityState={{ selected: plan === 'monthly' }}
                accessibilityLabel="Plan mensual, 9.99 dólares al mes"
            >
                <View style={styles.planLeft}>
                    <View style={styles.planRadio}>
                        {plan === 'monthly' && <View style={styles.planRadioDot} />}
                    </View>
                    <View>
                        <Text style={styles.planName}>Mensual</Text>
                        <Text style={styles.planSub}>Flexible, cancela cuando quieras</Text>
                    </View>
                </View>
                <View style={styles.planRight}>
                    <Text style={styles.planPrice}>$9.99<Text style={styles.planPer}> /mes</Text></Text>
                </View>
            </Pressable>

            <Pressable
                style={styles.cta}
                onPress={() => { if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onChoosePlan(plan); }}
                accessibilityRole="button"
                accessibilityLabel="Empezar Premium"
            >
                <Text style={styles.ctaText}>Empezar Premium</Text>
            </Pressable>

            <Pressable style={styles.skip} onPress={onSkip} accessibilityRole="button" accessibilityLabel="Continuar gratis">
                <Text style={styles.skipText}>Continuar gratis</Text>
            </Pressable>

            <Text style={styles.fine}>Cancela cuando quieras · Sin cargos sorpresa</Text>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scroll: { paddingHorizontal: 28, paddingTop: 20, paddingBottom: 28 },
    eyebrow: { ...typography.labelSmall, color: colors.accent, textAlign: 'center' },
    title: { fontSize: 28, fontWeight: '300', color: colors.textPrimary, letterSpacing: -0.5, textAlign: 'center', marginTop: 8 },
    subtitle: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: 8, marginBottom: 20 },

    benefits: { gap: 12, marginBottom: 24, alignSelf: 'center' },
    benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    benefitIcon: {
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: colors.sageLight, alignItems: 'center', justifyContent: 'center',
    },
    benefitText: { fontSize: 15, color: colors.textSecondary },

    plan: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        padding: 16, borderRadius: 16, borderWidth: 1.5, borderColor: colors.cardBorder,
        backgroundColor: colors.cardBackground, marginBottom: 12,
    },
    planActive: { borderColor: colors.accent, backgroundColor: colors.sageLight },
    planLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    planRadio: {
        width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.accent,
        alignItems: 'center', justifyContent: 'center',
    },
    planRadioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.accent },
    planName: { fontSize: 17, fontWeight: '400', color: colors.textPrimary },
    planSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    planRight: { alignItems: 'flex-end', gap: 4 },
    planPrice: { ...typography.cardCalories, fontSize: 18, color: colors.textPrimary },
    planPer: { fontSize: 13, color: colors.textMuted, fontWeight: '400' },
    badge: {
        backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
    },
    badgeText: { fontSize: 11, fontWeight: '500', color: colors.textInverse },

    cta: {
        backgroundColor: colors.accent, paddingVertical: 16, borderRadius: 14,
        alignItems: 'center', marginTop: 12,
    },
    ctaText: { fontSize: 17, fontWeight: '400', color: colors.textInverse },
    skip: { paddingVertical: 14, alignItems: 'center', marginTop: 2 },
    skipText: { fontSize: 15, color: colors.textMuted },
    fine: { fontSize: 12, color: colors.textDimmed, textAlign: 'center', marginTop: 4 },
});
