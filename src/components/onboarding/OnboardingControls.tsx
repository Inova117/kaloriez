import React from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { RollingNumber } from '../RollingNumber';

function tap() {
    if (Platform.OS === 'ios') Haptics.selectionAsync();
}

/* ---------- Progress dots ---------- */
export function ProgressDots({ total, index }: { total: number; index: number }) {
    return (
        <View style={styles.dotsRow} accessibilityLabel={`Paso ${index + 1} de ${total}`}>
            {Array.from({ length: total }).map((_, i) => (
                <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
        </View>
    );
}

/* ---------- Segmented control (2–3 options) ---------- */
export interface SegOption { label: string; value: string; }
export function SegmentedControl({
    options, value, onChange,
}: { options: SegOption[]; value: string; onChange: (v: string) => void }) {
    return (
        <View style={styles.segment}>
            {options.map((opt) => {
                const active = opt.value === value;
                return (
                    <Pressable
                        key={opt.value}
                        style={[styles.segItem, active && styles.segItemActive]}
                        onPress={() => { tap(); onChange(opt.value); }}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={opt.label}
                    >
                        <Text style={[styles.segText, active && styles.segTextActive]}>{opt.label}</Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

/* ---------- Big number input with steppers ---------- */
export function BigNumberInput({
    value, onChangeText, unit, placeholder, step = 1, min = 0, max = 9999, decimal = false,
}: {
    value: string;
    onChangeText: (v: string) => void;
    unit?: string;
    placeholder?: string;
    step?: number;
    min?: number;
    max?: number;
    decimal?: boolean;
}) {
    const nudge = (dir: number) => {
        tap();
        const current = parseFloat(value.replace(',', '.'));
        const base = Number.isFinite(current) ? current : (parseFloat(placeholder ?? '0') || 0);
        let next = base + dir * step;
        next = Math.max(min, Math.min(max, next));
        onChangeText(decimal ? String(Math.round(next * 10) / 10) : String(Math.round(next)));
    };

    return (
        <View style={styles.bigRow}>
            <Pressable style={styles.stepper} onPress={() => nudge(-1)} accessibilityRole="button" accessibilityLabel="Disminuir">
                <Ionicons name="remove" size={22} color={colors.textSecondary} />
            </Pressable>

            <View style={styles.bigCenter}>
                <TextInput
                    style={styles.bigInput}
                    value={value}
                    onChangeText={(t) => onChangeText(decimal ? t.replace(',', '.') : t)}
                    placeholder={placeholder}
                    placeholderTextColor={colors.textDimmed}
                    keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
                    textAlign="center"
                    maxLength={6}
                    selectionColor={colors.accent}
                />
                {unit ? <Text style={styles.bigUnit}>{unit}</Text> : null}
            </View>

            <Pressable style={styles.stepper} onPress={() => nudge(1)} accessibilityRole="button" accessibilityLabel="Aumentar">
                <Ionicons name="add" size={22} color={colors.textSecondary} />
            </Pressable>
        </View>
    );
}

/* ---------- Option row (vertical list, single select) ---------- */
export function OptionRow({
    title, description, selected, onPress,
}: { title: string; description?: string; selected: boolean; onPress: () => void }) {
    return (
        <Pressable
            style={[styles.optionRow, selected && styles.optionRowActive]}
            onPress={() => { tap(); onPress(); }}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={title}
        >
            <View style={{ flex: 1 }}>
                <Text style={[styles.optionTitle, selected && styles.optionTitleActive]}>{title}</Text>
                {description ? <Text style={styles.optionDesc}>{description}</Text> : null}
            </View>
            {selected && <Ionicons name="checkmark-circle" size={20} color={colors.accent} />}
        </Pressable>
    );
}

/* ---------- Pace chips (horizontal single select) ---------- */
export interface ChipOption { label: string; sublabel?: string; intense?: boolean; }
export function PaceChips({
    options, index, onChange,
}: { options: ChipOption[]; index: number; onChange: (i: number) => void }) {
    return (
        <View style={styles.chipsRow}>
            {options.map((opt, i) => {
                const active = i === index;
                return (
                    <Pressable
                        key={opt.label}
                        style={[styles.paceChip, active && styles.paceChipActive]}
                        onPress={() => { tap(); onChange(i); }}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`${opt.label}${opt.sublabel ? ', ' + opt.sublabel : ''}`}
                    >
                        <Text style={[styles.paceChipText, active && styles.paceChipTextActive]}>{opt.label}</Text>
                        {opt.sublabel ? (
                            <Text style={[styles.paceChipSub, active && styles.paceChipSubActive]}>{opt.sublabel}</Text>
                        ) : null}
                    </Pressable>
                );
            })}
        </View>
    );
}

/* ---------- Live estimate pill ---------- */
export function LiveEstimate({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
    return (
        <View style={styles.estimate}>
            <Text style={styles.estimateLabel}>{label}</Text>
            <View style={styles.estimateValueRow}>
                <RollingNumber value={value} style={styles.estimateValue} />
                {suffix ? <Text style={styles.estimateSuffix}> {suffix}</Text> : null}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    dotsRow: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.cardBorder },
    dotActive: { width: 20, backgroundColor: colors.accent },

    segment: {
        flexDirection: 'row',
        backgroundColor: colors.cardBackground,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        padding: 4,
        gap: 4,
    },
    segItem: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
    segItemActive: { backgroundColor: colors.accent },
    segText: { fontSize: 16, fontWeight: '400', color: colors.textPrimary },
    segTextActive: { color: colors.textInverse },

    bigRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
    stepper: {
        width: 48, height: 48, borderRadius: 24,
        backgroundColor: colors.cardBackground,
        borderWidth: 1, borderColor: colors.cardBorder,
        alignItems: 'center', justifyContent: 'center',
    },
    bigCenter: { flexDirection: 'row', alignItems: 'baseline', minWidth: 120, justifyContent: 'center' },
    // Explicit width: on web a TextInput with no width takes the browser's
    // default <input> size (~20 chars), which at 44px font balloons to ~590px and
    // pushes the steppers/number off-screen. A fixed, centered width fits up to
    // the 6-char maxLength on every platform.
    bigInput: { ...typography.calorieCount, fontSize: 44, width: 132, padding: 0, textAlign: 'center' },
    bigUnit: { fontSize: 16, color: colors.textDimmed, marginLeft: 6 },

    optionRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 16, paddingHorizontal: 16,
        borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder,
        backgroundColor: colors.cardBackground, marginBottom: 10,
    },
    optionRowActive: { backgroundColor: colors.sageLight, borderColor: colors.accent },
    optionTitle: { fontSize: 16, fontWeight: '400', color: colors.textPrimary },
    optionTitleActive: { color: colors.accentHighlight },
    optionDesc: { fontSize: 13, color: colors.textMuted, marginTop: 2 },

    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
    paceChip: {
        paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14,
        borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.cardBackground,
        alignItems: 'center', minWidth: 84,
    },
    paceChipActive: { backgroundColor: colors.sageLight, borderColor: colors.accent },
    paceChipText: { fontSize: 15, fontWeight: '500', color: colors.textPrimary },
    paceChipTextActive: { color: colors.accentHighlight },
    paceChipSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
    paceChipSubActive: { color: colors.accent },

    estimate: { alignItems: 'center', marginTop: 28 },
    estimateLabel: { ...typography.labelSmall, marginBottom: 6 },
    estimateValueRow: { flexDirection: 'row', alignItems: 'baseline' },
    estimateValue: { ...typography.calorieCount, fontSize: 30, color: colors.accentHighlight },
    estimateSuffix: { fontSize: 14, color: colors.textMuted },
});
