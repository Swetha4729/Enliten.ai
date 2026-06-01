import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Calendar, CheckCircle, ChevronLeft, Target, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/AuthContext';
import { useExam } from '@/contexts/ExamContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { checkNetwork } from '@/utils/offlineSync';

const { width, height } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;
const hs = (size: number) => (width / guidelineBaseWidth) * size;
const vs = (size: number) => (height / guidelineBaseHeight) * size;
const ms = (size: number, factor = 0.5) => size + (hs(size) - size) * factor;

export default function DailyQuizScreen() {
    const { user } = useAuth();
    const { exam } = useExam();
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();

    const [loading, setLoading] = useState(true);
    const [dailyQuestion, setDailyQuestion] = useState<any>(null);
    const [dailyOptions, setDailyOptions] = useState<any[]>([]);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [showResult, setShowResult] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [isCompleted, setIsCompleted] = useState(false);

    useEffect(() => {
        fetchDailyQuestion();
    }, [exam]);

    const fetchDailyQuestion = async () => {
        if (!exam) return;
        setLoading(true);
        const isConnected = await checkNetwork();
        if (!isConnected) {
            Alert.alert('Offline', 'Daily question requires an internet connection.');
            setLoading(false);
            router.back();
            return;
        }

        try {
            const today = new Date().toISOString().slice(0, 10);

            // 1. Get the daily question mapping
            const { data: dq, error: dqError } = await supabase
                .from('daily_questions')
                .select('id, question_id')
                .eq('exam', exam.id)
                .eq('date_assigned', today)
                .single();

            if (dqError || !dq) throw dqError || new Error('No daily question');

            // 2. Get the actual question
            const { data: question, error: qError } = await supabase
                .from('questions')
                .select('*')
                .eq('id', dq.question_id)
                .single();

            if (qError || !question) throw qError || new Error('No question');

            // 3. Get the options
            const { data: options, error: oError } = await supabase
                .from('question_options')
                .select('*')
                .eq('question_id', dq.question_id);

            if (oError || !options) throw oError || new Error('No options');

            setDailyQuestion(question);
            setDailyOptions(options);


            // Check if user has already answered this question correctly
            const { data: existingAnswer, error: existingError } = await supabase
                .from('user_answers')
                .select('*')
                .eq('user_id', user?.id)
                .eq('question_id', dq.question_id)
                .eq('is_correct', true)
                .single();

            if (existingAnswer) {
                // User has already answered correctly
                setSelectedAnswer(existingAnswer.selected_option_id);
                setShowResult(true);
                setIsCompleted(true);
            }


        } catch (err) {
            console.error('Error fetching daily question:', err);
            Alert.alert(
                'Daily Question',
                'No question available for today. Please check back later!',
                [{ text: 'OK', onPress: () => router.back() }]
            );
        } finally {
            setLoading(false);
        }
    };

    const handleAnswerSelect = (optionId: string) => {
        if (showResult) return;
        setSelectedAnswer(optionId);
    };

    const submitAnswer = async () => {
        if (!selectedAnswer || !dailyQuestion || submitting) return;

        setSubmitting(true);
        const questionId = dailyQuestion.id;
        const selectedOption = dailyOptions.find(opt => opt.id === selectedAnswer);
        const isCorrect = selectedOption?.is_correct ?? false;

        try {
            // 1. Create the quiz session
            const { data: session, error: sessionError } = await supabase
                .from('quiz_sessions')
                .insert([
                    {
                        user_id: user?.id,
                        quiz_type: 'daily',
                        score: isCorrect ? 1 : 0,
                        total_questions: 1,
                        time_taken_seconds: 0,
                        exam_id: exam.id,
                        completed_at: new Date().toISOString(),
                        created_at: new Date().toISOString(),
                    },
                ])
                .select()
                .single();

            if (sessionError || !session) {
                console.log(sessionError)
                throw new Error('Could not create quiz session');
            }

            // 2. Insert the user answer
            const { error: answerError } = await supabase
                .from('user_answers')
                .insert([
                    {
                        user_id: user?.id,
                        question_id: questionId,
                        selected_option_id: selectedAnswer,
                        is_correct: isCorrect,
                        answered_at: new Date().toISOString(),
                        quiz_session_id: session.id,
                    },
                ]);

            if (answerError) {
                throw new Error('Could not save answer');
            }

            setShowResult(true);
            if (isCorrect) setIsCompleted(true);

        } catch (err) {
            Alert.alert('Error', 'Could not submit answer. Please try again.');
            console.error(err);
        } finally {
            setSubmitting(false);
        }
    };

    const styles = createStyles(colors);

    return (
        <LinearGradient
            colors={[colors.gradientStart, colors.gradientEnd]}
            style={styles.container}
        >
            <View style={[styles.safeArea, { paddingTop: insets.top, paddingBottom: insets.bottom, padding: 10 }]}>

                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <ChevronLeft size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Question of the Day</Text>
                    <View style={{ width: 40 }} />
                </View>

                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={styles.loadingText}>Loading question...</Text>
                    </View>
                ) : (
                    <ScrollView
                        style={styles.scrollView}
                        contentContainerStyle={styles.contentContainer}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Question Card */}
                        <View style={styles.card}>
                            <View style={styles.cardHeader}>
                                <View style={styles.iconContainer}>
                                    <Calendar size={24} color={colors.primary} strokeWidth={2} />
                                </View>
                                <Text style={[styles.dateText, { color: colors.text }]}>
                                    {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                                </Text>
                                {isCompleted && (
                                    <View style={styles.completedBadge}>
                                        <CheckCircle size={14} color="#059669" strokeWidth={2.5} />
                                        <Text style={styles.completedText}>Completed</Text>
                                    </View>
                                )}
                            </View>
                            <View style={{ padding: 10 }}>
                                <Text style={styles.questionText}>{dailyQuestion?.question_text}</Text>

                                <View style={styles.optionsContainer}>
                                    {dailyOptions.map((option) => (
                                        <TouchableOpacity
                                            key={option.id}
                                            style={[
                                                styles.optionButton,
                                                selectedAnswer === option.id && styles.selectedOption,
                                                showResult && option.is_correct && styles.correctOption,
                                                showResult && selectedAnswer === option.id && !option.is_correct && styles.incorrectOption,
                                            ]}
                                            onPress={() => handleAnswerSelect(option.id)}
                                            disabled={showResult}
                                        >
                                            <Text style={[
                                                styles.optionText,
                                                selectedAnswer === option.id && { fontWeight: '600', color: colors.primary },
                                                showResult && option.is_correct && { color: '#047857' },
                                                showResult && selectedAnswer === option.id && !option.is_correct && { color: '#B91C1C' }
                                            ]}>{option.option_text}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                {!showResult ? (
                                    <TouchableOpacity
                                        style={[styles.submitButton, (!selectedAnswer || submitting) && styles.submitButtonDisabled]}
                                        onPress={submitAnswer}
                                        disabled={!selectedAnswer || submitting}
                                    >
                                        {submitting ? (
                                            <ActivityIndicator color="#FFFFFF" />
                                        ) : (
                                            <Text style={styles.submitButtonText}>Submit Answer</Text>
                                        )}
                                    </TouchableOpacity>
                                ) : (
                                    <View style={styles.resultContainer}>
                                        <View style={styles.resultHeader}>
                                            {(() => {
                                                if (!selectedAnswer || !dailyOptions.length) return null;
                                                const selected = dailyOptions.find(opt => opt.id === selectedAnswer);
                                                const isCorrect = selected?.is_correct;
                                                return (
                                                    <>
                                                        <View style={{
                                                            backgroundColor: isCorrect ? '#DEF7EC' : '#FDE8E8',
                                                            padding: 4,
                                                            borderRadius: 20
                                                        }}>
                                                            {isCorrect ? <Target size={16} color="#059669" /> : <X size={16} color="#DC2626" />}
                                                        </View>
                                                        <Text style={[styles.resultHeaderText, { color: isCorrect ? '#059669' : '#DC2626' }]}>
                                                            {isCorrect ? 'Correct!' : 'Incorrect'}
                                                        </Text>
                                                    </>
                                                );
                                            })()}
                                        </View>

                                        <Text style={styles.explanationText}>
                                            {dailyQuestion?.explanation || "No explanation provided."}
                                        </Text>

                                        <TouchableOpacity
                                            style={[styles.submitButton, { marginTop: 16 }]}
                                            onPress={() => router.back()}
                                        >
                                            <Text style={styles.submitButtonText}>Continue</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        </View>
                    </ScrollView>
                )}
            </View>
        </LinearGradient>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 10,
        marginBottom: 10,
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
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.text,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 10,
        color: colors.subText,
        fontSize: 16,
    },
    scrollView: {
        flex: 1,
    },
    contentContainer: {
        padding: 20,
        paddingBottom: 40,
    },
    card: {
        padding: 0,
        marginTop: 20
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        gap: 10,
    },
    iconContainer: {
        backgroundColor: colors.primaryMuted,
        padding: 10,
        borderRadius: 12,
    },
    dateText: {
        fontSize: 14,
        color: colors.subText,
        fontWeight: '600',
    },
    questionText: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 24,
        lineHeight: 28,
    },
    optionsContainer: {
        gap: 12,
        marginBottom: 24,
    },
    optionButton: {
        padding: 16,
        borderRadius: 16,
        backgroundColor: colors.inputBg,
        borderWidth: 1.5,
        borderColor: colors.border,
        flexDirection: 'row',
        alignItems: 'center',
    },
    selectedOption: {
        borderColor: colors.primary,
        backgroundColor: colors.primarySoft,
    },
    correctOption: {
        borderColor: '#10B981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
    },
    incorrectOption: {
        borderColor: '#EF4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
    },
    optionText: {
        fontSize: 15,
        color: colors.text,
        lineHeight: 22,
        flex: 1,
    },
    submitButton: {
        backgroundColor: colors.primary,
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    submitButtonDisabled: {
        opacity: 0.5,
        shadowOpacity: 0,
        elevation: 0,
    },
    submitButtonText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 16,
    },
    resultContainer: {
        marginTop: 10,
        padding: 16,
        backgroundColor: colors.inputBg,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    resultHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 8
    },
    resultHeaderText: {
        fontSize: 16,
        fontWeight: '800',
        marginBottom: 0,
    },
    explanationText: {
        fontSize: 14,
        color: colors.subText,
        lineHeight: 22,
    },
    completedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#DEF7EC',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 6,
        marginLeft: 12,
    },
    completedText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#059669',
    },
});
