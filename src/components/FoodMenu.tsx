import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    Pressable,
    Animated,
    ScrollView
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
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
    onClose
}: FoodMenuProps) {
    const slideAnim = React.useRef(new Animated.Value(300)).current;
    const backdropAnim = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(slideAnim, {
                    toValue: 0,
                    damping: 25,
                    stiffness: 400,
                    useNativeDriver: true,
                }),
                Animated.timing(backdropAnim, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.spring(slideAnim, {
                    toValue: 300,
                    damping: 25,
                    stiffness: 400,
                    useNativeDriver: true,
                }),
                Animated.timing(backdropAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [visible]);

    if (!entry) return null;

    const handleMoveTo = (mealType: MealType) => {
        // Immediate feedback
        Haptics.selectionAsync();

        // Close menu immediately
        onClose();

        // Perform expensive operation after menu closes
        requestAnimationFrame(() => {
            onMoveTo(mealType);
        });
    };

    return (
        <Modal
            transparent
            visible={visible}
            onRequestClose={onClose}
            animationType="none"
        >
            <Pressable
                style={styles.backdrop}
                onPress={onClose}
            >
                <Animated.View
                    style={[
                        styles.backdropOverlay,
                        { opacity: backdropAnim }
                    ]}
                />
            </Pressable>

            <Animated.View
                style={[
                    styles.menuContainer,
                    { transform: [{ translateY: slideAnim }] }
                ]}
            >
                <ScrollView style={styles.menu} bounces={false}>
                    <Text style={styles.menuTitle} numberOfLines={1}>{entry.name}</Text>
                    <View style={styles.divider} />

                    <Pressable style={styles.menuItem} onPress={onEdit}>
                        <Text style={styles.menuItemText}>Editar</Text>
                    </Pressable>

                    <Pressable style={styles.menuItem} onPress={onToggleFavorite}>
                        <Text style={styles.menuItemText}>
                            {entry.isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                        </Text>
                    </Pressable>

                    <View style={styles.sectionDivider}>
                        <Text style={styles.sectionLabel}>Mover a</Text>
                    </View>

                    {MEAL_TYPES.map((mealType) => {
                        const config = MEAL_CONFIGS[mealType];
                        const isCurrent = entry.mealType === mealType;
                        return (
                            <Pressable
                                key={mealType}
                                style={({ pressed }) => [
                                    styles.menuItem,
                                    pressed && { backgroundColor: 'rgba(255,255,255,0.1)' }
                                ]}
                                onPress={() => handleMoveTo(mealType)}
                                disabled={isCurrent}
                            >
                                <Text style={[
                                    styles.menuItemText,
                                    isCurrent && styles.currentMealText
                                ]}>
                                    {config.icon} {config.label}
                                    {isCurrent && ' ✓'}
                                </Text>
                            </Pressable>
                        );
                    })}

                    <View style={styles.spacer} />

                    <Pressable style={styles.menuItem} onPress={onDelete}>
                        <Text style={[styles.menuItemText, styles.deleteText]}>Eliminar</Text>
                    </Pressable>

                    <View style={styles.spacer} />

                    <Pressable style={styles.menuItem} onPress={onClose}>
                        <Text style={[styles.menuItemText, styles.cancelText]}>Cancelar</Text>
                    </Pressable>
                </ScrollView>
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdropOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    menuContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        maxHeight: '70%',
        paddingBottom: 34,
    },
    menu: {
        backgroundColor: colors.cardBackground,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        boxShadow: '0px -2px 8px rgba(0, 0, 0, 0.1)',
        elevation: 16,
    },
    menuTitle: {
        ...typography.foodName,
        textAlign: 'center',
        paddingVertical: 12,
        color: colors.textSecondary,
    },
    divider: {
        height: 1,
        backgroundColor: colors.cardBorder,
        marginBottom: 8,
    },
    menuItem: {
        paddingVertical: 16,
        alignItems: 'center',
    },
    menuItemText: {
        fontSize: 17,
        fontWeight: '400',
        color: colors.textPrimary,
    },
    deleteText: {
        color: colors.error,
    },
    cancelText: {
        fontWeight: '400',
    },
    sectionDivider: {
        paddingVertical: 12,
        alignItems: 'center',
    },
    sectionLabel: {
        fontSize: 13,
        color: colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    currentMealText: {
        color: colors.accent,
    },
    spacer: {
        height: 8,
        backgroundColor: colors.cardBorder,
        marginVertical: 8,
    },
});
