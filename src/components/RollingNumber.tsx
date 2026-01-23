import React, { useEffect } from 'react';
import { TextInput, TextInputProps, StyleSheet, TextStyle, Platform } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedProps,
    withTiming,
    withSpring,
    Easing,
} from 'react-native-reanimated';

Animated.addWhitelistedNativeProps({ text: true });

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

interface RollingNumberProps extends Omit<TextInputProps, 'value'> {
    value: number;
    style?: TextStyle;
    duration?: number;
}

export function RollingNumber({ value, style, duration = 800, ...rest }: RollingNumberProps) {
    // Current animated value
    const animatedValue = useSharedValue(value);

    // Update value when prop changes
    useEffect(() => {
        animatedValue.value = withSpring(value, {
            damping: 15,
            stiffness: 80,
        });
    }, [value]);

    const animatedProps = useAnimatedProps(() => {
        return {
            text: Math.round(animatedValue.value).toString(),
            // Force value prop for Android if needed (usually text is enough for TextInput)
            value: Math.round(animatedValue.value).toString(),
        } as unknown as TextInputProps;
    });

    return (
        <AnimatedTextInput
            underlineColorAndroid="transparent"
            editable={false}
            {...rest}
            value={value.toString()} // Initial value
            style={[styles.base, style]}
            animatedProps={animatedProps}
        />
    );
}

const styles = StyleSheet.create({
    base: {
        padding: 0,
        margin: 0,
        // Crucial for removing default TextInput paddings
        includeFontPadding: false,
        textAlignVertical: 'center',
    },
});
