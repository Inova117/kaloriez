import React, { useState, useCallback, useRef } from 'react';
import { View, TextInput, StyleSheet, Pressable, Keyboard, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { ProcessingState } from '../types';

interface InputBarProps {
    onSubmit: (text: string) => void;
    processingState: ProcessingState;
}

export function InputBar({ onSubmit, processingState }: InputBarProps) {
    const [text, setText] = useState('');
    const inputRef = useRef<TextInput>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const buttonScale = useRef(new Animated.Value(1)).current;
    const buttonRotation = useRef(new Animated.Value(0)).current;

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

    const isProcessing = processingState === 'processing';
    const hasText = text.trim().length > 0;

    return (
        <View style={styles.floatingContainer}>
            <View style={styles.container}>
                <View style={styles.inputWrapper}>
                    <TextInput
                        ref={inputRef}
                        style={styles.input}
                        placeholder="Add food..."
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
                        <Pressable
                            style={[styles.sendButton, hasText && styles.sendButtonActive]}
                            onPress={handleButtonPress}
                            disabled={isProcessing}
                        >
                            <Ionicons
                                name="arrow-up"
                                size={18}
                                color={hasText ? colors.textInverse : colors.textDimmed}
                            />
                        </Pressable>
                    </Animated.View>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    floatingContainer: {
        position: 'absolute',
        bottom: 24,
        left: 16,
        right: 16,
    },
    container: {
        borderRadius: 28,
        backgroundColor: colors.inputBackground,
        borderWidth: 1,
        borderColor: colors.ghostBorder,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 28,
        paddingLeft: 20,
        paddingRight: 6,
        paddingVertical: 6,
    },
    input: {
        flex: 1,
        ...typography.inputText,
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
        backgroundColor: colors.accent, // Red send button
    },
});
