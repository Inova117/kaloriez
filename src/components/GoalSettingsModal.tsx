import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    Pressable,
    TextInput,
    Animated
} from 'react-native';
import { colors } from '../theme/colors';

interface GoalSettingsModalProps {
    visible: boolean;
    currentGoal: number;
    onSave: (newGoal: number) => void;
    onClose: () => void;
}

const PRESETS = [1800, 2000, 2200, 2500, 3000];

export function GoalSettingsModal({ visible, currentGoal, onSave, onClose }: GoalSettingsModalProps) {
    const [selected, setSelected] = useState<number | null>(null);
    const [customValue, setCustomValue] = useState('');
    const fadeAnim = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        if (visible) {
            setSelected(PRESETS.includes(currentGoal) ? currentGoal : null);
            setCustomValue(PRESETS.includes(currentGoal) ? '' : currentGoal.toString());
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }).start();
        }
    }, [visible, currentGoal]);

    const handleSave = () => {
        const goalToSave = selected || parseInt(customValue) || currentGoal;
        if (goalToSave > 0 && goalToSave <= 10000) {
            onSave(goalToSave);
            onClose();
        }
    };

    const handlePresetPress = (preset: number) => {
        setSelected(preset);
        setCustomValue('');
    };

    const handleCustomChange = (text: string) => {
        setCustomValue(text.replace(/[^0-9]/g, ''));
        setSelected(null);
    };

    if (!visible) return null;

    return (
        <Modal
            transparent
            visible={visible}
            onRequestClose={onClose}
            animationType="none"
        >
            <Pressable style={styles.backdrop} onPress={onClose}>
                <Animated.View style={[styles.backdropOverlay, { opacity: fadeAnim }]} />
            </Pressable>

            <Animated.View style={[styles.modalContainer, { opacity: fadeAnim }]}>
                <View style={styles.content}>
                    <Text style={styles.title}>Daily Calorie Goal</Text>

                    <View style={styles.presetsContainer}>
                        {PRESETS.map((preset) => (
                            <Pressable
                                key={preset}
                                style={[
                                    styles.presetChip,
                                    selected === preset && styles.presetChipActive
                                ]}
                                onPress={() => handlePresetPress(preset)}
                            >
                                <Text style={[
                                    styles.presetText,
                                    selected === preset && styles.presetTextActive
                                ]}>
                                    {preset}
                                </Text>
                            </Pressable>
                        ))}
                    </View>

                    <Text style={styles.orText}>Or enter manually</Text>

                    <TextInput
                        style={styles.input}
                        value={customValue}
                        onChangeText={handleCustomChange}
                        placeholder="Enter calories"
                        placeholderTextColor={colors.textDimmed}
                        keyboardType="number-pad"
                        maxLength={5}
                        selectionColor={colors.accent}
                    />

                    <View style={styles.buttons}>
                        <Pressable style={styles.button} onPress={onClose}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </Pressable>
                        <View style={styles.buttonDivider} />
                        <Pressable style={styles.button} onPress={handleSave}>
                            <Text style={styles.saveText}>Save</Text>
                        </Pressable>
                    </View>
                </View>
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backdropOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
    },
    modalContainer: {
        position: 'absolute',
        width: '85%',
        maxWidth: 340,
        alignSelf: 'center',
        top: '30%',
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: colors.cardBackground,
        borderWidth: 1,
        borderColor: colors.cardBorder,
    },
    content: {
        padding: 24,
    },
    title: {
        fontSize: 20,
        fontWeight: '600',
        color: colors.textPrimary,
        textAlign: 'center',
        marginBottom: 24,
    },
    presetsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 20,
    },
    presetChip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: colors.ghostBorder,
    },
    presetChipActive: {
        backgroundColor: colors.accent,
        borderColor: colors.accent,
    },
    presetText: {
        fontSize: 15,
        fontWeight: '500',
        color: colors.textPrimary,
    },
    presetTextActive: {
        color: '#FFFFFF', // High contrast on Liac
    },
    orText: {
        fontSize: 13,
        color: colors.textMuted,
        textAlign: 'center',
        marginBottom: 12,
    },
    input: {
        fontSize: 18,
        color: colors.textPrimary,
        backgroundColor: colors.inputBackground,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 10,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        textAlign: 'center',
    },
    buttons: {
        flexDirection: 'row',
        borderTopWidth: 0.5,
        borderTopColor: colors.ghostBorder,
        marginHorizontal: -24,
        marginBottom: -24,
    },
    button: {
        flex: 1,
        paddingVertical: 16,
        alignItems: 'center',
    },
    buttonDivider: {
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
