import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Animated, PanResponder, Dimensions } from 'react-native';
import { addDays, formatDateKey } from '../utils/dateUtils';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');
const SWIPE_THRESHOLD = 80;

interface DayNavigatorProps {
    currentDate: Date;
    onDateChange: (newDate: Date) => void;
    children: React.ReactNode;
}

export function DayNavigator({ currentDate, onDateChange, children }: DayNavigatorProps) {
    const translateX = useRef(new Animated.Value(0)).current;
    const opacity = useRef(new Animated.Value(1)).current;

    // Use ref to always have latest currentDate in PanResponder
    const currentDateRef = useRef(currentDate);

    useEffect(() => {
        currentDateRef.current = currentDate;
    }, [currentDate]);

    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return Math.abs(gestureState.dx) > 15;
            },
            onPanResponderMove: (_, gestureState) => {
                translateX.setValue(gestureState.dx * 0.3);
            },
            onPanResponderRelease: (_, gestureState) => {
                if (Math.abs(gestureState.dx) > SWIPE_THRESHOLD) {
                    const direction = gestureState.dx > 0 ? 'right' : 'left';
                    handleSwipe(direction);
                } else {
                    resetPosition();
                }
            },
        })
    ).current;

    const handleSwipe = (direction: 'left' | 'right') => {
        // Use ref to get latest date
        const current = currentDateRef.current;

        // INVERTED LOGIC:
        // Swipe RIGHT (dx > 0) = Go to PAST (-1)
        // Swipe LEFT (dx < 0) = Go to FUTURE (+1)
        const daysToAdd = direction === 'right' ? -1 : 1;

        const newDate = addDays(current, daysToAdd);

        const newDateKey = formatDateKey(newDate);
        const todayKey = formatDateKey(new Date());
        const sixtyDaysAgoKey = formatDateKey(addDays(new Date(), -60));

        const isFuture = newDateKey > todayKey;
        const isTooOld = newDateKey < sixtyDaysAgoKey;

        if (!isFuture && !isTooOld) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

            Animated.parallel([
                Animated.timing(translateX, {
                    toValue: direction === 'left' ? -width : width,
                    duration: 180,
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 0,
                    duration: 120,
                    useNativeDriver: true,
                }),
            ]).start(() => {
                onDateChange(newDate);

                translateX.setValue(direction === 'left' ? width : -width);

                Animated.parallel([
                    Animated.spring(translateX, {
                        toValue: 0,
                        damping: 20,
                        stiffness: 300,
                        useNativeDriver: true,
                    }),
                    Animated.timing(opacity, {
                        toValue: 1,
                        duration: 120,
                        useNativeDriver: true,
                    }),
                ]).start();
            });
        } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            resetPosition();
        }
    };

    const resetPosition = () => {
        Animated.spring(translateX, {
            toValue: 0,
            friction: 5,
            useNativeDriver: true,
        }).start();
    };

    return (
        <View style={styles.container} {...panResponder.panHandlers}>
            <Animated.View
                style={[
                    styles.content,
                    {
                        transform: [{ translateX }],
                        opacity,
                    },
                ]}
            >
                {children}
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
    },
});
