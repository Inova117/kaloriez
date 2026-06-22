import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    Pressable,
    KeyboardAvoidingView,
    Platform,
    Alert,
    ActivityIndicator,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

export function AuthScreen() {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const { signIn, signUp } = useAuth();

    const handleSubmit = async () => {
        // Validate email and password
        if (!email || !password) {
            Alert.alert('Error', 'Por favor llena todos los campos');
            return;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            Alert.alert('Correo inválido', 'Ingresa un correo electrónico válido');
            return;
        }

        // Validate password strength
        if (password.length < 8) {
            Alert.alert('Contraseña débil', 'La contraseña debe tener al menos 8 caracteres');
            return;
        }

        if (!isLogin && !fullName) {
            Alert.alert('Error', 'Por favor ingresa tu nombre');
            return;
        }

        // Sanitize full name (remove extra spaces, limit length)
        const sanitizedName = fullName.trim().substring(0, 100);

        setLoading(true);

        try {
            if (isLogin) {
                const { error } = await signIn(email, password);
                if (error) {
                    Alert.alert('No se pudo iniciar sesión', error.message);
                }
            } else {
                const { error } = await signUp(email.trim(), password, sanitizedName);
                if (error) {
                    Alert.alert('No se pudo crear la cuenta', error.message);
                } else {
                    Alert.alert(
                        '¡Listo!',
                        'Revisa tu correo para verificar tu cuenta.',
                        [{ text: 'OK', onPress: () => setIsLogin(true) }]
                    );
                }
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.header}>
                        <Text style={styles.logo}>🍎</Text>
                        <Text style={styles.title}>Kaloriez</Text>
                        <Text style={styles.subtitle}>
                            {isLogin ? '¡Qué bueno verte de nuevo!' : 'Crea tu cuenta'}
                        </Text>
                    </View>

                    <View style={styles.form}>
                        {!isLogin && (
                            <View style={styles.inputContainer}>
                                <Text style={styles.label}>Nombre completo</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Juan Pérez"
                                    placeholderTextColor={colors.textDimmed}
                                    value={fullName}
                                    onChangeText={setFullName}
                                    autoCapitalize="words"
                                    editable={!loading}
                                />
                            </View>
                        )}

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Correo</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="you@example.com"
                                placeholderTextColor={colors.textDimmed}
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                                autoComplete="email"
                                editable={!loading}
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Contraseña</Text>
                            <View style={styles.passwordContainer}>
                                <TextInput
                                    style={styles.passwordInput}
                                    placeholder="••••••••"
                                    placeholderTextColor={colors.textDimmed}
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry={!showPassword}
                                    autoCapitalize="none"
                                    autoComplete="password"
                                    editable={!loading}
                                />
                                <Pressable
                                    style={styles.eyeButton}
                                    onPress={() => setShowPassword(!showPassword)}
                                >
                                    <Ionicons
                                        name={showPassword ? 'eye-off' : 'eye'}
                                        size={20}
                                        color={colors.textDimmed}
                                    />
                                </Pressable>
                            </View>
                        </View>

                        <Pressable
                            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                            onPress={handleSubmit}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.submitText}>
                                    {isLogin ? 'Iniciar sesión' : 'Crear cuenta'}
                                </Text>
                            )}
                        </Pressable>

                        <Pressable
                            style={styles.switchButton}
                            onPress={() => setIsLogin(!isLogin)}
                            disabled={loading}
                        >
                            <Text style={styles.switchText}>
                                {isLogin
                                    ? '¿No tienes cuenta? '
                                    : '¿Ya tienes cuenta? '}
                                <Text style={styles.switchTextBold}>
                                    {isLogin ? 'Crear cuenta' : 'Iniciar sesión'}
                                </Text>
                            </Text>
                        </Pressable>
                    </View>
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
        flexGrow: 1,
        justifyContent: 'center',
        padding: 24,
    },
    header: {
        alignItems: 'center',
        marginBottom: 48,
    },
    logo: {
        fontSize: 64,
        marginBottom: 16,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: colors.textPrimary,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: colors.textSecondary,
    },
    form: {
        gap: 16,
    },
    inputContainer: {
        gap: 8,
    },
    label: {
        fontSize: 15,
        fontWeight: '400',
        color: colors.textPrimary,
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
    passwordContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.cardBackground,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        borderRadius: 12,
    },
    passwordInput: {
        flex: 1,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        color: colors.textPrimary,
    },
    eyeButton: {
        padding: 12,
    },
    submitButton: {
        backgroundColor: colors.accent,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 8,
    },
    submitButtonDisabled: {
        opacity: 0.6,
    },
    submitText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    switchButton: {
        alignItems: 'center',
        marginTop: 16,
    },
    switchText: {
        fontSize: 15,
        color: colors.textSecondary,
    },
    switchTextBold: {
        fontWeight: '400',
        color: colors.accent,
    },
});
