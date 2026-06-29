import React, { useCallback, useRef, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    Pressable,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ConfirmHcaptcha from '@hcaptcha/react-native-hcaptcha';
import { useAuth } from '../contexts/AuthContext';
import { notify } from '../utils/notify';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { logger } from '../utils/logger';

// hCaptcha public site key. When unset/empty the entire CAPTCHA layer is a
// no-op: no widget renders and no token is sent, so signUp/signIn behave
// exactly as they did before (dev/Expo Go/builds without a key keep working).
// Enforcement is server-side in Supabase and is global, so only set this key in
// the same release that flips on Dashboard CAPTCHA protection.
const HCAPTCHA_SITE_KEY = process.env.EXPO_PUBLIC_HCAPTCHA_SITE_KEY || '';
const captchaEnabled = !!HCAPTCHA_SITE_KEY;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthScreen() {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [forgotMode, setForgotMode] = useState(false);

    const { signIn, signUp, resetPassword } = useAuth();

    // Imperative handle to the (invisible-until-shown) hCaptcha modal, plus a
    // resolver so handleSubmit can `await` the token coming back via onMessage.
    const captchaRef = useRef<ConfirmHcaptcha>(null);
    const captchaResolver = useRef<((token: string | null) => void) | null>(null);

    // Resolve the pending getCaptchaToken() promise once and hide the modal.
    const settleCaptcha = useCallback((token: string | null) => {
        captchaRef.current?.hide();
        const resolve = captchaResolver.current;
        captchaResolver.current = null;
        resolve?.(token);
    }, []);

    // @hcaptcha/react-native-hcaptcha delivers EVERYTHING through nativeEvent.data:
    // either a lifecycle string or the verification token itself (there is no
    // event.success flag). So anything that isn't a known lifecycle event IS the
    // token. 'open' just means the challenge became visible — keep waiting.
    const onCaptchaMessage = useCallback((event: any) => {
        const data = event?.nativeEvent?.data;
        if (!data || data === 'open') return;
        if (['cancel', 'error', 'expired', 'closed', 'challenge-closed', 'challenge-expired'].includes(data)) {
            if (data === 'error') logger.error('hCaptcha error', data);
            settleCaptcha(null);
            return;
        }
        settleCaptcha(data); // the single-use verification token
    }, [settleCaptcha]);

    // Returns a fresh single-use token, or null if disabled/cancelled/failed.
    // A 60s timeout guards against onMessage never firing (which would otherwise
    // hang the submit forever).
    const getCaptchaToken = useCallback((): Promise<string | null> => {
        if (!captchaEnabled) return Promise.resolve(null);
        return new Promise<string | null>((resolve) => {
            const timeout = setTimeout(() => settleCaptcha(null), 60000);
            captchaResolver.current = (token) => {
                clearTimeout(timeout);
                resolve(token);
            };
            captchaRef.current?.show();
        });
    }, [settleCaptcha]);

    // Forgot-password mode: send the recovery email (CAPTCHA-gated like sign-in).
    const handleForgot = async () => {
        if (!email || !EMAIL_REGEX.test(email.trim())) {
            notify('Correo inválido', 'Ingresa un correo electrónico válido');
            return;
        }
        setLoading(true);
        try {
            let captchaToken: string | undefined;
            if (captchaEnabled) {
                const token = await getCaptchaToken();
                if (!token) {
                    notify('Verificación requerida', 'Completa la verificación para continuar.');
                    return;
                }
                captchaToken = token;
            }
            const { error } = await resetPassword(email.trim(), captchaToken);
            if (error) {
                notify('No se pudo enviar', error.message);
            } else {
                notify('Revisa tu correo', 'Te enviamos un enlace para restablecer tu contraseña.');
                setForgotMode(false);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (forgotMode) return handleForgot();

        // Validate email and password
        if (!email || !password) {
            notify('Error', 'Por favor llena todos los campos');
            return;
        }

        // Validate email format
        if (!EMAIL_REGEX.test(email.trim())) {
            notify('Correo inválido', 'Ingresa un correo electrónico válido');
            return;
        }

        // Validate password strength
        if (password.length < 8) {
            notify('Contraseña débil', 'La contraseña debe tener al menos 8 caracteres');
            return;
        }

        if (!isLogin && !fullName) {
            notify('Error', 'Por favor ingresa tu nombre');
            return;
        }

        // Sanitize full name (remove extra spaces, limit length)
        const sanitizedName = fullName.trim().substring(0, 100);

        setLoading(true);

        try {
            // Obtain a fresh CAPTCHA token only when a site key is configured.
            // Tokens are single-use, so we request one immediately before submit.
            let captchaToken: string | undefined;
            if (captchaEnabled) {
                const token = await getCaptchaToken();
                if (!token) {
                    notify('Verificación requerida', 'Completa la verificación para continuar.');
                    return;
                }
                captchaToken = token;
            }

            if (isLogin) {
                const { error } = await signIn(email, password, captchaToken);
                if (error) {
                    notify('No se pudo iniciar sesión', error.message);
                }
            } else {
                const { error } = await signUp(email.trim(), password, sanitizedName, captchaToken);
                if (error) {
                    notify('No se pudo crear la cuenta', error.message);
                } else {
                    // If email confirmation is ON, there's no session yet — guide
                    // the user. If it's OFF, the auth listener logs them straight in.
                    notify('¡Listo!', 'Si te pedimos verificación, revisa tu correo. Si no, ya puedes iniciar sesión.');
                    setIsLogin(true);
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
                            {forgotMode
                                ? 'Te enviaremos un enlace para restablecer tu contraseña'
                                : isLogin ? '¡Qué bueno verte de nuevo!' : 'Crea tu cuenta'}
                        </Text>
                    </View>

                    <View style={styles.form}>
                        {!isLogin && !forgotMode && (
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

                        {!forgotMode && (
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
                        )}

                        <Pressable
                            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                            onPress={handleSubmit}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.submitText}>
                                    {forgotMode ? 'Enviar enlace' : isLogin ? 'Iniciar sesión' : 'Crear cuenta'}
                                </Text>
                            )}
                        </Pressable>

                        {isLogin && !forgotMode && (
                            <Pressable
                                style={styles.forgotButton}
                                onPress={() => setForgotMode(true)}
                                disabled={loading}
                            >
                                <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
                            </Pressable>
                        )}

                        <Pressable
                            style={styles.switchButton}
                            onPress={() => (forgotMode ? setForgotMode(false) : setIsLogin(!isLogin))}
                            disabled={loading}
                        >
                            {forgotMode ? (
                                <Text style={styles.switchText}>
                                    <Text style={styles.switchTextBold}>Volver a iniciar sesión</Text>
                                </Text>
                            ) : (
                                <Text style={styles.switchText}>
                                    {isLogin
                                        ? '¿No tienes cuenta? '
                                        : '¿Ya tienes cuenta? '}
                                    <Text style={styles.switchTextBold}>
                                        {isLogin ? 'Crear cuenta' : 'Iniciar sesión'}
                                    </Text>
                                </Text>
                            )}
                        </Pressable>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Invisible until show() is called. Rendered only when a site key is
                configured, so the no-key path stays exactly as it was before. */}
            {captchaEnabled && (
                <ConfirmHcaptcha
                    ref={captchaRef}
                    siteKey={HCAPTCHA_SITE_KEY}
                    baseUrl="https://hcaptcha.com"
                    languageCode="es"
                    size="invisible"
                    onMessage={onCaptchaMessage}
                />
            )}
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
    forgotButton: {
        alignItems: 'center',
        marginTop: 4,
    },
    forgotText: {
        fontSize: 14,
        color: colors.accent,
    },
});
