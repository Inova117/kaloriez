import React, { useState, useEffect, useRef } from 'react';
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
    onSave: (newName: string, newCalories: number, newGrams?: number) => void;
    onClose: () => void;
}

export function EditFoodModal({ visible, entry, onSave, onClose }: EditFoodModalProps) {
    const [text, setText] = useState('');
    const [calories, setCalories] = useState('');
    const [grams, setGrams] = useState('');
    // kcal per gram, so editing grams can recompute calories. null = unknown.
    const densityRef = useRef<number | null>(null);
    const fadeAnim = React.useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible && entry) {
            setText(entry.name);
            setCalories(entry.calories.toString());
            setGrams(entry.portionGrams ? String(entry.portionGrams) : '');
            densityRef.current =
                entry.portionGrams && entry.portionGrams > 0 && entry.calories > 0
                    ? entry.calories / entry.portionGrams
                    : null;
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

    // Editing grams recomputes calories when we know the density.
    const handleGramsChange = (g: string) => {
        setGrams(g);
        const gv = parseFloat(g);
        if (densityRef.current != null && Number.isFinite(gv) && gv > 0) {
            setCalories(String(Math.round(densityRef.current * gv)));
        }
    };

    // Editing calories directly is authoritative; refresh density if grams known.
    const handleCaloriesChange = (c: string) => {
        setCalories(c);
        const cv = parseInt(c, 10);
        const gv = parseFloat(grams);
        if (Number.isFinite(cv) && cv > 0 && Number.isFinite(gv) && gv > 0) {
            densityRef.current = cv / gv;
        }
    };

    const handleSave = () => {
        const trimmedName = text.trim();
        const parsedCalories = parseInt(calories, 10);
        const gv = parseFloat(grams);
        const parsedGrams = Number.isFinite(gv) && gv > 0 ? gv : undefined;

        if (trimmedName.length > 0 && parsedCalories > 0) {
            onSave(trimmedName, parsedCalories, parsedGrams);
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
                        <Text style={styles.title}>Editar comida</Text>

                        <TextInput
                            style={styles.input}
                            value={text}
                            onChangeText={setText}
                            placeholder="Nombre"
                            placeholderTextColor={colors.textDimmed}
                            autoFocus
                            selectionColor={colors.accent}
                        />

                        <View style={styles.fieldRow}>
                            <TextInput
                                style={[styles.input, styles.fieldHalf]}
                                value={grams}
                                onChangeText={handleGramsChange}
                                placeholder="Gramos"
                                placeholderTextColor={colors.textDimmed}
                                keyboardType="numeric"
                                selectionColor={colors.accent}
                            />
                            <TextInput
                                style={[styles.input, styles.fieldHalf]}
                                value={calories}
                                onChangeText={handleCaloriesChange}
                                placeholder="Calorías"
                                placeholderTextColor={colors.textDimmed}
                                keyboardType="numeric"
                                onSubmitEditing={handleSave}
                                selectionColor={colors.accent}
                            />
                        </View>

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
        backgroundColor: colors.inputBackground, // Use theme gray
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginHorizontal: 16,
        borderRadius: 8,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: colors.cardBorder,
    },
    fieldRow: {
        flexDirection: 'row',
        gap: 12,
        marginHorizontal: 16,
    },
    fieldHalf: {
        flex: 1,
        marginHorizontal: 0,
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
