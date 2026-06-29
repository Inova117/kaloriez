import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, Linking, Modal, Switch, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { PRIVACY_POLICY_URL, TERMS_URL, MEDICAL_DISCLAIMER_URL } from '../lib/legal';
import { logger } from '../utils/logger';
import { colors } from '../theme/colors';
import { OnboardingScreen } from './OnboardingScreen';
import { USER_PROFILE_KEY } from './onboarding/OnboardingFlow';
import { UserProfile } from '../utils/nutritionCalculator';
import { loadMacros, saveMacros, resetMacros, defaultMacros, MacroGoals } from '../utils/macros';
import { enableWaterReminders, disableWaterReminders, DEFAULT_INTERVAL_HOURS } from '../services/waterReminders';
import { usePremium } from '../contexts/PremiumContext';
import { useTheme } from '../contexts/ThemeContext';
import { ThemePref } from '../theme/colors';

interface ProfileScreenProps {
    onClose: () => void;
}

const DAILY_GOAL_KEY = '@daily_goal';
const WATER_REMINDERS_KEY = '@water_reminders';
const WATER_INTERVAL_KEY = '@water_interval_hours';
const TARGET_WEIGHT_KEY = '@target_weight';
const TARGET_DATE_KEY = '@target_date';
const THEME_LABELS: Record<ThemePref, string> = { system: 'Sistema', light: 'Claro', dark: 'Oscuro' };
const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function formatTargetDate(iso: string): string {
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return iso;
    const [, y, mo, d] = m;
    return `${parseInt(d, 10)} ${MONTHS_ES[parseInt(mo, 10) - 1] ?? mo} ${y}`;
}
const ACTIVITY_LABELS: Record<UserProfile['activityLevel'], string> = {
    sedentary: 'Sedentario',
    lightly_active: 'Ligero',
    moderately_active: 'Moderado',
    very_active: 'Muy activo',
    extra_active: 'Extra activo',
};

