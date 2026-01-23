import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    Pressable,
    TextInput,
    Animated,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { FoodEntry } from '../types';

interface EditFoodModalProps {
    visible: boolean;
    entry: FoodEntry | null;
    onSave: (newName: string) => void;
    onClose: () => void;
}

export function EditFoodModal({ visible, entry, onSave, onClose }: EditFoodModalProps) {
    const [text, setText] = useState('');
    const fadeAnim = React.useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible && entry) {
            setText(entry.name);
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }).start();
        } else {
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
            }).start();
        }
    }, [visible, entry]);

    const handleSave = () => {
        if (text.trim().length > 0) {
            onSave(text.trim());
            onClose();
        }
    };

    if (!visible) return null;

    return (
        <Modal
            transparent
            visible={visible}
            onRequestClose={onClose}
            animationType="none"
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <Pressable
                    style={styles.backdrop}
                    onPress={onClose}
                >
                    <Animated.View style={[styles.backdropOverlay, { opacity: fadeAnim }]} />
                </Pressable>

                <Animated.View style={[styles.modalContainer, { opacity: fadeAnim }]}>
                    <View style={styles.content}>
                        <Text style={styles.title}>Edit Food</Text>

                        <TextInput
                            style={styles.input}
                            value={text}
                            onChangeText={setText}
                            placeholder="Food name"
                            placeholderTextColor={colors.textDimmed}
                            autoFocus
                            onSubmitEditing={handleSave}
                            selectionColor={colors.accent}
                        />

                        <View style={styles.buttons}>
                            <Pressable style={styles.button} onPress={onClose}>
                                <Text style={styles.cancelText}>Cancel</Text>
                            </Pressable>
                            <View style={styles.divider} />
                            <Pressable style={styles.button} onPress={handleSave}>
                                <Text style={styles.saveText}>Save</Text>
                            </Pressable>
                        </View>
                    </View>
                </Animated.View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    keyboardView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    backdropOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
    },
    modalContainer: {
        width: '85%',
        maxWidth: 340,
        borderRadius: 14,
        overflow: 'hidden',
        backgroundColor: colors.cardBackground,
        borderWidth: 1,
        borderColor: colors.cardBorder,
    },
    content: {
        paddingTop: 20,
    },
    title: {
        fontSize: 17,
        fontWeight: '600',
        color: colors.textPrimary,
        textAlign: 'center',
        marginBottom: 16,
    },
    input: {
        fontSize: 16,
        color: colors.textPrimary,
        backgroundColor: colors.inputBackground, // Use theme gray
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginHorizontal: 16,
        borderRadius: 8,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: colors.cardBorder,
    },
    buttons: {
        flexDirection: 'row',
        borderTopWidth: 0.5,
        borderTopColor: colors.ghostBorder,
    },
    button: {
        flex: 1,
        paddingVertical: 14,
        alignItems: 'center',
    },
    divider: {
        width: 0.5,
        backgroundColor: colors.ghostBorder,
    },
    cancelText: {
        fontSize: 17,
        color: colors.accent,
    },
    saveText: {
        fontSize: 17,
        fontWeight: '600',
        color: colors.accent,
    },
});
