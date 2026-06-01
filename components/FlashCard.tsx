import { useTheme } from '@/contexts/ThemeContext';
import { AdaptiveQuestion } from '@/lib/flashcards';
import React, { useState } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector, ScrollView } from 'react-native-gesture-handler';
import Animated, {
    interpolate,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming
} from 'react-native-reanimated';

const ScreenWidth = Dimensions.get('window').width;
const ScreenHeight = Dimensions.get('window').height;
const SWIPE_THRESHOLD = ScreenWidth * 0.3;

interface FlashCardProps {
    question: AdaptiveQuestion;
    onSwipe: (direction: 'left' | 'right') => void;
    visible: boolean; // Is it the top card?
}

export default function FlashCard({ question, onSwipe, visible, index = 0 }: FlashCardProps & { index?: number }) {
    const { colors } = useTheme();
    const [isFlipped, setIsFlipped] = useState(false);

    // Swipe Animation Values
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const rotate = useSharedValue(0);

    // Stacking Animation Values
    // Flip Animation Values
    const rotateY = useSharedValue(0);

    const animatedIndex = useSharedValue(index);

    React.useEffect(() => {
        // Use withTiming for reliable stacking transition
        animatedIndex.value = withTiming(index, { duration: 250 });

        // If this card just became the top card (index 0), ensure it's centered
        if (index === 0) {
            translateX.value = withSpring(0);
            translateY.value = withSpring(0);
            rotate.value = withSpring(0);
        }
    }, [index]);

    const pan = Gesture.Pan()
        .activeOffsetX([-10, 10]) // Reduced threshold for snappier response

        .enabled(visible)
        .onStart(() => {
            // Reset any lingering animation values
        })
        .onUpdate((event) => {
            translateX.value = event.translationX;
            translateY.value = event.translationY * 0.3; // Dampen vertical movement
            rotate.value = (event.translationX / ScreenWidth) * 15;
        })
        .onEnd(() => {
            if (Math.abs(translateX.value) > SWIPE_THRESHOLD) {
                const direction = translateX.value > 0 ? 'right' : 'left';
                translateX.value = withTiming(
                    direction === 'right' ? ScreenWidth * 1.5 : -ScreenWidth * 1.5,
                    { duration: 200 } // Faster exit animation
                );
                runOnJS(onSwipe)(direction);
            } else {
                // Snap back with responsive spring
                translateX.value = withSpring(0, { damping: 15, stiffness: 150 });
                translateY.value = withSpring(0, { damping: 15, stiffness: 150 });
                rotate.value = withSpring(0, { damping: 15, stiffness: 150 });
            }
        })
        .onFinalize((success) => {
            // "Next card stucks" fix: If gesture was cancelled/failed (e.g. vertical scroll took over),
            // onEnd never runs, so we must reset here.
            if (!success) {
                translateX.value = withSpring(0, { damping: 15, stiffness: 150 });
                translateY.value = withSpring(0, { damping: 15, stiffness: 150 });
                rotate.value = withSpring(0, { damping: 15, stiffness: 150 });
            }
        });

    const handleFlip = () => {
        if (isFlipped) {
            rotateY.value = withTiming(0, { duration: 300 });
            setTimeout(() => setIsFlipped(false), 150);
        } else {
            rotateY.value = withTiming(180, { duration: 300 });
            setTimeout(() => setIsFlipped(true), 150);
        }
    };



    const wrapperStyle = useAnimatedStyle(() => {
        return {
            zIndex: 100 - Math.round(animatedIndex.value),
        };
    });

    const innerCardStyle = useAnimatedStyle(() => {
        // Exaggerated rotation for messy stack effect
        const staticRotation = interpolate(animatedIndex.value, [0, 1, 2], [0, -6, 6]);

        return {
            transform: [
                { translateX: translateX.value },
                { translateY: translateY.value - (animatedIndex.value * 35) }, // Large vertical offset
                { rotate: `${rotate.value + staticRotation}deg` },
                { scale: interpolate(animatedIndex.value, [0, 1, 2], [1, 0.96, 0.92]) } // Subtle scale
            ],
            opacity: interpolate(animatedIndex.value, [0, 3], [1, 0.7])
        };
    });

    const frontStyle = useAnimatedStyle(() => {
        return {
            transform: [{ rotateY: `${rotateY.value}deg` }],
            backfaceVisibility: 'hidden',
        };
    });

    const backStyle = useAnimatedStyle(() => {
        return {
            transform: [{ rotateY: `${rotateY.value + 180}deg` }],
            backfaceVisibility: 'hidden',
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0
        };
    });

    const overlayStyleRight = useAnimatedStyle(() => {
        return {
            opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 1])
        }
    });

    const overlayStyleLeft = useAnimatedStyle(() => {
        return {
            opacity: interpolate(translateX.value, [0, -SWIPE_THRESHOLD], [0, 1])
        }
    });

    // Dynamic styles based on theme
    const activeRaw = colors.primary; // e.g. #8A2BE2
    const shadowColor = visible ? activeRaw : "#000";
    // Increase elevation/opacity for the active card to make it "glow"
    const shadowOpacity = visible ? 0.6 : 0.25;
    const elevation = visible ? 12 : 5;

    const dynamicStyles = {
        cardFace: {
            backgroundColor: visible ? colors.card : colors.card, // active tint if needed: colors.card + overlapping view? 
            // Let's keep bg clean but add a border
            borderColor: visible ? activeRaw : colors.border,
            borderWidth: visible ? 1.5 : 1,
        },
        shadowContainer: {
            shadowColor: shadowColor,
            shadowOpacity: shadowOpacity,
            elevation: elevation,
            shadowRadius: visible ? 20 : 16,
        },
        text: {
            color: colors.text,
        },
        subText: {
            color: colors.subText,
        },
        badge: {
            backgroundColor: colors.inputBg,
        }
    };

    return (
        <GestureDetector gesture={pan}>
            <Animated.View style={[styles.touchWrapper, wrapperStyle]} pointerEvents={visible ? "auto" : "none"}>
                <Animated.View style={[styles.cardContainer, dynamicStyles.shadowContainer, innerCardStyle]}>
                    <TouchableOpacity activeOpacity={1} onPress={handleFlip} style={{ flex: 1 }} disabled={!visible}>
                        {/* Front */}
                        <Animated.View style={[styles.cardFace, styles.sharedFace, dynamicStyles.cardFace, frontStyle]}>
                            {/* Optional subtle gold tint overlay for the focused card */}
                            {visible && (
                                <View style={[StyleSheet.absoluteFill, { backgroundColor: activeRaw, opacity: 0.03 }]} pointerEvents="none" />
                            )}
                            <View style={styles.contentContainer}>
                                <ScrollView
                                    contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 40 }}
                                    showsVerticalScrollIndicator={false}
                                    nestedScrollEnabled={true}
                                >
                                    <Text style={[styles.questionText, dynamicStyles.text]}>{question.question_text}</Text>
                                </ScrollView>
                                <Text style={[styles.tapPrompt, dynamicStyles.subText]}>Tap to flip</Text>
                            </View>
                            {/* Status overlays on front face too */}
                            <Animated.View style={[styles.overlay, { backgroundColor: '#22c55e33' }, overlayStyleRight]} pointerEvents="none" />
                            <Animated.View style={[styles.overlay, { backgroundColor: '#ef444433' }, overlayStyleLeft]} pointerEvents="none" />
                        </Animated.View>

                        {/* Back */}
                        <Animated.View style={[styles.cardFace, styles.sharedFace, dynamicStyles.cardFace, backStyle]}>
                            {/* Optional subtle gold tint overlay for the focused card */}
                            {visible && (
                                <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.primary, opacity: 0.6 }]} pointerEvents="none" />
                            )}
                            <View style={styles.contentContainer}>
                                <Text style={[styles.answerLabel, dynamicStyles.subText]}>Answer</Text>
                                <ScrollView
                                    contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 20 }}
                                    showsVerticalScrollIndicator={false}
                                    nestedScrollEnabled={true}
                                >
                                    <Text style={[styles.answerText, dynamicStyles.text, { color: colors.text }]}>{question.answer_text}</Text>
                                </ScrollView>
                                {/* <View style={styles.statsRow}>
                                    <Text style={[styles.difficultyLabel, dynamicStyles.subText]}>Tier {question.difficulty_tier}</Text>
                                </View> */}
                            </View>
                            {/* Status overlays on back face */}
                            <Animated.View style={[styles.overlay, { backgroundColor: '#22c55e33' }, overlayStyleRight]} pointerEvents="none" />
                            <Animated.View style={[styles.overlay, { backgroundColor: '#ef444433' }, overlayStyleLeft]} pointerEvents="none" />
                        </Animated.View>
                    </TouchableOpacity>
                </Animated.View>
            </Animated.View>
        </GestureDetector>
    );
}

