import { useTheme } from '@/contexts/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Check, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withTiming
} from 'react-native-reanimated';

const STORAGE_KEY = '@flashcard_tutorial_dismissed';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface FlashcardTutorialProps {
    onDismiss: () => void;
}

export default function FlashcardTutorial({ onDismiss }: FlashcardTutorialProps) {
    const { colors } = useTheme();
    const [dontShowAgain, setDontShowAgain] = useState(false);

    // Animation values
    const handTranslateX = useSharedValue(0);
    const handOpacity = useSharedValue(1);
    const cardTranslateX = useSharedValue(0);
    const cardRotate = useSharedValue(0);
    const leftLabelOpacity = useSharedValue(0);
    const rightLabelOpacity = useSharedValue(0);

    useEffect(() => {
        // Animation sequence: Swipe Right -> Pause -> Reset -> Swipe Left -> Pause -> Reset -> Repeat
        const animationDuration = 800;
        const pauseDuration = 600;
        const resetDuration = 400;

        // Right swipe animation
        const swipeRight = () => {
            handTranslateX.value = withTiming(SCREEN_WIDTH * 0.25, { duration: animationDuration, easing: Easing.out(Easing.ease) });
            cardTranslateX.value = withTiming(SCREEN_WIDTH * 0.25, { duration: animationDuration, easing: Easing.out(Easing.ease) });
            cardRotate.value = withTiming(8, { duration: animationDuration });
            rightLabelOpacity.value = withTiming(1, { duration: animationDuration / 2 });
            leftLabelOpacity.value = withTiming(0, { duration: 100 });
        };

        // Left swipe animation
        const swipeLeft = () => {
            handTranslateX.value = withTiming(-SCREEN_WIDTH * 0.25, { duration: animationDuration, easing: Easing.out(Easing.ease) });
            cardTranslateX.value = withTiming(-SCREEN_WIDTH * 0.25, { duration: animationDuration, easing: Easing.out(Easing.ease) });
            cardRotate.value = withTiming(-8, { duration: animationDuration });
            leftLabelOpacity.value = withTiming(1, { duration: animationDuration / 2 });
            rightLabelOpacity.value = withTiming(0, { duration: 100 });
        };

        // Reset animation
        const resetPosition = () => {
            handTranslateX.value = withTiming(0, { duration: resetDuration });
            cardTranslateX.value = withTiming(0, { duration: resetDuration });
            cardRotate.value = withTiming(0, { duration: resetDuration });
            leftLabelOpacity.value = withTiming(0, { duration: resetDuration });
            rightLabelOpacity.value = withTiming(0, { duration: resetDuration });
        };

        // Continuous animation loop
        const runAnimation = () => {
            // Swipe Right
            swipeRight();
            setTimeout(() => {
                resetPosition();
                setTimeout(() => {
                    // Swipe Left
                    swipeLeft();
                    setTimeout(() => {
                        resetPosition();
                        setTimeout(runAnimation, pauseDuration);
                    }, pauseDuration + animationDuration);
                }, resetDuration + pauseDuration);
            }, pauseDuration + animationDuration);
        };

        const timeout = setTimeout(runAnimation, 500);
        return () => clearTimeout(timeout);
    }, []);

    const cardAnimStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: cardTranslateX.value },
            { rotate: `${cardRotate.value}deg` },
        ],
    }));

    const handAnimStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: handTranslateX.value }],
        opacity: handOpacity.value,
    }));

    const leftLabelStyle = useAnimatedStyle(() => ({
        opacity: leftLabelOpacity.value,
    }));

    const rightLabelStyle = useAnimatedStyle(() => ({
        opacity: rightLabelOpacity.value,
    }));

    const handleDismiss = async () => {
        if (dontShowAgain) {
            try {
                await AsyncStorage.setItem(STORAGE_KEY, 'true');
            } catch (e) {
                console.error('Failed to save tutorial preference:', e);
            }
        }
        onDismiss();
    };

    return (
        <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.85)' }]}>
            <View style={styles.content}>
                {/* Title */}
                <Text style={[styles.title, { color: '#F8FAFC' }]}>How to Use Flashcards</Text>

                {/* Animation Area */}
                <View style={styles.animationContainer}>
                    {/* Left Label */}
                    <Animated.View style={[styles.swipeLabel, styles.leftLabel, leftLabelStyle]}>
                        <View style={[styles.labelBadge, { backgroundColor: '#EF4444' }]}>
                            <X size={20} color="#FFF" strokeWidth={3} />
                        </View>
                        <Text style={styles.labelText}>Wrong</Text>
                    </Animated.View>

                    {/* Mock Card */}
                    <Animated.View style={[styles.mockCard, { backgroundColor: colors.card, borderColor: colors.border }, cardAnimStyle]}>
                        <Text style={[styles.mockCardText, { color: colors.text }]}>Sample Question</Text>
                    </Animated.View>

                    {/* Right Label */}
                    <Animated.View style={[styles.swipeLabel, styles.rightLabel, rightLabelStyle]}>
                        <View style={[styles.labelBadge, { backgroundColor: '#22C55E' }]}>
                            <Check size={20} color="#FFF" strokeWidth={3} />
                        </View>
                        <Text style={styles.labelText}>Correct</Text>
                    </Animated.View>

                    {/* Hand/Touch Indicator */}
                    <Animated.View style={[styles.touchIndicator, handAnimStyle]}>
                        <View style={styles.touchCircle} />
                    </Animated.View>
                </View>

                {/* Instructions */}
                <View style={styles.instructions}>
                    <View style={styles.instructionRow}>
                        <View style={[styles.directionBadge, { backgroundColor: '#22C55E20', borderColor: '#22C55E' }]}>
                            <Text style={{ color: '#22C55E', fontWeight: '700' }}>→ Right</Text>
                        </View>
                        <Text style={styles.instructionText}>I knew this!</Text>
                    </View>
                    <View style={styles.instructionRow}>
                        <View style={[styles.directionBadge, { backgroundColor: '#EF444420', borderColor: '#EF4444' }]}>
                            <Text style={{ color: '#EF4444', fontWeight: '700' }}>← Left</Text>
                        </View>
                        <Text style={styles.instructionText}>Need more practice</Text>
                    </View>
                </View>

                {/* Don't Show Again Checkbox */}
                <TouchableOpacity
                    style={styles.checkboxContainer}
                    onPress={() => setDontShowAgain(!dontShowAgain)}
                    activeOpacity={0.7}
                >
                    <View style={[styles.checkbox, dontShowAgain && styles.checkboxChecked]}>
                        {dontShowAgain && <Check size={14} color="#FFF" strokeWidth={3} />}
                    </View>
                    <Text style={styles.checkboxLabel}>Don't show this again</Text>
                </TouchableOpacity>

                {/* Got It Button */}
                <TouchableOpacity style={styles.gotItButton} onPress={handleDismiss}>
                    <Text style={styles.gotItButtonText}>Got It!</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

