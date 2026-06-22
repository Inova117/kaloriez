import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import { colors } from '../theme/colors';

interface ProfileScreenProps {
    onClose: () => void;
}

const GOAL_STORAGE_KEY = '@weekly_weight_goal';
// TODO: replace with your hosted privacy policy URL before store submission.
const PRIVACY_POLICY_URL = 'https://kaloriez.app/privacy';

export function ProfileScreen({ onClose }: ProfileScreenProps) {
    const { user, signOut, deleteAccount } = useAuth();
    const [weeklyGoal, setWeeklyGoal] = useState('0.5');
    const [isEditingGoal, setIsEditingGoal] = useState(false);
    const [tempGoal, setTempGoal] = useState('0.5');
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    useEffect(() => {
        loadWeeklyGoal();
    }, []);

    const loadWeeklyGoal = async () => {
        try {
            const saved = await AsyncStorage.getItem(GOAL_STORAGE_KEY);
            if (saved) {
                setWeeklyGoal(saved);
                setTempGoal(saved);
            }
        } catch (error) {
            logger.error('Error loading weekly goal', error);
        }
    };

    const saveWeeklyGoal = async () => {
        try {
            await AsyncStorage.setItem(GOAL_STORAGE_KEY, tempGoal);
            setWeeklyGoal(tempGoal);
            setIsEditingGoal(false);
        } catch (error) {
            logger.error('Error saving weekly goal', error);
        }
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

    const handleOpenPrivacy = async () => {
        try {
            await Linking.openURL(PRIVACY_POLICY_URL);
        } catch (error) {
            logger.error('Failed to open privacy policy', error);
            Alert.alert('Error', 'No se pudo abrir el aviso de privacidad.');
        }
    };

    const handleLogout = () => {
        Alert.alert(
            'Cerrar sesión',
            '¿Seguro que quieres cerrar sesión?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Cerrar sesión',
                    style: 'destructive',
                    onPress: () => signOut()
                }
            ]
        );
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
                        // On success the auth state change unmounts this screen.
                    },
                },
            ]
        );
    };

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
                {/* Account Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>CUENTA</Text>

                    <View style={styles.card}>
                        <View style={styles.row}>
                            <Text style={styles.label}>Correo</Text>
                            <Text style={styles.value}>{user?.email || 'No disponible'}</Text>
                        </View>
                    </View>

                    <Pressable 
                        style={styles.card}
                        onPress={() => setIsChangingPassword(!isChangingPassword)}
                    >
                        <View style={styles.row}>
                            <Text style={styles.label}>Contraseña</Text>
                            <Ionicons 
                                name={isChangingPassword ? "chevron-up" : "chevron-forward"} 
                                size={20} 
                                color={colors.textMuted} 
                            />
                        </View>
                    </Pressable>

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

                {/* Goals Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>METAS</Text>

                    <Pressable
                        style={styles.card}
                        onPress={() => setIsEditingGoal(!isEditingGoal)}
                    >
                        <View style={styles.row}>
                            <Text style={styles.label}>Meta de peso semanal</Text>
                            <View style={styles.goalValue}>
                                <Text style={styles.value}>{weeklyGoal} kg/semana</Text>
                                <Ionicons 
                                    name={isEditingGoal ? "chevron-up" : "chevron-forward"} 
                                    size={20} 
                                    color={colors.textMuted} 
                                />
                            </View>
                        </View>
                    </Pressable>

                    {isEditingGoal && (
                        <View style={styles.goalForm}>
                            <Text style={styles.formLabel}>Elige tu meta de pérdida de peso semanal</Text>
                            {['0.25', '0.5', '0.75', '1.0'].map((goal) => (
                                <Pressable
                                    key={goal}
                                    style={[
                                        styles.goalOption,
                                        tempGoal === goal && styles.goalOptionSelected
                                    ]}
                                    onPress={() => setTempGoal(goal)}
                                >
                                    <Text style={[
                                        styles.goalOptionText,
                                        tempGoal === goal && styles.goalOptionTextSelected
                                    ]}>
                                        {goal} kg / semana
                                    </Text>
                                    {tempGoal === goal && (
                                        <Ionicons name="checkmark" size={20} color={colors.accent} />
                                    )}
                                </Pressable>
                            ))}
                            <Pressable 
                                style={styles.saveButton}
                                onPress={saveWeeklyGoal}
                            >
                                <Text style={styles.saveButtonText}>Guardar meta</Text>
                            </Pressable>
                        </View>
                    )}
                </View>

                {/* About */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>ACERCA DE</Text>
                    <Pressable
                        style={styles.card}
                        onPress={handleOpenPrivacy}
                        accessibilityRole="link"
                        accessibilityLabel="Aviso de privacidad"
                    >
                        <View style={styles.row}>
                            <Text style={styles.label}>Aviso de privacidad</Text>
                            <Ionicons name="open-outline" size={18} color={colors.textMuted} />
                        </View>
                    </Pressable>
                </View>

                {/* Sign Out */}
                <Pressable style={styles.logoutButton} onPress={handleLogout}>
                    <Text style={styles.logoutText}>Cerrar sesión</Text>
                </Pressable>

                {/* Delete Account (required by App Store / Play Store) */}
                <Pressable
                    style={styles.deleteButton}
                    onPress={handleDeleteAccount}
                    disabled={isDeleting}
                >
                    <Text style={styles.deleteText}>
                        {isDeleting ? 'Eliminando…' : 'Eliminar cuenta'}
                    </Text>
                </Pressable>

                <View style={{ height: 40 }} />
            </ScrollView>
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
    section: {
        marginTop: 24,
        paddingHorizontal: 16,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '400',
        color: colors.textMuted,
        letterSpacing: 0.8,
        marginBottom: 12,
    },
    card: {
        backgroundColor: colors.cardBackground,
        borderRadius: 12,
        padding: 16,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: colors.cardBorder,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    label: {
        fontSize: 16,
        color: colors.textPrimary,
        fontWeight: '400',
    },
    value: {
        fontSize: 16,
        color: colors.textSecondary,
    },
    goalValue: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    passwordForm: {
        backgroundColor: colors.cardBackground,
        borderRadius: 12,
        padding: 16,
        marginTop: 8,
        borderWidth: 1,
        borderColor: colors.cardBorder,
    },
    goalForm: {
        backgroundColor: colors.cardBackground,
        borderRadius: 12,
        padding: 16,
        marginTop: 8,
        borderWidth: 1,
        borderColor: colors.cardBorder,
    },
    formLabel: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: 12,
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
    goalOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
        backgroundColor: colors.inputBackground,
        borderWidth: 1,
        borderColor: colors.ghostBorder,
    },
    goalOptionSelected: {
        backgroundColor: colors.accent + '10',
        borderColor: colors.accent,
    },
    goalOptionText: {
        fontSize: 16,
        color: colors.textPrimary,
    },
    goalOptionTextSelected: {
        color: colors.accent,
        fontWeight: '400',
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
        marginHorizontal: 16,
        marginTop: 32,
        backgroundColor: colors.cardBackground,
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
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
});
