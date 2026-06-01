import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ChevronLeft,
  Clock,
  BookOpen,
  Search,
  CheckCircle,
  X,
  Calendar,
  AlertCircle,
  HelpCircle,
} from 'lucide-react-native';

import { useAuth } from '@/contexts/AuthContext';
import { useExam } from '@/contexts/ExamContext';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { checkNetwork } from '@/utils/offlineSync';
import { updateProgress } from '@/lib/progress';

// Responsive utility functions
const { width, height } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

const hs = (size: number) => (width / guidelineBaseWidth) * size;
const vs = (size: number) => (height / guidelineBaseHeight) * size;
const ms = (size: number, factor = 0.5) => size + (hs(size) - size) * factor;

interface Option {
  id: string;
  option_text: string;
  option_letter: string;
  is_correct: boolean;
}

interface Question {
  id: string;
  question_text: string;
  explanation: string;
  difficulty: string;
  domain: string;
  is_premium: boolean;
  options: Option[];
}

interface QuestionPaper {
  id: string;
  title: string;
  year: number;
  exam_id: string;
  duration_minutes: number;
  total_questions: number;
  is_active: boolean;
  created_at: string;
}

export default function PYQQuizScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { exam } = useExam();
  const { isPro: isPremium } = useRevenueCat();

  const styles = useMemo(() => createStyles(colors), [colors]);

  // Selection Screen States
  const [papers, setPapers] = useState<QuestionPaper[]>([]);
  const [searchText, setSearchText] = useState('');
  const [isTimerMode, setIsTimerMode] = useState(true);
  const [loadingPapers, setLoadingPapers] = useState(true);

  // Play Screen States
  const [selectedPaper, setSelectedPaper] = useState<QuestionPaper | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [showResult, setShowResult] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<number>(0);

  // Fetch Available Question Papers
  const fetchQuestionPapers = useCallback(async () => {
    if (!exam) return;
    setLoadingPapers(true);
    try {
      const { data, error } = await supabase
        .from('question_papers')
        .select('*')
        .eq('exam_id', exam.id)
        .eq('is_active', true)
        .order('year', { ascending: false });

      if (error) throw error;
      setPapers(data || []);
    } catch (err) {
      console.error('Error fetching question papers:', err);
      Alert.alert('Error', 'Failed to load question papers. Please check your connection.');
    } finally {
      setLoadingPapers(false);
    }
  }, [exam]);

  useEffect(() => {
    fetchQuestionPapers();
  }, [fetchQuestionPapers]);

  // Search filter
  const filteredPapers = useMemo(() => {
    return papers.filter((paper) => {
      const titleMatch = paper.title.toLowerCase().includes(searchText.toLowerCase());
      const yearMatch = paper.year ? paper.year.toString().includes(searchText) : false;
      return titleMatch || yearMatch;
    });
  }, [papers, searchText]);

  // Load Questions for Selected Paper
  const handleStartQuiz = async (paper: QuestionPaper) => {
    setSelectedPaper(paper);
    setLoadingQuestions(true);
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setUserAnswers({});
    setShowResult(false);
    setQuizCompleted(false);

    try {
      const isConnected = await checkNetwork();
      if (!isConnected) {
        Alert.alert('Offline', 'Internet connection is required to load question paper quizzes.');
        setSelectedPaper(null);
        setLoadingQuestions(false);
        return;
      }

      let query = supabase
        .from('questions')
        .select(`
          id,
          question_text,
          explanation,
          difficulty,
          domain,
          is_premium,
          question_options (
            id,
            option_text,
            option_letter,
            is_correct
          )
        `)
        .eq('question_paper_id', paper.id);

      if (!isPremium) {
        query = query.eq('is_premium', false);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) {
        Alert.alert('No Questions', 'There are no questions available in this paper at the moment.');
        setSelectedPaper(null);
        setLoadingQuestions(false);
        return;
      }

      // Format questions and shuffle options
      const formattedQuestions = data.map((q: any) => ({
        id: q.id,
        question_text: q.question_text,
        explanation: q.explanation || 'No explanation available.',
        difficulty: q.difficulty || 'medium',
        domain: q.domain || '',
        is_premium: q.is_premium || false,
        options: (q.question_options || []).sort((a: any, b: any) =>
          (a.option_letter || '').localeCompare(b.option_letter || '')
        ),
      }));

      // Shuffle questions to randomize quiz order
      const shuffledQuestions = [...formattedQuestions].sort(() => Math.random() - 0.5);

      setQuestions(shuffledQuestions);
      setStartTime(Date.now());

      if (isTimerMode) {
        // Set time limit: default to paper's duration, otherwise 60 seconds per question
        const duration = paper.duration_minutes
          ? paper.duration_minutes * 60
          : shuffledQuestions.length * 60;
        setTimeLeft(duration);
      } else {
        setTimeLeft(null);
      }
    } catch (err) {
      console.error('Error loading questions:', err);
      Alert.alert('Error', 'Failed to load questions for the selected paper.');
      setSelectedPaper(null);
    } finally {
      setLoadingQuestions(false);
    }
  };

  // Timer Countdown Effect
  useEffect(() => {
    if (timeLeft === null || quizCompleted || !selectedPaper) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          handleQuizComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, quizCompleted, selectedPaper]);

  const handleAnswerSelect = (optionId: string) => {
    setSelectedAnswer(optionId);
  };

  const handleNextQuestion = () => {
    if (!selectedAnswer) return;

    setUserAnswers((prev) => ({
      ...prev,
      [currentQuestionIndex]: selectedAnswer,
    }));

    setShowResult(true);
  };

  const handleContinue = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    } else {
      handleQuizComplete();
    }
  };

  const handleQuizComplete = async () => {
    if (quizCompleted || !user) {
      if (!user) {
        Alert.alert('Not Logged In', 'You must be logged in to save quiz results.');
        setSelectedPaper(null);
      }
      return;
    }

    setQuizCompleted(true);

    try {
      // Calculate score
      let correctAnswers = 0;
      const sessionAnswers = [];

      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        const userAnswerId = userAnswers[i];
        const correctOption = question.options.find((opt) => opt.is_correct);
        const isCorrect = userAnswerId === correctOption?.id;
        if (isCorrect) correctAnswers++;

        sessionAnswers.push({
          question_id: question.id,
          selected_option_id: userAnswerId || null,
          is_correct: isCorrect,
        });
      }

      const timeTaken = Math.floor((Date.now() - startTime) / 1000);

      // Create session obj with quiz_type = 'pyq'
      const sessionObj = {
        user_id: user.id,
        quiz_type: 'pyq',
        score: correctAnswers,
        total_questions: questions.length,
        time_taken_seconds: timeTaken,
        completed_at: new Date().toISOString(),
        exam_id: exam?.id,
      };

      const isConnected = await checkNetwork();
      if (!isConnected) {
        Alert.alert('Offline', 'Cannot save results while offline. Please connect to the internet.');
        setSelectedPaper(null);
        return;
      }

      const { data: sessionData, error: sessionError } = await supabase
        .from('quiz_sessions')
        .insert(sessionObj)
        .select('id')
        .single();

      if (sessionError) throw sessionError;
      if (!sessionData) throw new Error('Failed to create session and get ID.');

      const newSessionId = sessionData.id;

      // Save user answers
      const answersToInsert = sessionAnswers.map((answer) => ({
        ...answer,
        user_id: user.id,
        quiz_session_id: newSessionId,
      }));

      const { error: answersError } = await supabase
        .from('user_answers')
        .insert(answersToInsert);

      if (answersError) throw answersError;

      // Update study stats
      await updateProgress(user.id, {
        questionsAnswered: questions.length,
        correctAnswers,
        timeTaken,
      });

      // Clear states and redirect
      setSelectedPaper(null);
      router.replace(`/results?session=${newSessionId}`);
    } catch (err) {
      console.error('Error completing quiz:', err);
      Alert.alert('Error', 'Failed to save quiz results.');
      setSelectedPaper(null);
    }
  };

  const handleExitQuizPrompt = () => {
    Alert.alert(
      'Exit Quiz',
      'Are you sure you want to end this quiz? Your progress will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Exit',
          style: 'destructive',
          onPress: () => {
            setSelectedPaper(null);
            setQuestions([]);
          },
        },
      ]
    );
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Render Selection Screen
  if (!selectedPaper) {
    return (
      <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft color={colors.text} size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Previous Year Papers</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Search Bar */}
        <View style={styles.searchWrapper}>
          <View style={[styles.searchContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Search size={20} color={colors.subText} style={styles.searchIcon} />
            <TextInput
              placeholder="Search papers by name or year..."
              placeholderTextColor={colors.subText}
              value={searchText}
              onChangeText={setSearchText}
              style={[styles.searchInput, { color: colors.text }]}
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => setSearchText('')}>
                <X size={20} color={colors.subText} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Timer Mode Toggle */}
        <View style={styles.toggleWrapper}>
          <View style={[styles.toggleContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.toggleTextWrapper}>
              <View style={styles.toggleTitleRow}>
                <Clock size={18} color="#FFD700" style={{ marginRight: 6 }} />
                <Text style={[styles.toggleTitle, { color: colors.text }]}>Timer Mode</Text>
              </View>
              <Text style={[styles.toggleSub, { color: colors.subText }]}>
                Simulate real exam pressure with dynamic timing
              </Text>
            </View>
            <Switch
              value={isTimerMode}
              onValueChange={setIsTimerMode}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
            />
          </View>
        </View>

        {/* Question Papers List */}
        {loadingPapers ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.subText }]}>Loading papers...</Text>
          </View>
        ) : filteredPapers.length === 0 ? (
          <ScrollView contentContainerStyle={styles.centeredScroll} showsVerticalScrollIndicator={false}>
            <BookOpen size={64} color={colors.subText} style={{ marginBottom: 16 }} />
            <Text style={[styles.noPapersText, { color: colors.text }]}>No Question Papers Found</Text>
            <Text style={[styles.noPapersSubText, { color: colors.subText }]}>
              No question papers match your query or have been uploaded for this exam.
            </Text>
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
            {filteredPapers.map((paper) => (
              <TouchableOpacity
                key={paper.id}
                style={[styles.paperCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => handleStartQuiz(paper)}
                activeOpacity={0.8}
              >
                <View style={styles.paperCardHeader}>
                  <Text style={[styles.paperTitle, { color: colors.text }]} numberOfLines={2}>
                    {paper.title}
                  </Text>
                  {paper.year && (
                    <LinearGradient
                      colors={['#8A2BE2', '#D97706']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.yearBadge}
                    >
                      <Text style={styles.yearBadgeText}>{paper.year}</Text>
                    </LinearGradient>
                  )}
                </View>

                <View style={styles.paperMetaRow}>
                  <View style={styles.metaItem}>
                    <Clock size={14} color={colors.subText} style={{ marginRight: 4 }} />
                    <Text style={[styles.metaText, { color: colors.subText }]}>
                      {paper.duration_minutes ? `${paper.duration_minutes} mins` : 'Untimed'}
                    </Text>
                  </View>
                  <View style={styles.metaItem}>
                    <HelpCircle size={14} color={colors.subText} style={{ marginRight: 4 }} />
                    <Text style={[styles.metaText, { color: colors.subText }]}>
                      {paper.total_questions ? `${paper.total_questions} Questions` : 'Full Exam'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </LinearGradient>
    );
  }

  // Render Play Screen Loading
  if (loadingQuestions) {
    return (
      <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text, marginTop: 12 }]}>
            Loading questions for {selectedPaper.title}...
          </Text>
        </View>
      </LinearGradient>
    );
  }

  // Render Quiz Play
  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  return (
    <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={[styles.container, { paddingTop: insets.top }]}>
      <View style={[styles.safeArea, { paddingBottom: insets.bottom }]}>
        {/* Play Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleExitQuizPrompt}>
            <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { flex: 1 }]} numberOfLines={1}>
            {selectedPaper.title}
          </Text>
          {timeLeft !== null && (
            <View style={[styles.timerContainer, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
              <Clock size={16} color={colors.primary} strokeWidth={2} />
              <Text style={[styles.timerText, { color: colors.primary }]}>{formatTime(timeLeft)}</Text>
            </View>
          )}
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
            <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: colors.primary }]} />
          </View>
          <Text style={[styles.progressText, { color: colors.subText }]}>
            Question {currentQuestionIndex + 1} of {questions.length}
          </Text>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Question Text */}
          <View style={styles.questionContainer}>
            <View style={styles.questionHeader}>
              <View style={styles.questionMeta}>
                {currentQuestion.is_premium && (
                  <View style={styles.premiumBadge}>
                    <Text style={styles.premiumBadgeText}>PREMIUM</Text>
                  </View>
                )}
                {currentQuestion.difficulty && (
                  <Text style={[styles.difficultyText, { color: colors.primary, backgroundColor: colors.card }]}>
                    {currentQuestion.difficulty.toUpperCase()}
                  </Text>
                )}
                {currentQuestion.domain && (
                  <Text style={[styles.domainText, { color: colors.subText, backgroundColor: colors.inputBg }]}>
                    {currentQuestion.domain}
                  </Text>
                )}
              </View>
            </View>
            <Text style={[styles.questionText, { color: colors.text }]}>
              {currentQuestion.question_text}
            </Text>
          </View>

          {/* Options */}
          <View style={styles.optionsContainer}>
            {currentQuestion.options.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.optionButton,
                  { backgroundColor: colors.inputBg, borderColor: colors.border },
                  selectedAnswer === option.id && [styles.selectedOption, { borderColor: colors.primary, backgroundColor: colors.card }],
                  showResult && option.is_correct && styles.correctOption,
                  showResult && selectedAnswer === option.id && !option.is_correct && styles.incorrectOption,
                ]}
                onPress={() => handleAnswerSelect(option.id)}
                disabled={showResult}
              >
                <View style={styles.optionContent}>
                  <Text style={[styles.optionLetter, { color: colors.text }]}>{option.option_letter}.</Text>
                  <Text style={[styles.optionTextContent, { color: colors.text }]}>{option.option_text}</Text>
                </View>
                {showResult && option.is_correct && (
                  <CheckCircle size={20} color="#10B981" strokeWidth={2} />
                )}
                {showResult && selectedAnswer === option.id && !option.is_correct && (
                  <X size={20} color="#EF4444" strokeWidth={2} />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Explanation */}
          {showResult && (
            <View style={[styles.explanationContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.explanationTitle, { color: colors.text }]}>Explanation</Text>
              <Text style={[styles.explanationText, { color: colors.subText }]}>{currentQuestion.explanation}</Text>
            </View>
          )}
        </ScrollView>

        {/* Action Button Footer */}
        <View style={styles.actionContainer}>
          {!showResult ? (
            <TouchableOpacity
              style={[styles.actionButton, !selectedAnswer && styles.actionButtonDisabled, { backgroundColor: colors.primary }]}
              onPress={handleNextQuestion}
              disabled={!selectedAnswer}
            >
              <Text style={styles.actionButtonText}>Submit Answer</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
              onPress={handleContinue}
            >
              <Text style={styles.actionButtonText}>
                {currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'Complete Quiz'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </LinearGradient>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    safeArea: {
      flex: 1,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: hs(24),
    },
    centeredScroll: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: hs(24),
      paddingBottom: vs(40),
    },
    loadingText: {
      fontSize: ms(16),
      fontWeight: '600',
      marginTop: vs(12),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: hs(20),
      paddingVertical: vs(16),
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
      fontSize: ms(20),
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      flex: 1,
    },
    searchWrapper: {
      paddingHorizontal: hs(20),
      marginBottom: vs(12),
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: ms(12),
      paddingHorizontal: hs(12),
      height: vs(48),
    },
    searchIcon: {
      marginRight: hs(8),
    },
    searchInput: {
      flex: 1,
      fontSize: ms(15),
      paddingVertical: 0,
    },
    toggleWrapper: {
      paddingHorizontal: hs(20),
      marginBottom: vs(16),
    },
    toggleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderRadius: ms(16),
      padding: hs(16),
    },
    toggleTextWrapper: {
      flex: 1,
      marginRight: hs(16),
    },
    toggleTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: vs(4),
    },
    toggleTitle: {
      fontSize: ms(16),
      fontWeight: '700',
    },
    toggleSub: {
      fontSize: ms(13),
      lineHeight: ms(18),
    },
    listContainer: {
      paddingHorizontal: hs(20),
      paddingBottom: vs(32),
      gap: vs(12),
    },
    paperCard: {
      borderWidth: 1,
      borderRadius: ms(16),
      padding: hs(16),
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    paperCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: vs(12),
      gap: hs(8),
    },
    paperTitle: {
      fontSize: ms(16),
      fontWeight: '700',
      flex: 1,
      lineHeight: ms(22),
    },
    yearBadge: {
      borderRadius: ms(8),
      paddingHorizontal: hs(8),
      paddingVertical: vs(4),
    },
    yearBadgeText: {
      color: '#FFFFFF',
      fontSize: ms(12),
      fontWeight: '700',
    },
    paperMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: hs(16),
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    metaText: {
      fontSize: ms(13),
      fontWeight: '500',
    },
    noPapersText: {
      fontSize: ms(18),
      fontWeight: '700',
      marginBottom: vs(8),
      textAlign: 'center',
    },
    noPapersSubText: {
      fontSize: ms(14),
      textAlign: 'center',
      lineHeight: ms(20),
    },
    timerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: hs(12),
      paddingVertical: vs(6),
      borderRadius: ms(8),
      gap: hs(6),
    },
    timerText: {
      fontSize: ms(14),
      fontWeight: '600',
    },
    progressContainer: {
      paddingHorizontal: hs(20),
      paddingVertical: vs(16),
    },
    progressBar: {
      height: vs(4),
      borderRadius: ms(2),
      marginBottom: vs(8),
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: ms(2),
    },
    progressText: {
      fontSize: ms(14),
      textAlign: 'center',
    },
    scrollView: {
      flex: 1,
      paddingHorizontal: hs(20),
    },
    questionContainer: {
      marginBottom: vs(24),
    },
    questionHeader: {
      marginBottom: vs(16),
    },
    questionMeta: {
      flexDirection: 'row',
      gap: hs(12),
      alignItems: 'center',
    },
    premiumBadge: {
      backgroundColor: '#FFD700',
      borderRadius: ms(6),
      paddingHorizontal: hs(8),
      paddingVertical: vs(4),
    },
    premiumBadgeText: {
      color: '#0F172A',
      fontSize: ms(10),
      fontWeight: '700',
    },
    difficultyText: {
      fontSize: ms(11),
      fontWeight: '700',
      paddingHorizontal: hs(8),
      paddingVertical: vs(4),
      borderRadius: ms(6),
    },
    domainText: {
      fontSize: ms(11),
      fontWeight: '500',
      paddingHorizontal: hs(8),
      paddingVertical: vs(4),
      borderRadius: ms(6),
    },
    questionText: {
      fontSize: ms(18),
      fontWeight: '600',
      lineHeight: ms(26),
    },
    optionsContainer: {
      gap: vs(12),
      marginBottom: vs(24),
    },
    optionButton: {
      borderRadius: ms(12),
      padding: hs(16),
      borderWidth: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    selectedOption: {
      borderWidth: 1.5,
    },
    correctOption: {
      borderColor: '#10B981',
      backgroundColor: 'rgba(16, 185, 129, 0.15)',
    },
    incorrectOption: {
      borderColor: '#EF4444',
      backgroundColor: 'rgba(239, 68, 68, 0.15)',
    },
    optionContent: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      marginRight: hs(8),
    },
    optionLetter: {
      fontSize: ms(16),
      fontWeight: '700',
      marginRight: hs(8),
    },
    optionTextContent: {
      fontSize: ms(15),
      fontWeight: '500',
      flex: 1,
      lineHeight: ms(20),
    },
    explanationContainer: {
      borderRadius: ms(16),
      borderWidth: 1,
      padding: hs(16),
      marginBottom: vs(32),
    },
    explanationTitle: {
      fontSize: ms(16),
      fontWeight: '700',
      marginBottom: vs(8),
    },
    explanationText: {
      fontSize: ms(14),
      lineHeight: ms(20),
    },
    actionContainer: {
      paddingHorizontal: hs(20),
      paddingVertical: vs(16),
    },
    actionButton: {
      height: vs(50),
      borderRadius: ms(12),
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    actionButtonDisabled: {
      opacity: 0.5,
    },
    actionButtonText: {
      color: '#FFFFFF',
      fontSize: ms(16),
      fontWeight: '700',
    },
  });
