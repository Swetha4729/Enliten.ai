import FlashCard from '@/components/FlashCard';
import FlashcardTutorial, { shouldShowTutorial } from '@/components/FlashcardTutorial';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAdaptiveEngine } from '@/hooks/useAdaptiveEngine';
import { getRankForLevel, isMaxLevel } from '@/lib/adaptiveRanks';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, router, useNavigation } from 'expo-router';
import { ChevronLeft, Layers, Trophy, Zap } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView, ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


export default function AdaptiveLearningScreen() {
    const { queue, currentLevel, loading, handleSwipe, saveProgress, totalSwiped, reset } = useAdaptiveEngine();
    const { colors } = useTheme();
    const styles = createStyles(colors);
    const { user } = useAuth();
    const insets = useSafeAreaInsets();
    const [showTutorial, setShowTutorial] = useState(false);

    // Check if tutorial should be shown on mount
    useEffect(() => {
        shouldShowTutorial().then(shouldShow => {
            setShowTutorial(shouldShow);
        });
    }, []);

    const navigation = useNavigation();

    // Handle back button / gesture / hardware back
    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (e) => {
            // Prevent default behavior of leaving the screen
            e.preventDefault();

            Alert.alert(
                'End Session?',
                'Are you sure you want to exit? Your progress will be saved.',
                [
                    { text: 'Cancel', style: 'cancel', onPress: () => { } },
                    {
                        text: 'Save & Exit',
                        style: 'destructive',
                        onPress: async () => {
                            // Save progress
                            try {
                                await saveProgress();
                            } catch (err) {
                                console.error("Error saving progress", err);
                            }
                            // Continue to the destination
                            navigation.dispatch(e.data.action);
                        },
                    },
                ]
            );
        });

        return unsubscribe;
    }, [navigation, saveProgress]);

    const handleBack = () => {
        // Trigger the interception
        router.back();
    };

    const handleReset = async () => {
        Alert.alert(
            "Reset Progress",
            "Are you sure you want to reset your adaptive learning progress? This will clear your study history and start you back at Level 1.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Reset",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await reset();
                            // Hook handles setLoading and refetching
                        } catch (error) {
                            console.error(error);
                            Alert.alert("Error", "Failed to reset progress.");
                        }
                    }
                }
            ]
        );
    };

    if (loading) {
        return (
            <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ color: colors.text, marginTop: 20, fontWeight: '600' }}>Loading your deck...</Text>
            </LinearGradient>
        );
    }

    // We only render top 3 cards for performance and stack effect
    const visibleCards = queue.slice(0, 3);

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <Stack.Screen options={{ headerShown: false }} />
            <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={[styles.container, { paddingTop: insets.top }]}>

                {/* Tutorial Overlay */}
                {showTutorial && <FlashcardTutorial onDismiss={() => setShowTutorial(false)} />}

                {/* Header - Matching QuizScreen vibe */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <ChevronLeft size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Adaptive Flashcards</Text>
                    {/* Placeholder for symmetry or secondary action */}
                    <View style={{ width: 40 }} />
                </View>

                {/* HUD / Stats Bar */}
                <View style={styles.statsBar}>
                    <View style={[styles.statItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Zap color="#8A2BE2" size={16} fill="#8A2BE2" />
                        <Text style={[styles.statText, { color: colors.text }]}>
                            {getRankForLevel(currentLevel)}
                            {isMaxLevel(currentLevel) && <Text style={{ color: '#8A2BE2', fontWeight: '800' }}> MAX</Text>}
                            {!isMaxLevel(currentLevel) && <Text style={{ fontWeight: '400', fontSize: 12, color: colors.subText }}> (Lvl {currentLevel})</Text>}
                        </Text>
                    </View>
                    <View style={[styles.statItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Layers color={colors.primary} size={16} />
                        <Text style={[styles.statText, { color: colors.text }]}>{totalSwiped} Reviewed</Text>
                    </View>
                </View>

                <ScrollView
                    contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 20 }}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Cards */}
                    <View style={[styles.deckContainer, { justifyContent: 'center', alignItems: 'center' }]}>
                        {queue.length === 0 ? (
                            <View style={[styles.emptyState, { width: '100%' }]}>
                                <View style={[styles.emptyIconBg, { backgroundColor: colors.inputBg }]}>
                                    <Trophy size={64} color="#8A2BE2" fill="#8A2BE2" />
                                </View>
                                <Text style={[styles.emptyText, { color: colors.text }]}>All Caught Up!</Text>
                                <Text style={[styles.emptySubText, { color: colors.subText }]}>
                                    You've mastered all available cards for your current level. Great job!
                                </Text>

                                <TouchableOpacity onPress={handleBack} style={[styles.button, { backgroundColor: colors.primary, width: '100%', alignItems: 'center' }]}>
                                    <Text style={styles.buttonText}>Return Home</Text>
                                </TouchableOpacity>

                                <TouchableOpacity onPress={handleReset} style={{ marginTop: 20, padding: 10 }}>
                                    <Text style={{ color: colors.subText, fontSize: 14, textDecorationLine: 'underline' }}>
                                        Reset Progress & Start Over
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            visibleCards.map((question, index) => {
                                return (
                                    <FlashCard
                                        key={`${question.id}-${question.retry_count || 0}`}
                                        question={question}
                                        index={index}
                                        onSwipe={(dir) => handleSwipe(dir, question.id)}
                                        visible={index === 0}
                                    />
                                );
                            }).reverse() // Render bottom first so top is on top
                        )}
                    </View>

                    {/* Instructions / Footer */}
                    <View style={styles.footer}>
                        <Text style={[styles.instructionText, { color: colors.subText }]}>
                            Swipe Left for Incorrect • Swipe Right for Correct
                        </Text>
                    </View>
                </ScrollView>

            </LinearGradient>
        </GestureHandlerRootView>
    );
}

const createStyles = (colors: any) => StyleSheet.create({

    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 20,
        zIndex: 200,
        marginTop: 10
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 20,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
    },
    statsBar: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 15,
        marginBottom: 20,
        paddingHorizontal: 20,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    statText: {
        fontWeight: '700',
        fontSize: 14
    },
    deckContainer: {
        flex: 1,
        width: '100%',
        minHeight: Dimensions.get('window').height * 0.6 + 100, // Ensure minimum height for scrolling (Card Height + Margins)
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
        gap: 16
    },
    emptyIconBg: {
        padding: 24,
        borderRadius: 50,
        marginBottom: 10,
    },
    emptyText: {
        fontSize: 22,
        fontWeight: '700',
        textAlign: 'center'
    },
    emptySubText: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        opacity: 0.8
    },
    button: {
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 12,
        marginTop: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonText: {
        color: 'white',
        fontWeight: '700',
        fontSize: 16
    },
    footer: {
        paddingBottom: 40,
        alignItems: 'center'
    },
    instructionText: {
        fontSize: 13,
        fontWeight: '600',
        opacity: 0.7,
        letterSpacing: 0.5
    }
});
