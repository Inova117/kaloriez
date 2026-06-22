import React, { useState, useEffect, useCallback } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { MealType, MEAL_CONFIGS } from '../types';
import { logger } from '../utils/logger';

const FAVORITES_STORAGE_KEY = '@favorite_items';

export interface FavoriteItem {
    id: string;
    name: string;
    calories: number;
    mealType: MealType;
    isCustom: boolean;
}

interface FavoritesScreenProps {
    onAddToToday: (item: FavoriteItem) => void;
}

export function FavoritesScreen({ onAddToToday }: FavoritesScreenProps) {
    const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [menuVisible, setMenuVisible] = useState(false);
    const [selectedFavorite, setSelectedFavorite] = useState<FavoriteItem | null>(null);
    const [editName, setEditName] = useState('');
    const [editCalories, setEditCalories] = useState('');

    useEffect(() => {
        loadFavorites();
    }, []);

    const loadFavorites = async () => {
        try {
            const stored = await AsyncStorage.getItem(FAVORITES_STORAGE_KEY);
            if (stored) {
                setFavorites(JSON.parse(stored));
            }
        } catch (error) {
            logger.error('Failed to load favorites', error);
        }
    };

    const saveFavorites = async (items: FavoriteItem[]) => {
        try {
            await AsyncStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(items));
            setFavorites(items);
        } catch (error) {
            logger.error('Failed to save favorites', error);
        }
    };

    const handleAddNew = () => {
        setSelectedFavorite(null);
        setEditName('');
        setEditCalories('');
        setEditModalVisible(true);
    };

    const handleEdit = (item: FavoriteItem) => {
        setSelectedFavorite(item);
        setEditName(item.name);
        setEditCalories(item.calories.toString());
        setEditModalVisible(true);
    };

    const handleSaveEdit = () => {
        const trimmedName = editName.trim();
        const parsedCalories = parseInt(editCalories);

        if (!trimmedName || parsedCalories <= 0) {
            Alert.alert('Invalid Input', 'Please enter a valid name and calories.');
            return;
        }

        if (selectedFavorite) {
            // Edit existing
            const updated = favorites.map(f =>
                f.id === selectedFavorite.id
                    ? { ...f, name: trimmedName, calories: parsedCalories }
                    : f
            );
            saveFavorites(updated);
        } else {
            // Add new
            const newFavorite: FavoriteItem = {
                id: Date.now().toString(),
                name: trimmedName,
                calories: parsedCalories,
                mealType: 'snacks',
                isCustom: true,
            };
            saveFavorites([...favorites, newFavorite]);
        }

        setEditModalVisible(false);
        if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const handleLongPress = (item: FavoriteItem) => {
        setSelectedFavorite(item);
        setMenuVisible(true);
        if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    };

    const handleEditOption = () => {
        setMenuVisible(false);
        if (selectedFavorite) {
            handleEdit(selectedFavorite);
        }
    };

    const handleDeleteOption = () => {
        setMenuVisible(false);
        if (!selectedFavorite) return;
        Alert.alert('Delete Favorite', `Remove "${selectedFavorite.name}"?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: () => {
                    saveFavorites(favorites.filter(f => f.id !== selectedFavorite.id));
                    if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }
            }
        ]);
    };

    const handleAddToToday = (item: FavoriteItem) => {
        onAddToToday(item);
        if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const renderFavorite = ({ item }: { item: FavoriteItem }) => (
        <Pressable
            style={styles.favoriteCard}
            onPress={() => handleAddToToday(item)}
            onLongPress={() => handleLongPress(item)}
        >
            <View style={styles.info}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.calories}>{item.calories} cal</Text>
            </View>
        </Pressable>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <Text style={styles.title}>Favorites</Text>
                <Pressable style={styles.addButton} onPress={handleAddNew}>
                    <Text style={styles.addButtonText}>Add</Text>
                </Pressable>
            </View>

            {favorites.length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>No favorites yet</Text>
                    <Text style={styles.emptySubtext}>
                        Add your frequently eaten foods for quick access
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
                <Pressable
                    style={styles.menuBackdrop}
                    onPress={() => setMenuVisible(false)}
                >
                    <View style={styles.menuContainer}>
                        <Pressable
                            style={styles.menuOption}
                            onPress={handleEditOption}
                        >
                            <Text style={styles.menuText}>Edit</Text>
                        </Pressable>
                        <View style={styles.menuDivider} />
                        <Pressable
                            style={styles.menuOption}
                            onPress={handleDeleteOption}
                        >
                            <Text style={[styles.menuText, styles.menuTextDanger]}>Delete</Text>
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
                            {selectedFavorite ? 'Edit Favorite' : 'Add Favorite'}
                        </Text>

                        <TextInput
                            style={styles.input}
                            value={editName}
                            onChangeText={setEditName}
                            placeholder="Food name"
                            placeholderTextColor={colors.textDimmed}
                            autoFocus={!selectedFavorite}
                        />

                        <TextInput
                            style={styles.input}
                            value={editCalories}
                            onChangeText={setEditCalories}
                            placeholder="Calories"
                            placeholderTextColor={colors.textDimmed}
                            keyboardType="numeric"
                        />

                        <View style={styles.modalButtons}>
                            <Pressable
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => setEditModalVisible(false)}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </Pressable>
                            <Pressable
                                style={[styles.modalButton, styles.saveButton]}
                                onPress={handleSaveEdit}
                            >
                                <Text style={styles.saveButtonText}>Save</Text>
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
    favoriteContent: {
        flex: 1,
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
