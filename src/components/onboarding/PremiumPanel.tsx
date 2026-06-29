import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform, Linking } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { PRIVACY_POLICY_URL, TERMS_URL } from '../../lib/legal';

// La app es gratis por ahora (sin IAP). Esta pantalla cierra el onboarding sin
// vender nada: nada de precios ni botón de compra (evita rechazo App Review 2.1).
// Se conserva el tipo y el prop opcional onChoosePlan para cuando se integre IAP.
export type PremiumPlan = 'annual' | 'monthly';

const BENEFITS: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
    { icon: 'flash-outline', text: 'Registro en segundos, por texto o voz' },
    { icon: 'eye-outline', text: 'Tu día completo de un vistazo' },
    { icon: 'trending-up-outline', text: 'Estadísticas y tendencias' },
    { icon: 'happy-outline', text: 'Sin anuncios' },
];

export function PremiumPanel({
    onSkip,
}: {
    onChoosePlan?: (plan: PremiumPlan) => void;
    onSkip: () => void;
}) {
    return (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.eyebrow}>KALORIEZ</Text>
            <Text style={styles.title}>Todo listo,{'\n'}y todo gratis</Text>
            <Text style={styles.subtitle}>
                Mientras crecemos, todas las funciones están desbloqueadas. Sin pagos, sin sorpresas.
            </Text>

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

            <Pressable
                style={styles.cta}
                onPress={() => {
                    if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    onSkip();
                }}
                accessibilityRole="button"
                accessibilityLabel="Comenzar"
            >
                <Text style={styles.ctaText}>Comenzar</Text>
            </Pressable>

            <View style={styles.legalRow}>
                <Pressable onPress={() => Linking.openURL(TERMS_URL)} hitSlop={8} accessibilityRole="link">
                    <Text style={styles.legalLink}>Términos</Text>
                </Pressable>
                <Text style={styles.legalSep}>·</Text>
                <Pressable onPress={() => Linking.openURL(PRIVACY_POLICY_URL)} hitSlop={8} accessibilityRole="link">
                    <Text style={styles.legalLink}>Aviso de privacidad</Text>
                </Pressable>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scroll: { paddingHorizontal: 28, paddingTop: 20, paddingBottom: 28, flexGrow: 1, justifyContent: 'center' },
    eyebrow: { ...typography.labelSmall, color: colors.accent, textAlign: 'center' },
    title: { fontSize: 28, fontWeight: '300', color: colors.textPrimary, letterSpacing: -0.5, textAlign: 'center', marginTop: 8 },
    subtitle: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: 8, marginBottom: 24, paddingHorizontal: 8 },

    benefits: { gap: 12, marginBottom: 28, alignSelf: 'center' },
    benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    benefitIcon: {
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: colors.sageLight, alignItems: 'center', justifyContent: 'center',
    },
    benefitText: { fontSize: 15, color: colors.textSecondary },

    cta: {
        backgroundColor: colors.accent, paddingVertical: 16, borderRadius: 14,
        alignItems: 'center', marginTop: 4,
    },
    ctaText: { fontSize: 17, fontWeight: '400', color: colors.textInverse },

    legalRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16 },
    legalLink: { fontSize: 12, color: colors.accent, textDecorationLine: 'underline' },
    legalSep: { fontSize: 12, color: colors.textDimmed },
});
