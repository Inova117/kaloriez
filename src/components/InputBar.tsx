import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, TextInput, StyleSheet, Pressable, Keyboard, Animated, Platform, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { ProcessingState } from '../types';
import { logger } from '../utils/logger';

interface InputBarProps {
    onSubmit: (text: string) => void;
    onAudioRecorded?: (uri: string) => void;
    processingState: ProcessingState;
    focusTrigger?: number;
}

export function InputBar({ onSubmit, onAudioRecorded, processingState, focusTrigger }: InputBarProps) {
    const [text, setText] = useState('');
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const inputRef = useRef<TextInput>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const micScale = useRef(new Animated.Value(1)).current;
    const buttonScale = useRef(new Animated.Value(1)).current;
    const buttonRotation = useRef(new Animated.Value(0)).current;
    const loadingOpacity = useRef(new Animated.Value(0)).current;
    const micAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

    const isProcessing = processingState === 'processing';

    // Animate loading indicator
    useEffect(() => {
        if (isProcessing) {
            Animated.timing(loadingOpacity, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }).start();
        } else {
            Animated.timing(loadingOpacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }).start();
        }
    }, [isProcessing]);

    // Focus input when focusTrigger changes
    useEffect(() => {
        if (focusTrigger && focusTrigger > 0) {
            inputRef.current?.focus();
        }
    }, [focusTrigger]);

    // Cleanup animations on unmount
    useEffect(() => {
        return () => {
            if (micAnimationRef.current) {
                micAnimationRef.current.stop();
            }
        };
    }, []);

    const handleTextChange = useCallback((newText: string) => {
        setText(newText);

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }
    }, []);

    const handleSubmit = useCallback((submitText?: string) => {
        const textToSubmit = submitText || text;
        if (textToSubmit.trim().length === 0) return;

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        Keyboard.dismiss();
        onSubmit(textToSubmit.trim());
        setText('');
    }, [text, onSubmit]);

    const startRecording = async () => {
        try {
            const permission = await Audio.requestPermissionsAsync();
            if (permission.status !== 'granted') {
                Alert.alert(
                    'Permiso de micrófono',
                    'Activa el acceso al micrófono en los ajustes de tu dispositivo para usar la voz.',
                    [{ text: 'OK' }]
                );
                return;
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            // Animate mic pulsing
            micAnimationRef.current = Animated.loop(
                Animated.sequence([
                    Animated.timing(micScale, {
                        toValue: 1.2,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                    Animated.timing(micScale, {
                        toValue: 1,
                        duration: 800,
                        useNativeDriver: true,
                    })
                ])
            );
            micAnimationRef.current.start();

            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );

            setRecording(recording);
            setIsRecording(true);
        } catch (err) {
            logger.error('Failed to start recording', err);
        }
    };

    const stopRecording = async () => {
        setIsRecording(false);
        setRecording(null);
        if (micAnimationRef.current) {
            micAnimationRef.current.stop();
        }
        micScale.setValue(1);

        if (!recording) return;

        try {
            await recording.stopAndUnloadAsync();
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
            });

            const uri = recording.getURI();
            if (uri && onAudioRecorded) {
                if (Platform.OS === 'ios') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                onAudioRecorded(uri);
            }
        } catch (error) {
            logger.error('Failed to stop recording', error);
        }
    };

    const handleButtonPress = () => {
        Animated.sequence([
            Animated.parallel([
                Animated.spring(buttonScale, { toValue: 0.85, useNativeDriver: true }),
                Animated.spring(buttonRotation, { toValue: 15, useNativeDriver: true }),
            ]),
            Animated.parallel([
                Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true }),
                Animated.spring(buttonRotation, { toValue: 0, useNativeDriver: true }),
            ]),
        ]).start();

        if (text.trim().length > 0) {
            handleSubmit();
        }
    };

    const hasText = text.trim().length > 0;

    return (
        <View style={styles.floatingContainer}>
            <View style={styles.container}>
                <View style={styles.inputWrapper}>
                    <TextInput
                        ref={inputRef}
                        style={styles.input}
                        placeholder="Agregar comida..."
                        placeholderTextColor={colors.textDimmed}
                        value={text}
                        onChangeText={handleTextChange}
                        onSubmitEditing={() => handleSubmit()}
                        returnKeyType="done"
                        editable={!isProcessing}
                    />
                    <Animated.View
                        style={{
                            transform: [
                                { scale: buttonScale },
                                {
                                    rotate: buttonRotation.interpolate({
                                        inputRange: [0, 360],
                                        outputRange: ['0deg', '360deg']
                                    })
                                }
                            ]
                        }}
                    >
                        {!hasText && !isRecording ? (
                            <Pressable
                                style={styles.micButton}
                                onPressIn={startRecording}
                                onPressOut={stopRecording}
                                disabled={isProcessing}
                                accessibilityRole="button"
                                accessibilityLabel="Grabar por voz"
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <Ionicons
                                    name="mic"
                                    size={20}
                                    color={colors.textDimmed}
                                />
                            </Pressable>
                        ) : isRecording ? (
                            <Pressable
                                style={styles.micButtonActive}
                                onPressIn={startRecording}
                                onPressOut={stopRecording}
                                accessibilityRole="button"
                                accessibilityLabel="Detener grabación"
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <Animated.View style={{ transform: [{ scale: micScale }] }}>
                                    <View style={styles.stopSquare} />
                                </Animated.View>
                            </Pressable>
                        ) : isProcessing ? (
                            <View style={styles.loadingButton}>
                                <ActivityIndicator size="small" color={colors.accent} />
                            </View>
                        ) : (
                            <Pressable
                                style={[styles.sendButton, styles.sendButtonActive]}
                                onPress={handleButtonPress}
                                disabled={isProcessing}
                                accessibilityRole="button"
                                accessibilityLabel="Agregar comida"
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <Ionicons
                                    name="arrow-up"
                                    size={18}
                                    color={colors.textInverse}
                                />
                            </Pressable>
                        )}
                    </Animated.View>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    floatingContainer: {
        position: 'absolute',
        bottom: 16,
        left: 16,
        right: 16,
        zIndex: 1000,
    },
    container: {
        borderRadius: 24,
        backgroundColor: colors.cardBackground,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        shadowColor: colors.textPrimary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
        elevation: 8,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 28,
        paddingLeft: 20,
        paddingRight: 6,
        paddingVertical: 8,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: colors.textPrimary,
        paddingVertical: 10,
    },
    sendButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.textDimmed,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendButtonActive: {
        backgroundColor: colors.accent,
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    micButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
    },
    micButtonActive: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.accent + '15',
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stopSquare: {
        width: 12,
        height: 12,
        borderRadius: 3,
        backgroundColor: colors.accent,
    },
});
