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

interface GoalSettingsModalProps {
    visible: boolean;
    currentGoal: number;
    onSave: (newGoal: number) => void;
    onClose: () => void;
}

export function GoalSettingsModal({ visible, currentGoal, onSave, onClose }: GoalSettingsModalProps) {
    const [goalText, setGoalText] = useState('');
    const fadeAnim = React.useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            setGoalText(currentGoal.toString());
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
    }, [visible, currentGoal]);

    const handleSave = () => {
        const newGoal = parseInt(goalText);
        if (newGoal > 0) {
            onSave(newGoal);
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
                        <Text style={styles.title}>Meta diaria de calorías</Text>

                        <TextInput
                            style={styles.input}
                            value={goalText}
                            onChangeText={setGoalText}
                            placeholder="Calorías"
                            placeholderTextColor={colors.textDimmed}
                            keyboardType="numeric"
                            autoFocus
                            onSubmitEditing={handleSave}
                            selectionColor={colors.accent}
                        />

                        <View style={styles.buttons}>
                            <Pressable style={styles.button} onPress={onClose}>
                                <Text style={styles.cancelText}>Cancelar</Text>
                            </Pressable>
                            <View style={styles.divider} />
                            <Pressable style={styles.button} onPress={handleSave}>
                                <Text style={styles.saveText}>Guardar</Text>
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
        fontWeight: '400',
        color: colors.textPrimary,
        textAlign: 'center',
        marginBottom: 16,
    },
    input: {
        fontSize: 16,
        color: colors.textPrimary,
        backgroundColor: colors.inputBackground,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginHorizontal: 16,
        borderRadius: 8,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        textAlign: 'center',
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
        fontWeight: '400',
        color: colors.accent,
    },
});
