import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

type TabName = 'today' | 'favorites' | 'stats' | 'profile';

interface TabNavigatorProps {
    activeTab: TabName;
    onTabChange: (tab: TabName) => void;
}

export function TabNavigator({ activeTab, onTabChange }: TabNavigatorProps) {
    const insets = useSafeAreaInsets();
    
    return (
        <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <Pressable
                style={[styles.tab, activeTab === 'today' && styles.activeTab]}
                onPress={() => onTabChange('today')}
                accessibilityRole="tab"
                accessibilityLabel="Hoy"
                accessibilityState={{ selected: activeTab === 'today' }}
            >
                <Ionicons
                    name="calendar-outline"
                    size={20}
                    color={activeTab === 'today' ? colors.textPrimary : colors.textSecondary}
                />
                <Text style={[styles.label, activeTab === 'today' && styles.activeLabel]}>
                    Hoy
                </Text>
                {activeTab === 'today' && <View style={styles.indicator} />}
            </Pressable>

            <Pressable
                style={[styles.tab, activeTab === 'favorites' && styles.activeTab]}
                onPress={() => onTabChange('favorites')}
                accessibilityRole="tab"
                accessibilityLabel="Favoritos"
                accessibilityState={{ selected: activeTab === 'favorites' }}
            >
                <Ionicons
                    name="heart-outline"
                    size={20}
                    color={activeTab === 'favorites' ? colors.textPrimary : colors.textSecondary}
                />
                <Text style={[styles.label, activeTab === 'favorites' && styles.activeLabel]}>
                    Favoritos
                </Text>
                {activeTab === 'favorites' && <View style={styles.indicator} />}
            </Pressable>

            <Pressable
                style={[styles.tab, activeTab === 'stats' && styles.activeTab]}
                onPress={() => onTabChange('stats')}
                accessibilityRole="tab"
                accessibilityLabel="Progreso"
                accessibilityState={{ selected: activeTab === 'stats' }}
            >
                <Ionicons
                    name="bar-chart-outline"
                    size={20}
                    color={activeTab === 'stats' ? colors.textPrimary : colors.textSecondary}
                />
                <Text style={[styles.label, activeTab === 'stats' && styles.activeLabel]}>
                    Progreso
                </Text>
                {activeTab === 'stats' && <View style={styles.indicator} />}
            </Pressable>

            <Pressable
                style={[styles.tab, activeTab === 'profile' && styles.activeTab]}
                onPress={() => onTabChange('profile')}
                accessibilityRole="tab"
                accessibilityLabel="Perfil"
                accessibilityState={{ selected: activeTab === 'profile' }}
            >
                <Ionicons
                    name="person-outline"
                    size={20}
                    color={activeTab === 'profile' ? colors.textPrimary : colors.textSecondary}
                />
                <Text style={[styles.label, activeTab === 'profile' && styles.activeLabel]}>
                    Perfil
                </Text>
                {activeTab === 'profile' && <View style={styles.indicator} />}
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        backgroundColor: colors.cardBackground,
        borderTopWidth: 1,
        borderTopColor: colors.cardBorder,
        paddingTop: 12,
    },
    tab: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 4,
        position: 'relative',
    },
    activeTab: {
        // Optional: add active state styling
    },
    label: {
        fontSize: 11,
        color: colors.textSecondary,
        fontWeight: '400',
        letterSpacing: 0.3,
        marginTop: 2,
    },
    activeLabel: {
        color: colors.textPrimary,
        fontWeight: '400',
    },
    indicator: {
        position: 'absolute',
        bottom: -8,
        width: 32,
        height: 2,
        backgroundColor: colors.accent,
        borderRadius: 1,
    },
});