// "1,234" without relying on Intl (Hermes' Intl is limited on native).
function groupThousands(n: number): string {
    return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function weightGoalDetail(wg: UserProfile['weightGoal']): string {
    if (wg === 'maintain') return 'Mantener peso';
    const dir = wg.startsWith('gain') ? 'Subir' : 'Bajar';
    const m = wg.match(/_(\d)_(\d{2})$/);
    const pace = m ? `${parseInt(m[1], 10)}.${m[2]} kg/sem` : '';
    return pace ? `${dir} · ${pace}` : dir;
}

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** A single grouped settings row (icon · label · value · accessory). */
function Row({ icon, label, value, onPress, isLast, accessory }: {
    icon: IconName;
    label: string;
    value?: string;
    onPress?: () => void;
    isLast?: boolean;
    accessory?: React.ReactNode;
}) {
    const body = (
        <View style={[styles.itemRow, !isLast && styles.itemDivider]}>
            <Ionicons name={icon} size={20} color={colors.textMuted} style={styles.itemIcon} />
            <Text style={styles.itemLabel}>{label}</Text>
            <View style={styles.itemRight}>
                {value != null && <Text style={styles.itemValue}>{value}</Text>}
                {accessory ?? (onPress ? (
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                ) : null)}
            </View>
        </View>
    );
    return onPress ? (
        <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
            {body}
        </Pressable>
    ) : body;
}

export function ProfileScreen({ onClose }: ProfileScreenProps) {
    const { user, signOut, deleteAccount } = useAuth();
    const { isPremium, setPremium } = usePremium();
    const { pref: themePref, setPref: setThemePref } = useTheme();
    const [waterIntervalHours, setWaterIntervalHours] = useState(DEFAULT_INTERVAL_HOURS);
    const [selector, setSelector] = useState<null | {
        title: string;
        options: { label: string; value: string }[];
        current: string;
        onSelect: (v: string) => void;
    }>(null);
    const [dailyGoal, setDailyGoal] = useState<number | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [waterReminders, setWaterReminders] = useState(false);
    const [targetWeight, setTargetWeight] = useState<number | null>(null);
    const [targetDate, setTargetDate] = useState<string | null>(null);
    const [macros, setMacros] = useState<MacroGoals | null>(null);
    const [macrosCustom, setMacrosCustom] = useState(false);
    const [targetEditorVisible, setTargetEditorVisible] = useState(false);
    const [tgtWeightInput, setTgtWeightInput] = useState('');
    const [tgtDateInput, setTgtDateInput] = useState('');
    const [macroEditorVisible, setMacroEditorVisible] = useState(false);
    const [pInput, setPInput] = useState('');
    const [cInput, setCInput] = useState('');
    const [fInput, setFInput] = useState('');
    const [editorVisible, setEditorVisible] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const [goalRaw, profileRaw, waterRaw, twRaw, tdRaw, intervalRaw] = await Promise.all([
                AsyncStorage.getItem(DAILY_GOAL_KEY),
                AsyncStorage.getItem(USER_PROFILE_KEY),
                AsyncStorage.getItem(WATER_REMINDERS_KEY),
                AsyncStorage.getItem(TARGET_WEIGHT_KEY),
                AsyncStorage.getItem(TARGET_DATE_KEY),
                AsyncStorage.getItem(WATER_INTERVAL_KEY),
            ]);
            const g = goalRaw ? parseInt(goalRaw, 10) : NaN;
            const goal = Number.isFinite(g) && g > 0 ? g : null;
            setDailyGoal(goal);
            setProfile(profileRaw ? (JSON.parse(profileRaw) as UserProfile) : null);
            setWaterReminders(waterRaw === '1');
            const iv = intervalRaw ? parseInt(intervalRaw, 10) : NaN;
            setWaterIntervalHours(Number.isFinite(iv) && iv > 0 ? iv : DEFAULT_INTERVAL_HOURS);
            const tw = twRaw ? parseFloat(twRaw) : NaN;
            setTargetWeight(Number.isFinite(tw) && tw > 0 ? tw : null);
            setTargetDate(tdRaw || null);
            const { macros: m, custom } = await loadMacros(goal ?? 2000);
            setMacros(m);
            setMacrosCustom(custom);
        } catch (error) {
            logger.error('Error loading profile settings', error);
        }
    };

    const toggleWaterReminders = async (value: boolean) => {
        setWaterReminders(value); // optimistic
        try {
            if (value) {
                const ok = await enableWaterReminders(waterIntervalHours);
                if (!ok && Platform.OS !== 'web') {
                    // Permission denied / unsupported → revert the switch.
                    setWaterReminders(false);
                    await AsyncStorage.setItem(WATER_REMINDERS_KEY, '0');
                    Alert.alert('Permiso necesario', 'Activa las notificaciones para recibir recordatorios de agua.');
                    return;
                }
            } else {
                await disableWaterReminders();
            }
            await AsyncStorage.setItem(WATER_REMINDERS_KEY, value ? '1' : '0');
        } catch (error) {
            logger.error('Error toggling water reminders', error);
        }
    };

    const changeWaterInterval = async (hours: number) => {
        setWaterIntervalHours(hours);
        try { await AsyncStorage.setItem(WATER_INTERVAL_KEY, String(hours)); }
        catch (error) { logger.error('Error saving water interval', error); }
        // Re-schedule with the new cadence if reminders are currently on.
        if (waterReminders) {
            await disableWaterReminders();
            await enableWaterReminders(hours);
        }
    };

    const openTargetEditor = () => {
        setTgtWeightInput(targetWeight ? String(targetWeight) : '');
        setTgtDateInput(targetDate || '');
        setTargetEditorVisible(true);
    };

    const saveTarget = async () => {
        const w = parseFloat(tgtWeightInput);
        const hasW = tgtWeightInput.trim().length > 0;
        const validW = Number.isFinite(w) && w >= 30 && w <= 300;
        const dateOk = !tgtDateInput || /^\d{4}-\d{2}-\d{2}$/.test(tgtDateInput.trim());
        if (hasW && !validW) {
            Alert.alert('Peso inválido', 'Ingresa un peso entre 30 y 300 kg.');
            return;
        }
        if (!dateOk) {
            Alert.alert('Fecha inválida', 'Usa el formato AAAA-MM-DD (p. ej. 2025-12-31).');
            return;
        }
        try {
            if (validW) { await AsyncStorage.setItem(TARGET_WEIGHT_KEY, String(w)); setTargetWeight(w); }
            else { await AsyncStorage.removeItem(TARGET_WEIGHT_KEY); setTargetWeight(null); }
            const d = tgtDateInput.trim();
            if (d) { await AsyncStorage.setItem(TARGET_DATE_KEY, d); setTargetDate(d); }
            else { await AsyncStorage.removeItem(TARGET_DATE_KEY); setTargetDate(null); }
            setTargetEditorVisible(false);
        } catch (error) {
            logger.error('saveTarget failed', error);
        }
    };

    const openMacroEditor = () => {
        const m = macros ?? defaultMacros(dailyGoal ?? 2000);
        setPInput(String(m.protein));
        setCInput(String(m.carbs));
        setFInput(String(m.fat));
        setMacroEditorVisible(true);
    };

    const saveMacroGoals = async () => {
        const p = parseInt(pInput, 10);
        const c = parseInt(cInput, 10);
        const f = parseInt(fInput, 10);
        if (![p, c, f].every((n) => Number.isFinite(n) && n >= 0)) {
            Alert.alert('Valores inválidos', 'Ingresa gramos válidos (0 o más).');
            return;
        }
        const m = { protein: p, carbs: c, fat: f };
        await saveMacros(m);
        setMacros(m);
        setMacrosCustom(true);
        setMacroEditorVisible(false);
    };

    const resetMacroGoals = async () => {
        await resetMacros();
        const m = defaultMacros(dailyGoal ?? 2000);
        setMacros(m);
        setMacrosCustom(false);
        setMacroEditorVisible(false);
    };

    const [isSavingPassword, setIsSavingPassword] = useState(false);

    const handleChangePassword = async () => {
        if (newPassword !== confirmPassword) {
            Alert.alert('Error', 'Las contraseñas no coinciden');
            return;
        }
        // Keep in sync with the sign-up rule (8 chars).
        if (newPassword.length < 8) {
            Alert.alert('Error', 'La contraseña debe tener al menos 8 caracteres');
            return;
        }

        setIsSavingPassword(true);
        try {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) {
                Alert.alert('Error', error.message);
                return;
            }
            Alert.alert('Listo', 'Tu contraseña se cambió correctamente');
            setIsChangingPassword(false);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error) {
            logger.error('Password change failed', error);
            Alert.alert('Error', 'No se pudo cambiar la contraseña. Inténtalo de nuevo.');
        } finally {
            setIsSavingPassword(false);
        }
    };

    const openLink = async (url: string) => {
        try {
            await Linking.openURL(url);
        } catch (error) {
            logger.error('Failed to open link', error);
            Alert.alert('Error', 'No se pudo abrir el enlace.');
        }
    };
    const handleOpenPrivacy = () => openLink(PRIVACY_POLICY_URL);
    const handleOpenTerms = () => openLink(TERMS_URL);
    const handleOpenMedical = () => openLink(MEDICAL_DISCLAIMER_URL);

    const handleLogout = () => {
        Alert.alert('Cerrar sesión', '¿Seguro que quieres cerrar sesión?', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Cerrar sesión', style: 'destructive', onPress: () => signOut() },
        ]);
    };

    const [isDeleting, setIsDeleting] = useState(false);

    const handleDeleteAccount = () => {
        Alert.alert(
            'Eliminar cuenta',
            'Esto elimina permanentemente tu cuenta y todos tus datos (registros de comida, historial de peso, metas). No se puede deshacer.',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: async () => {
                        setIsDeleting(true);
                        const { error } = await deleteAccount();
                        setIsDeleting(false);
                        if (error) {
                            Alert.alert('Error', 'No se pudo eliminar tu cuenta. Inténtalo de nuevo.');
                        }
                    },
                },
            ]
        );
    };

    const openEditor = () => setEditorVisible(true);
    const fullName = (user?.user_metadata?.full_name as string | undefined)?.trim();

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <Pressable
                    onPress={onClose}
                    style={styles.closeButton}
                    accessibilityRole="button"
                    accessibilityLabel="Cerrar"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Ionicons name="close" size={24} color={colors.textPrimary} />
                </Pressable>
                <Text style={styles.headerTitle}>Perfil</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Identity */}
                <View style={styles.identity}>
                    <View style={styles.avatar}>
                        <Ionicons name="person" size={34} color={colors.textMuted} />
                    </View>
                    <Text style={styles.name}>{fullName || 'Tu perfil'}</Text>
                    <Text style={styles.email}>{user?.email || 'No disponible'}</Text>
                </View>

                {/* Goals */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>MIS OBJETIVOS</Text>
                    <View style={styles.groupCard}>
                        <Row
                            icon="restaurant-outline"
                            label="Meta diaria"
                            value={dailyGoal ? `${groupThousands(dailyGoal)} kcal` : 'Configurar'}
                            onPress={openEditor}
                        />
                        <Row
                            icon="flag-outline"
                            label="Objetivo de peso"
                            value={profile ? weightGoalDetail(profile.weightGoal) : 'Configurar'}
                            onPress={openEditor}
                        />
                        <Row
                            icon="trophy-outline"
                            label="Peso objetivo"
                            value={targetWeight ? `${targetWeight} kg` : 'Definir'}
                            onPress={openTargetEditor}
                        />
                        <Row
                            icon="calendar-number-outline"
                            label="Fecha objetivo"
                            value={targetDate ? formatTargetDate(targetDate) : 'Definir'}
                            onPress={openTargetEditor}
                            isLast
                        />
                    </View>
                    <Text style={styles.hint}>Toca tu meta o perfil para recalcular tus calorías.</Text>
                </View>

                {/* Macros */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>MACROS</Text>
                    <View style={styles.groupCard}>
                        <Row icon="fitness-outline" label="Proteína" value={macros ? `${macros.protein} g` : '—'} onPress={openMacroEditor} />
                        <Row icon="fast-food-outline" label="Carbohidratos" value={macros ? `${macros.carbs} g` : '—'} onPress={openMacroEditor} />
                        <Row icon="flame-outline" label="Grasa" value={macros ? `${macros.fat} g` : '—'} onPress={openMacroEditor} isLast />
                    </View>
                    <Text style={styles.hint}>
                        {macrosCustom ? 'Personalizados por ti.' : 'Calculados desde tu meta (30 % / 40 % / 30 %).'}
                    </Text>
                </View>

                {/* Personal data */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>DATOS PERSONALES</Text>
                    <View style={styles.groupCard}>
                        <Row
                            icon="barbell-outline"
                            label="Peso actual"
                            value={profile ? `${profile.weight} kg` : 'Configurar'}
                            onPress={openEditor}
                        />
                        <Row
                            icon="swap-vertical-outline"
                            label="Altura"
                            value={profile ? `${profile.height} cm` : 'Configurar'}
                            onPress={openEditor}
                        />
                        <Row
                            icon="calendar-outline"
                            label="Edad"
                            value={profile ? `${profile.age} años` : 'Configurar'}
                            onPress={openEditor}
                        />
                        <Row
                            icon="walk-outline"
                            label="Nivel de actividad"
                            value={profile ? ACTIVITY_LABELS[profile.activityLevel] : 'Configurar'}
                            onPress={openEditor}
                        />
                        <Row
                            icon="male-female-outline"
                            label="Género"
                            value={profile ? (profile.gender === 'female' ? 'Femenino' : 'Masculino') : 'Configurar'}
                            onPress={openEditor}
                            isLast
                        />
                    </View>
                </View>

                {/* Preferences */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>PREFERENCIAS</Text>
                    <View style={styles.groupCard}>
                        <View style={[styles.itemRow, styles.itemDivider]}>
                            <Ionicons name="water-outline" size={20} color={colors.textMuted} style={styles.itemIcon} />
                            <View style={styles.itemLabelStack}>
                                <Text style={styles.itemLabel}>Recordatorios de agua</Text>
                                <Text style={styles.itemSub}>{`Notificaciones cada ${waterIntervalHours} h`}</Text>
                            </View>
                            <Switch
                                value={waterReminders}
                                onValueChange={toggleWaterReminders}
                                trackColor={{ false: colors.ghostBorder, true: colors.accent }}
                                thumbColor="#FFFFFF"
                            />
                        </View>
                        {waterReminders && (
                            <Row
                                icon="time-outline"
                                label="Frecuencia"
                                value={`Cada ${waterIntervalHours} h`}
                                onPress={() => setSelector({
                                    title: 'Frecuencia de recordatorios',
                                    current: String(waterIntervalHours),
                                    options: [1, 2, 3, 4, 6].map((h) => ({ label: `Cada ${h} h`, value: String(h) })),
                                    onSelect: (v) => { setSelector(null); changeWaterInterval(parseInt(v, 10)); },
                                })}
                            />
                        )}
                        <Row
                            icon="contrast-outline"
                            label="Apariencia"
                            value={THEME_LABELS[themePref]}
                            isLast
                            onPress={() => setSelector({
                                title: 'Apariencia',
                                current: themePref,
                                options: [
                                    { label: 'Sistema', value: 'system' },
                                    { label: 'Claro', value: 'light' },
                                    { label: 'Oscuro', value: 'dark' },
                                ],
                                onSelect: (v) => { setSelector(null); setThemePref(v as ThemePref); },
                            })}
                        />
                    </View>
                    <Text style={styles.hint}>
                        {Platform.OS === 'web'
                            ? 'El tema se aplica al instante.'
                            : 'El tema sigue tu sistema; el cambio manual se aplica al reiniciar la app.'}
                    </Text>
                </View>

                {/* Plan */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>PLAN</Text>
                    <View style={styles.groupCard}>
                        <Row
                            icon="sparkles-outline"
                            label="Plan actual"
                            value={isPremium ? 'Premium' : 'Gratis'}
                            isLast={!__DEV__}
                        />
                        {__DEV__ && (
                            <View style={styles.itemRow}>
                                <Ionicons name="construct-outline" size={20} color={colors.textMuted} style={styles.itemIcon} />
                                <Text style={styles.itemLabel}>DEV: simular Premium</Text>
                                <Switch
                                    value={isPremium}
                                    onValueChange={setPremium}
                                    trackColor={{ false: colors.ghostBorder, true: colors.accent }}
                                    thumbColor="#FFFFFF"
                                />
                            </View>
                        )}
                    </View>
                    <Text style={styles.hint}>Todo está disponible gratis por ahora.</Text>
                </View>

                {/* Account */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>CUENTA</Text>
                    <View style={styles.groupCard}>
                        <Row
                            icon="lock-closed-outline"
                            label="Contraseña"
                            onPress={() => setIsChangingPassword(!isChangingPassword)}
                            isLast
                            accessory={
                                <Ionicons
                                    name={isChangingPassword ? 'chevron-up' : 'chevron-forward'}
                                    size={18}
                                    color={colors.textMuted}
                                />
                            }
                        />
                    </View>

                    {isChangingPassword && (
                        <View style={styles.passwordForm}>
                            <TextInput
                                style={styles.input}
                                placeholder="Contraseña actual"
                                placeholderTextColor={colors.textDimmed}
                                secureTextEntry
                                value={currentPassword}
                                onChangeText={setCurrentPassword}
                            />
                            <TextInput
                                style={styles.input}
                                placeholder="Nueva contraseña"
                                placeholderTextColor={colors.textDimmed}
                                secureTextEntry
                                value={newPassword}
                                onChangeText={setNewPassword}
                            />
                            <TextInput
                                style={styles.input}
                                placeholder="Confirmar nueva contraseña"
                                placeholderTextColor={colors.textDimmed}
                                secureTextEntry
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                            />
                            <Pressable
                                style={[styles.saveButton, isSavingPassword && { opacity: 0.6 }]}
                                onPress={handleChangePassword}
                                disabled={isSavingPassword}
                            >
                                <Text style={styles.saveButtonText}>
                                    {isSavingPassword ? 'Cambiando…' : 'Cambiar contraseña'}
                                </Text>
                            </Pressable>
                        </View>
                    )}
                </View>

                {/* About */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>ACERCA DE</Text>
                    <View style={styles.groupCard}>
                        <Row
                            icon="shield-checkmark-outline"
                            label="Aviso de privacidad"
                            onPress={handleOpenPrivacy}
                            accessory={<Ionicons name="open-outline" size={18} color={colors.textMuted} />}
                        />
                        <Row
                            icon="document-text-outline"
                            label="Términos y condiciones"
                            onPress={handleOpenTerms}
                            accessory={<Ionicons name="open-outline" size={18} color={colors.textMuted} />}
                        />
                        <Row
                            icon="medkit-outline"
                            label="Aviso médico"
                            onPress={handleOpenMedical}
                            isLast
                            accessory={<Ionicons name="open-outline" size={18} color={colors.textMuted} />}
                        />
                    </View>
                </View>

                {/* Sign Out */}
                <Pressable style={styles.logoutButton} onPress={handleLogout}>
                    <Ionicons name="log-out-outline" size={20} color={colors.error} />
                    <Text style={styles.logoutText}>Cerrar sesión</Text>
                </Pressable>

                {/* Delete Account (required by App Store / Play Store) */}
                <Pressable style={styles.deleteButton} onPress={handleDeleteAccount} disabled={isDeleting}>
                    <Text style={styles.deleteText}>{isDeleting ? 'Eliminando…' : 'Eliminar cuenta'}</Text>
                </Pressable>

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Target weight + date editor */}
            <Modal visible={targetEditorVisible} transparent animationType="fade" onRequestClose={() => setTargetEditorVisible(false)}>
                <View style={styles.editorBackdrop}>
                    <View style={styles.editorCard}>
                        <Text style={styles.editorTitle}>Meta de peso</Text>
                        <Text style={styles.editorLabel}>Peso objetivo (kg)</Text>
                        <TextInput
                            style={styles.input}
                            value={tgtWeightInput}
                            onChangeText={setTgtWeightInput}
                            placeholder="65"
                            placeholderTextColor={colors.textDimmed}
                            keyboardType="numeric"
                        />
                        <Text style={styles.editorLabel}>Fecha objetivo (AAAA-MM-DD)</Text>
                        <TextInput
                            style={styles.input}
                            value={tgtDateInput}
                            onChangeText={setTgtDateInput}
                            placeholder="2025-12-31"
                            placeholderTextColor={colors.textDimmed}
                            autoCapitalize="none"
                        />
                        <View style={styles.editorActions}>
                            <Pressable style={styles.editorCancel} onPress={() => setTargetEditorVisible(false)}>
                                <Text style={styles.editorCancelText}>Cancelar</Text>
                            </Pressable>
                            <Pressable style={styles.editorSave} onPress={saveTarget}>
                                <Text style={styles.saveButtonText}>Guardar</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Macro goals editor */}
            <Modal visible={macroEditorVisible} transparent animationType="fade" onRequestClose={() => setMacroEditorVisible(false)}>
                <View style={styles.editorBackdrop}>
                    <View style={styles.editorCard}>
                        <Text style={styles.editorTitle}>Macros objetivo</Text>
                        <Text style={styles.editorLabel}>Proteína (g)</Text>
                        <TextInput style={styles.input} value={pInput} onChangeText={setPInput} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.textDimmed} />
                        <Text style={styles.editorLabel}>Carbohidratos (g)</Text>
                        <TextInput style={styles.input} value={cInput} onChangeText={setCInput} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.textDimmed} />
                        <Text style={styles.editorLabel}>Grasa (g)</Text>
                        <TextInput style={styles.input} value={fInput} onChangeText={setFInput} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.textDimmed} />
                        <View style={styles.editorActions}>
                            <Pressable style={styles.editorCancel} onPress={() => setMacroEditorVisible(false)}>
                                <Text style={styles.editorCancelText}>Cancelar</Text>
                            </Pressable>
                            <Pressable style={styles.editorSave} onPress={saveMacroGoals}>
                                <Text style={styles.saveButtonText}>Guardar</Text>
                            </Pressable>
                        </View>
                        <Pressable style={styles.resetLink} onPress={resetMacroGoals}>
                            <Text style={styles.resetLinkText}>Restablecer a sugeridos</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>

            {/* Generic single-choice selector (theme, water frequency, …) */}
            <Modal visible={!!selector} transparent animationType="fade" onRequestClose={() => setSelector(null)}>
                <View style={styles.editorBackdrop}>
                    <View style={styles.editorCard}>
                        <Text style={styles.editorTitle}>{selector?.title}</Text>
                        {selector?.options.map((opt) => {
                            const active = opt.value === selector.current;
                            return (
                                <Pressable
                                    key={opt.value}
                                    style={[styles.optionItem, active && styles.optionItemActive]}
                                    onPress={() => selector.onSelect(opt.value)}
                                >
                                    <Text style={[styles.optionItemText, active && styles.optionItemTextActive]}>{opt.label}</Text>
                                    {active && <Ionicons name="checkmark" size={18} color={colors.accent} />}
                                </Pressable>
                            );
                        })}
                        <Pressable style={[styles.editorCancel, { marginTop: 8 }]} onPress={() => setSelector(null)}>
                            <Text style={styles.editorCancelText}>Cancelar</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>

            <Modal visible={editorVisible} animationType="slide" presentationStyle="pageSheet">
                <OnboardingScreen
                    isEditing
                    onComplete={() => { setEditorVisible(false); loadSettings(); }}
                />
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.cardBorder,
    },
    closeButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '400',
        color: colors.textPrimary,
    },
    content: {
        flex: 1,
    },
    identity: {
        alignItems: 'center',
        paddingTop: 24,
        paddingBottom: 8,
        paddingHorizontal: 16,
    },
    avatar: {
        width: 76,
        height: 76,
        borderRadius: 38,
        backgroundColor: colors.inputBackground,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    name: {
        fontSize: 20,
        fontWeight: '600',
        color: colors.textPrimary,
    },
    email: {
        fontSize: 14,
        color: colors.textSecondary,
        marginTop: 2,
    },
    section: {
        marginTop: 24,
        paddingHorizontal: 16,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '400',
        color: colors.textMuted,
        letterSpacing: 0.8,
        marginBottom: 10,
    },
    groupCard: {
        backgroundColor: colors.cardBackground,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        overflow: 'hidden',
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 14,
    },
    itemDivider: {
        borderBottomWidth: 1,
        borderBottomColor: colors.cardBorder,
    },
    itemIcon: {
        marginRight: 12,
    },
    itemLabel: {
        flex: 1,
        fontSize: 16,
        color: colors.textPrimary,
        fontWeight: '400',
    },
    itemLabelStack: {
        flex: 1,
    },
    itemSub: {
        fontSize: 13,
        color: colors.textMuted,
        marginTop: 2,
    },
    itemRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    itemValue: {
        fontSize: 16,
        color: colors.textSecondary,
    },
    hint: {
        fontSize: 13,
        color: colors.textMuted,
        marginTop: 8,
        paddingHorizontal: 4,
    },
    passwordForm: {
        backgroundColor: colors.cardBackground,
        borderRadius: 12,
        padding: 16,
        marginTop: 8,
        borderWidth: 1,
        borderColor: colors.cardBorder,
    },
    input: {
        backgroundColor: colors.inputBackground,
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: colors.textPrimary,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.ghostBorder,
    },
    saveButton: {
        backgroundColor: colors.accent,
        borderRadius: 8,
        padding: 14,
        alignItems: 'center',
        marginTop: 8,
    },
    saveButtonText: {
        fontSize: 16,
        fontWeight: '400',
        color: colors.textInverse,
    },
    logoutButton: {
        flexDirection: 'row',
        gap: 8,
        marginHorizontal: 16,
        marginTop: 32,
        backgroundColor: colors.cardBackground,
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.error,
    },
    logoutText: {
        fontSize: 16,
        fontWeight: '400',
        color: colors.error,
    },
    deleteButton: {
        marginHorizontal: 16,
        marginTop: 12,
        padding: 16,
        alignItems: 'center',
    },
    deleteText: {
        fontSize: 14,
        fontWeight: '400',
        color: colors.error,
        textDecorationLine: 'underline',
    },
    editorBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    editorCard: {
        width: '100%',
        maxWidth: 360,
        backgroundColor: colors.cardBackground,
        borderRadius: 14,
        padding: 20,
        borderWidth: 1,
        borderColor: colors.cardBorder,
    },
    editorTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: colors.textPrimary,
        textAlign: 'center',
        marginBottom: 16,
    },
    editorLabel: {
        fontSize: 13,
        color: colors.textSecondary,
        marginBottom: 6,
        marginLeft: 2,
    },
    editorActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    editorCancel: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
        backgroundColor: colors.inputBackground,
        borderWidth: 1,
        borderColor: colors.ghostBorder,
    },
    editorCancelText: {
        fontSize: 16,
        color: colors.textSecondary,
    },
    editorSave: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
        backgroundColor: colors.accent,
    },
    resetLink: {
        alignItems: 'center',
        marginTop: 14,
    },
    resetLinkText: {
        fontSize: 14,
        color: colors.textMuted,
        textDecorationLine: 'underline',
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 14,
        borderRadius: 8,
        backgroundColor: colors.inputBackground,
        borderWidth: 1,
        borderColor: colors.ghostBorder,
        marginBottom: 8,
    },
    optionItemActive: {
        borderColor: colors.accent,
        backgroundColor: colors.accentSubtle,
    },
    optionItemText: {
        fontSize: 16,
        color: colors.textPrimary,
    },
    optionItemTextActive: {
        color: colors.accent,
        fontWeight: '500',
    },
});
