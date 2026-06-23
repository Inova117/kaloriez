import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    Pressable,
    Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors } from '../theme/colors';
import { FoodEntry, MealType, MEAL_CONFIGS } from '../types';

interface FoodMenuProps {
    visible: boolean;
    entry: FoodEntry | null;
    onEdit: () => void;
    onDelete: () => void;
    onToggleFavorite: () => void;
    onMoveTo: (mealType: MealType) => void;
    onClose: () => void;
}

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snacks'];

export function FoodMenu({
    visible,
    entry,
    onEdit,
    onDelete,
    onToggleFavorite,
    onMoveTo,
    onClose,
}: FoodMenuProps) {
    const slideAnim = React.useRef(new Animated.Value(400)).current;
    const backdropAnim = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(slideAnim, {
                    toValue: 0,
                    damping: 26,
                    stiffness: 320,
                    useNativeDriver: true,
                }),
                Animated.timing(backdropAnim, {
                    toValue: 1,
                    duration: 220,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.spring(slideAnim, {
                    toValue: 400,
                    damping: 26,
                    stiffness: 320,
                    useNativeDriver: true,
                }),
                Animated.timing(backdropAnim, {
                    toValue: 0,
                    duration: 180,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [visible]);

    if (!entry) return null;

    const handleMoveTo = (mealType: MealType) => {
        Haptics.selectionAsync();
        onClose();
        requestAnimationFrame(() => onMoveTo(mealType));
    };

    return (
        <Modal transparent visible={visible} onRequestClose={onClose} animationType="none">
            <Pressable style={styles.backdrop} onPress={onClose}>
                <Animated.View style={[styles.backdropOverlay, { opacity: backdropAnim }]} />
            </Pressable>

            <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
                <View style={styles.grabber} />
                <Text style={styles.title} numberOfLines={1}>{entry.name}</Text>

                {/* Primary actions */}
                <View style={styles.group}>
                    <Pressable
                        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                        onPress={onEdit}
                        accessibilityRole="button"
                        accessibilityLabel="Editar"
                    >
                        <Ionicons name="create-outline" size={20} color={colors.textSecondary} style={styles.leading} />
                        <Text style={styles.rowText}>Editar</Text>
                    </Pressable>
                    <View style={styles.hairline} />
                    <Pressable
                        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                        onPress={onToggleFavorite}
                        accessibilityRole="button"
                        accessibilityLabel={entry.isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                    >
                        <Ionicons
                            name={entry.isFavorite ? 'heart' : 'heart-outline'}
                            size={20}
                            color={entry.isFavorite ? colors.accent : colors.textSecondary}
                            style={styles.leading}
                        />
                        <Text style={styles.rowText}>
                            {entry.isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                        </Text>
                    </Pressable>
                </View>

                {/* Move to */}
                <Text style={styles.sectionLabel}>MOVER A</Text>
                <View style={styles.group}>
                    {MEAL_TYPES.map((mealType, i) => {
                        const config = MEAL_CONFIGS[mealType];
                        const isCurrent = entry.mealType === mealType;
                        return (
                            <React.Fragment key={mealType}>
                                {i > 0 && <View style={styles.hairline} />}
                                <Pressable
                                    style={({ pressed }) => [styles.row, pressed && !isCurrent && styles.rowPressed]}
                                    onPress={() => handleMoveTo(mealType)}
                                    disabled={isCurrent}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Mover a ${config.label}`}
                                >
                                    <View style={styles.leading}>
                                        <View style={[styles.dot, { backgroundColor: config.color }]} />
                                    </View>
                                    <Text style={[styles.rowText, isCurrent && styles.rowTextMuted]}>
                                        {config.label}
                                    </Text>
                                    {isCurrent && (
                                        <Ionicons name="checkmark" size={18} color={colors.accent} />
                                    )}
                                </Pressable>
                            </React.Fragment>
                        );
                    })}
                </View>

                {/* Delete */}
                <View style={styles.group}>
                    <Pressable
                        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                        onPress={onDelete}
                        accessibilityRole="button"
                        accessibilityLabel="Eliminar"
                    >
                        <Ionicons name="trash-outline" size={20} color={colors.error} style={styles.leading} />
                        <Text style={[styles.rowText, styles.deleteText]}>Eliminar</Text>
                    </Pressable>
                </View>

                {/* Cancel */}
                <Pressable
                    style={({ pressed }) => [styles.cancelBtn, pressed && styles.rowPressed]}
                    onPress={onClose}
                    accessibilityRole="button"
                    accessibilityLabel="Cancelar"
                >
                    <Text style={styles.cancelText}>Cancelar</Text>
                </Pressable>
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
    },
    backdropOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(20, 24, 22, 0.45)',
    },
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 12,
        paddingBottom: 36,
    },
    grabber: {
        alignSelf: 'center',
        width: 38,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.ghostBorderHover,
        marginBottom: 12,
    },
    title: {
        textAlign: 'center',
        fontSize: 13,
        color: colors.textMuted,
        marginBottom: 14,
        paddingHorizontal: 16,
    },
    group: {
        backgroundColor: colors.cardBackground,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        overflow: 'hidden',
        marginBottom: 10,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        paddingHorizontal: 16,
    },
    rowPressed: {
        backgroundColor: colors.accentSubtle,
    },
    leading: {
        width: 22,
        alignItems: 'center',
        marginRight: 14,
    },
    rowText: {
        flex: 1,
        fontSize: 16,
        color: colors.textPrimary,
        fontWeight: '400',
    },
    rowTextMuted: {
        color: colors.textMuted,
    },
    deleteText: {
        color: colors.error,
    },
    dot: {
        width: 11,
        height: 11,
        borderRadius: 6,
    },
    hairline: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: colors.cardBorder,
        marginLeft: 52,
    },
    sectionLabel: {
        fontSize: 11,
        color: colors.textMuted,
        letterSpacing: 0.8,
        marginLeft: 16,
        marginBottom: 8,
    },
    cancelBtn: {
        backgroundColor: colors.cardBackground,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 2,
    },
    cancelText: {
        fontSize: 16,
        fontWeight: '500',
        color: colors.textPrimary,
    },
});
