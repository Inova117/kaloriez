import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { isToday } from '../utils/dateUtils';

interface EmptyStateProps {
    date: Date;
}

export function EmptyState({ date }: EmptyStateProps) {
    const [greeting, setGreeting] = useState({ title: '', subtitle: '' });

    useEffect(() => {
        if (!isToday(date)) {
            setGreeting({
                title: 'Día vacío',
                subtitle: 'Sin registros'
            });
            return;
        }

        const hour = new Date().getHours();

        if (hour >= 5 && hour < 11) {
            setGreeting({ title: 'Buenos días', subtitle: '¿Qué desayunaste?' });
        } else if (hour >= 11 && hour < 15) {
            setGreeting({ title: 'Hora de comer', subtitle: '¿Qué vas a comer?' });
        } else if (hour >= 15 && hour < 22) {
            setGreeting({ title: 'Hora de cenar', subtitle: 'Registra tu comida' });
        } else {
            setGreeting({ title: '¿Antojo nocturno?', subtitle: '¿Algún snack para registrar?' });
        }
    }, [date]);

    return (
        <View style={styles.container}>
            <Text style={styles.hint}>{greeting.title}</Text>
            <Text style={styles.subhint}>{greeting.subtitle}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 100, // Push it down a bit
        paddingBottom: 40,
        opacity: 0.7,
    },
    hint: {
        fontSize: 20,
        fontWeight: '400',
        color: colors.textSecondary,
        marginBottom: 8,
        letterSpacing: -0.5,
    },
    subhint: {
        fontSize: 16,
        color: colors.textMuted,
    },
});
