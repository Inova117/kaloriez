import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Pressable,
    Alert,
    Modal,
    TextInput,
    Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { colors } from '../theme/colors';
import { QuickAddItem } from '../types';
import { useAuth } from '../contexts/AuthContext';
import {
    fetchFavorites,
    addFavorite,
    updateFavorite,
    removeFavorite,
    Favorite,
} from '../services/favoritesRepository';

interface FavoritesScreenProps {
    onAddToToday: (item: QuickAddItem) => void;
}

export function FavoritesScreen({ onAddToToday }: FavoritesScreenProps) {
    const { user } = useAuth();
    const [favorites, setFavorites] = useState<Favorite[]>([]);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [menuVisible, setMenuVisible] = useState(false);
    const [selectedFavorite, setSelectedFavorite] = useState<Favorite | null>(null);
    const [editName, setEditName] = useState('');
    const [editCalories, setEditCalories] = useState('');

    useEffect(() => {
        if (user) fetchFavorites(user.id).then(setFavorites);
    }, [user?.id]);

    const handleAddNew = () => {
        setSelectedFavorite(null);
        setEditName('');
        setEditCalories('');
        setEditModalVisible(true);
    };

    const handleEdit = (item: Favorite) => {
        setSelectedFavorite(item);
        setEditName(item.name);
        setEditCalories(item.calories.toString());
        setEditModalVisible(true);
    };

    const handleSaveEdit = async () => {
        if (!user) return;
        const trimmedName = editName.trim();
        const parsedCalories = parseInt(editCalories, 10);

        if (!trimmedName || !(parsedCalories > 0)) {
            Alert.alert('Datos inválidos', 'Ingresa un nombre y calorías válidos.');
            return;
        }

        if (selectedFavorite) {
            const updated: Favorite = { ...selectedFavorite, name: trimmedName, calories: parsedCalories };
            setFavorites(prev => prev.map(f => (f.id === updated.id ? updated : f)));
            updateFavorite(user.id, updated);
        } else {
            const fav = await addFavorite(user.id, { name: trimmedName, calories: parsedCalories });
            setFavorites(prev => [fav, ...prev]);
        }

        setEditModalVisible(false);
        if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const handleLongPress = (item: Favorite) => {
        setSelectedFavorite(item);
        setMenuVisible(true);
        if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    };

    const handleEditOption = () => {
        setMenuVisible(false);
        if (selectedFavorite) handleEdit(selectedFavorite);
    };

    const handleDeleteOption = () => {
        setMenuVisible(false);
        if (!selectedFavorite) return;
        Alert.alert('Eliminar favorito', `¿Quitar "${selectedFavorite.name}"?`, [
            { text: 'Cancelar', style: 'cancel' },
            {
                text: 'Eliminar',
                style: 'destructive',
                onPress: () => {
                    setFavorites(prev => prev.filter(f => f.id !== selectedFavorite.id));
                    removeFavorite(selectedFavorite.id);
                    if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }
            }
        ]);
    };

    const handleAddToToday = (item: Favorite) => {
        onAddToToday({ id: item.id, name: item.name, emoji: '', calories: item.calories });
        if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const renderFavorite = ({ item }: { item: Favorite }) => (
        <Pressable
            style={styles.favoriteCard}
            onPress={() => handleAddToToday(item)}
            onLongPress={() => handleLongPress(item)}
            accessibilityRole="button"
            accessibilityLabel={`Agregar ${item.name}, ${item.calories} kilocalorías`}
        >
            <View style={styles.info}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.calories}>{item.calories} kcal</Text>
            </View>
        </Pressable>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <Text style={styles.title}>Favoritos</Text>
                <Pressable style={styles.addButton} onPress={handleAddNew}>
                    <Text style={styles.addButtonText}>Agregar</Text>
                </Pressable>
            </View>

            {favorites.length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>Aún no hay favoritos</Text>
                    <Text style={styles.emptySubtext}>
                        Agrega tus comidas frecuentes para registrarlas al instante
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={favorites}
                    renderItem={renderFavorite}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.list}
                />
            )}

            <Modal
                visible={menuVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setMenuVisible(false)}
            >
                <Pressable style={styles.menuBackdrop} onPress={() => setMenuVisible(false)}>
                    <View style={styles.menuContainer}>
                        <Pressable style={styles.menuOption} onPress={handleEditOption}>
                            <Text style={styles.menuText}>Editar</Text>
                        </Pressable>
                        <View style={styles.menuDivider} />
                        <Pressable style={styles.menuOption} onPress={handleDeleteOption}>
                            <Text style={[styles.menuText, styles.menuTextDanger]}>Eliminar</Text>
                        </Pressable>
                    </View>
                </Pressable>
            </Modal>

            <Modal
                visible={editModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setEditModalVisible(false)}
            >
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>
                            {selectedFavorite ? 'Editar favorito' : 'Agregar favorito'}
                        </Text>

                        <TextInput
                            style={styles.input}
                            value={editName}
                            onChangeText={setEditName}
                            placeholder="Nombre"
                            placeholderTextColor={colors.textDimmed}
                            autoFocus={!selectedFavorite}
                        />

                        <TextInput
                            style={styles.input}
                            value={editCalories}
                            onChangeText={setEditCalories}
                            placeholder="Calorías"
                            placeholderTextColor={colors.textDimmed}
                            keyboardType="numeric"
                        />

                        <View style={styles.modalButtons}>
                            <Pressable
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => setEditModalVisible(false)}
                            >
                                <Text style={styles.cancelButtonText}>Cancelar</Text>
                            </Pressable>
                            <Pressable
                                style={[styles.modalButton, styles.saveButton]}
                                onPress={handleSaveEdit}
                            >
                                <Text style={styles.saveButtonText}>Guardar</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.cardBorder,
    },
    title: {
        fontSize: 28,
        fontWeight: '400',
        color: colors.textPrimary,
    },
    addButton: {
        paddingVertical: 6,
        paddingHorizontal: 12,
    },
    addButtonText: {
        fontSize: 16,
        fontWeight: '400',
        color: colors.accent,
    },
    list: {
        padding: 16,
    },
    favoriteCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.cardBackground,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.cardBorder,
    },
    info: {
        flex: 1,
    },
    name: {
        fontSize: 16,
        fontWeight: '400',
        color: colors.textPrimary,
        marginBottom: 4,
    },
    calories: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    emptyText: {
        fontSize: 20,
        fontWeight: '400',
        color: colors.textPrimary,
        marginBottom: 8,
    },
    emptySubtext: {
        fontSize: 15,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    menuBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    menuContainer: {
        backgroundColor: colors.cardBackground,
        borderRadius: 12,
        overflow: 'hidden',
        minWidth: 200,
        borderWidth: 1,
        borderColor: colors.cardBorder,
    },
    menuOption: {
        paddingVertical: 16,
        paddingHorizontal: 20,
        alignItems: 'center',
    },
    menuText: {
        fontSize: 16,
        fontWeight: '400',
        color: colors.textPrimary,
    },
    menuTextDanger: {
        color: colors.error,
    },
    menuDivider: {
        height: 1,
        backgroundColor: colors.cardBorder,
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '85%',
        maxWidth: 340,
        backgroundColor: colors.cardBackground,
        borderRadius: 14,
        padding: 20,
        borderWidth: 1,
        borderColor: colors.cardBorder,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '400',
        color: colors.textPrimary,
        marginBottom: 20,
        textAlign: 'center',
    },
    input: {
        backgroundColor: colors.inputBackground,
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: colors.textPrimary,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.cardBorder,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    modalButton: {
        flex: 1,
        padding: 14,
        borderRadius: 8,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: colors.inputBackground,
    },
    saveButton: {
        backgroundColor: colors.accent,
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '400',
        color: colors.textPrimary,
    },
    saveButtonText: {
        fontSize: 16,
        fontWeight: '400',
        color: '#FFFFFF',
    },
});
