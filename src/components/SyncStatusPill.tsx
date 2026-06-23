import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useSyncStatus } from '../hooks/useSyncStatus';

const LABELS: Record<string, string> = {
    offline: 'Sin conexión · se guardó',
    syncing: 'Sincronizando…',
    synced: 'Sincronizado',
};

/**
 * Transient, non-blocking pill that fades in at the top only when there is
 * something to communicate (offline with pending changes / syncing / just
 * synced). pointerEvents="none" so it never intercepts taps.
 */
export function SyncStatusPill() {
    const state = useSyncStatus();

    return (
        <View pointerEvents="none" style={styles.wrap}>
            {state !== 'idle' && (
                <Animated.View
                    key={state}
                    entering={FadeInUp.duration(280)}
                    exiting={FadeOutUp.duration(240)}
                    style={[
                        styles.pill,
                        state === 'synced' && styles.pillSynced,
                    ]}
                >
                    {state === 'syncing' ? (
                        <ActivityIndicator size="small" color={colors.accent} />
                    ) : (
                        <Ionicons
                            name={state === 'offline' ? 'cloud-offline-outline' : 'checkmark-circle'}
                            size={15}
                            color={state === 'synced' ? colors.success : colors.textMuted}
                        />
                    )}
                    <Text style={styles.text}>{LABELS[state]}</Text>
                </Animated.View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        position: 'absolute',
        top: 6,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 2000,
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        paddingVertical: 7,
        paddingHorizontal: 14,
        borderRadius: 999,
        backgroundColor: colors.cardBackground,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        shadowColor: colors.textPrimary,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
    },
    pillSynced: {
        borderColor: colors.success,
    },
    text: {
        fontSize: 13,
        fontWeight: '500',
        color: colors.textSecondary,
    },
});