const styles = StyleSheet.create({
    touchWrapper: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'flex-start',
        alignItems: 'center',
    },
    cardContainer: {
        width: ScreenWidth - 50,
        height: ScreenHeight * 0.6, // Responsive height (60% of screen)
        minHeight: 400, // Safety minimum
        maxHeight: 600, // Safety maximum
        marginTop: 60,
        // Shadow on container (doesn't rotate, so no distortion)
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 12,
    },
    sharedFace: {
        width: '100%',
        height: '100%',
        borderRadius: 24,
        padding: 24,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        overflow: 'hidden', // Helps with clipping during flip
    },
    cardFace: {
        // dynamic override
    },
    contentContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%'
    },
    questionText: {
        fontSize: 24,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 32
    },
    answerText: {
        fontSize: 20,
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 28
    },
    tapPrompt: {
        position: 'absolute',
        bottom: 0,
        fontSize: 14,
        fontWeight: '500'
    },
    answerLabel: {
        fontSize: 14,
        marginBottom: 16,
        textTransform: 'uppercase',
        letterSpacing: 2,
        fontWeight: '700'
    },
    difficultyLabel: {
        fontSize: 12,
        fontWeight: '600'
    },
    statsRow: {
        position: 'absolute',
        bottom: 0,
        flexDirection: 'row',
        gap: 10
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 24,
    }
});


