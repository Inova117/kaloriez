import React from 'react';
import { View, Text, StyleSheet, Pressable, Animated, ScrollView } from 'react-native';
import { colors } from '../theme/colors';
import { QuickAddItem } from '../types';

interface QuickAddBarProps {
    items: QuickAddItem[];
    onItemPress: (item: QuickAddItem) => void;
}

function GhostChip({ item, onPress }: { item: QuickAddItem; onPress: () => void }) {
    const scaleAnim = React.useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        Animated.spring(scaleAnim, {
            toValue: 0.95,
            useNativeDriver: true,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 3,
            tension: 200,
            useNativeDriver: true,
        }).start();
    };

    const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

    return (
        <AnimatedPressable
            style={[styles.ghostChip, { transform: [{ scale: scaleAnim }] }]}
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
        >
            <Text style={styles.chipEmoji}>{item.emoji}</Text>
            <Text style={styles.chipText}>{item.name}</Text>
        </AnimatedPressable>
    );
}

export function QuickAddBar({ items, onItemPress }: QuickAddBarProps) {
    if (items.length === 0) {
        return null; // Hide if no favorites
    }

    return (
        <View style={styles.container}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {items.map((item) => (
                    <GhostChip
                        key={item.id}
                        item={item}
                        onPress={() => onItemPress(item)}
                    />
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingVertical: 12,
    },
    scrollContent: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        gap: 8,
        // flexWrap removed for horizontal scroll
    },
    ghostChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 16,
        backgroundColor: colors.cardBackground,
        borderWidth: 1,
        borderColor: colors.ghostBorder,
        shadowColor: 'rgba(0,0,0,0.05)',
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4,
        elevation: 1,
        gap: 6,
    },
    chipEmoji: {
        fontSize: 14,
    },
    chipText: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.textSecondary,
        letterSpacing: -0.2,
    },
});
