import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    Pressable,
    ScrollView,
    Animated,
} from 'react-native';
import { colors } from '../theme/colors';
import { formatDateKey, isSameDay } from '../utils/dateUtils';

interface CalendarModalProps {
    visible: boolean;
    currentDate: Date;
    daysWithData: Set<string>;
    onSelectDate: (date: Date) => void;
    onClose: () => void;
}

const MONTHS = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const DAYS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];

export function CalendarModal({
    visible,
    currentDate,
    daysWithData,
    onSelectDate,
    onClose,
}: CalendarModalProps) {
    const [viewingMonth, setViewingMonth] = useState(new Date(currentDate));
    const fadeAnim = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        if (visible) {
            setViewingMonth(new Date(currentDate));
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }).start();
        }
    }, [visible]);

    const getDaysInMonth = (date: Date): Date[] => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        const days: Date[] = [];

        // Add empty days for alignment
        for (let i = 0; i < firstDay.getDay(); i++) {
            days.push(new Date(0)); // Invalid date for empty cells
        }

        // Add actual days
        for (let i = 1; i <= lastDay.getDate(); i++) {
            days.push(new Date(year, month, i));
        }

        return days;
    };

    const handleDateSelect = (date: Date) => {
        if (date.getTime() === 0) return; // Empty cell
        onSelectDate(date);
        onClose();
    };

    const changeMonth = (delta: number) => {
        const newMonth = new Date(viewingMonth);
        newMonth.setMonth(newMonth.getMonth() + delta);
        setViewingMonth(newMonth);
    };

    const days = getDaysInMonth(viewingMonth);
    const today = new Date();

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
                    <View style={styles.header}>
                        <Pressable onPress={() => changeMonth(-1)} style={styles.navButton}>
                            <Text style={styles.navText}>←</Text>
                        </Pressable>
                        <Text style={styles.monthTitle}>
                            {MONTHS[viewingMonth.getMonth()]} {viewingMonth.getFullYear()}
                        </Text>
                        <Pressable onPress={() => changeMonth(1)} style={styles.navButton}>
                            <Text style={styles.navText}>→</Text>
                        </Pressable>
                    </View>

                    <View style={styles.weekDays}>
                        {DAYS.map((day) => (
                            <Text key={day} style={styles.weekDayText}>
                                {day}
                            </Text>
                        ))}
                    </View>

                    <View style={styles.daysGrid}>
                        {days.map((date, index) => {
                            const isEmpty = date.getTime() === 0;
                            const isSelected = !isEmpty && isSameDay(date, currentDate);
                            const isToday = !isEmpty && isSameDay(date, today);
                            const hasData = !isEmpty && daysWithData.has(formatDateKey(date));
                            const isFuture = !isEmpty && date > today;

                            return (
                                <Pressable
                                    key={index}
                                    style={[
                                        styles.dayCell,
                                        isSelected && styles.selectedDay,
                                        isToday && !isSelected && styles.todayDay,
                                    ]}
                                    onPress={() => handleDateSelect(date)}
                                    disabled={isEmpty || isFuture}
                                >
                                    {!isEmpty && (
                                        <>
                                            <Text
                                                style={[
                                                    styles.dayText,
                                                    isSelected && styles.selectedDayText,
                                                    isFuture && styles.futureDayText,
                                                ]}
                                            >
                                                {date.getDate()}
                                            </Text>
                                            {hasData && <View style={styles.dataDot} />}
                                        </>
                                    )}
                                </Pressable>
                            );
                        })}
                    </View>

                    <Pressable style={styles.closeButton} onPress={onClose}>
                        <Text style={styles.closeText}>Cerrar</Text>
                    </Pressable>
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
        width: '90%',
        maxWidth: 360,
        alignSelf: 'center',
        top: '15%',
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: colors.cardBackground,
        borderWidth: 1,
        borderColor: colors.cardBorder,
    },
    content: {
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    navButton: {
        padding: 8,
    },
    navText: {
        fontSize: 24,
        color: colors.textPrimary,
    },
    monthTitle: {
        fontSize: 18,
        fontWeight: '400',
        color: colors.textPrimary,
    },
    weekDays: {
        flexDirection: 'row',
        marginBottom: 10,
    },
    weekDayText: {
        flex: 1,
        textAlign: 'center',
        fontSize: 12,
        color: colors.textMuted,
        fontWeight: '400',
    },
    daysGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    dayCell: {
        width: '14.28%',
        aspectRatio: 1,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    dayText: {
        fontSize: 16,
        color: colors.textPrimary,
    },
    selectedDay: {
        backgroundColor: colors.accent,
        borderRadius: 20,
    },
    selectedDayText: {
        color: colors.textPrimary,
        fontWeight: '400',
    },
    todayDay: {
        borderWidth: 1,
        borderColor: colors.accent,
        borderRadius: 20,
    },
    futureDayText: {
        color: colors.textDimmed,
    },
    dataDot: {
        position: 'absolute',
        bottom: 4,
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.accent,
    },
    closeButton: {
        marginTop: 20,
        paddingVertical: 14,
        alignItems: 'center',
        borderTopWidth: 0.5,
        borderTopColor: colors.ghostBorder,
    },
    closeText: {
        fontSize: 17,
        fontWeight: '400',
        color: colors.accent,
    },
});