// Helper to check if tutorial should be shown
export const shouldShowTutorial = async (): Promise<boolean> => {
    try {
        const value = await AsyncStorage.getItem(STORAGE_KEY);
        return value !== 'true';
    } catch (e) {
        return true; // Show by default if error
    }
};

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    content: {
        width: '90%',
        maxWidth: 360,
        alignItems: 'center',
        paddingVertical: 30,
        paddingHorizontal: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        marginBottom: 30,
        textAlign: 'center',
    },
    animationContainer: {
        width: '100%',
        height: 200,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        marginBottom: 30,
    },
    mockCard: {
        width: 180,
        height: 120,
        borderRadius: 16,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    mockCardText: {
        fontSize: 16,
        fontWeight: '600',
    },
    touchIndicator: {
        position: 'absolute',
        bottom: 20,
        zIndex: 20,
    },
    touchCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(245, 158, 11, 0.3)', // Semi-transparent glow
        borderWidth: 4,
        borderColor: '#8A2BE2',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#8A2BE2',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 10,
        elevation: 10,
    },
    swipeLabel: {
        position: 'absolute',
        alignItems: 'center',
        gap: 6,
        zIndex: -1, // Ensure labels stay behind the card
    },
    leftLabel: {
        left: 10,
    },
    rightLabel: {
        right: 10,
    },
    labelBadge: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    labelText: {
        color: '#94A3B8',
        fontSize: 12,
        fontWeight: '600',
    },
    instructions: {
        width: '100%',
        gap: 12,
        marginBottom: 24,
    },
    instructionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    directionBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
    },
    instructionText: {
        color: '#CBD5E1',
        fontSize: 15,
        fontWeight: '500',
    },
    checkboxContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 24,
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 4,
        borderWidth: 2,
        borderColor: '#64748B',
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxChecked: {
        backgroundColor: '#8A2BE2',
        borderColor: '#8A2BE2',
    },
    checkboxLabel: {
        color: '#94A3B8',
        fontSize: 14,
        fontWeight: '500',
    },
    gotItButton: {
        backgroundColor: '#8A2BE2',
        paddingHorizontal: 48,
        paddingVertical: 14,
        borderRadius: 12,
        shadowColor: '#8A2BE2',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 6,
    },
    gotItButtonText: {
        color: '#0F172A',
        fontSize: 16,
        fontWeight: '800',
    },
});
