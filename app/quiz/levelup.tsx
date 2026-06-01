import { useAuth } from '@/contexts/AuthContext';
import { useExam } from '@/contexts/ExamContext';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useLevelUpAccuracy } from '@/hooks/useLevelUpAccuracy';
import { useQuizModes } from '@/lib/QuizModes';
import { supabase } from '@/lib/supabase';
import { checkNetwork } from '@/utils/offlineSync';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { AlertCircle, ArrowRight, BookOpen, ChevronLeft, Crown, RefreshCcw } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';


import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Responsive utility functions
const { width, height } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;
const hs = (size: number) => (width / guidelineBaseWidth) * size;
const vs = (size: number) => (height / guidelineBaseHeight) * size;
const ms = (size: number, factor = 0.5) => size + (hs(size) - size) * factor;

import ConfettiCannon from 'react-native-confetti-cannon';
import * as Progress from 'react-native-progress';
// Lottie for celebration animations
import LottieView from 'lottie-react-native';

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  domain: string;
  options: {
    id: string;
    option_text: string;
    option_letter: string;
    is_correct: boolean;
  }[];
}

const STAGES: Question['difficulty'][] = ['easy', 'medium', 'hard'];

const getDifficultyStyle = (difficulty: Question['difficulty']) => {
  switch (difficulty) {
    case 'easy':
      return { backgroundColor: 'rgba(52, 211, 153, 0.2)', textColor: '#A7F3D0' }; // Light Green
    case 'medium':
      return { backgroundColor: 'rgba(250, 204, 21, 0.2)', textColor: '#FDE68A' }; // Light Yellow
    case 'hard':
      return { backgroundColor: 'rgba(248, 113, 113, 0.2)', textColor: '#FECACA' }; // Light Red
    default:
      return { backgroundColor: '#334155', textColor: '#E2E8F0' };
  }
};

// Animation assets (replace with your own Lottie files if available)
const stageCelebrations = [
  null, // require('@/assets/animations/celebrate_easy.json'),
  null, // require('@/assets/animations/celebrate_medium.json'),
  null, // require('@/assets/animations/celebrate_hard.json'),
];
const finalCelebration = null; // require('@/assets/animations/final_celebration.json');

import { BarChart, Clock, Sparkles, Target, Trophy } from 'lucide-react-native';

export default function LevelUpQuizScreen() {
  const { exam } = useExam();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { isPro } = useRevenueCat();
  const [stagePassed, setStagePassed] = useState<boolean | null>(null); // null=not completed, true=pass, false=fail
  const [stageFailInfo, setStageFailInfo] = useState<any>(null);
  const [lastSessionId, setLastSessionId] = useState<string | null>(null);
  const [lastStageTime, setLastStageTime] = useState<number | null>(null);
  const [pendingStageResult, setPendingStageResult] = useState<{ score: number; total: number } | null>(null);
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [stageCompleted, setStageCompleted] = useState(false);
  const [allStagesCompleted, setAllStagesCompleted] = useState(false);
  const [userAnswers, setUserAnswers] = useState<any[]>([]); // Track answers for current stage
  const [stageStartTime, setStageStartTime] = useState<number | null>(null); // For timing
  const confettiRef = useRef<ConfettiCannon>(null);
  const lottieRef = useRef<LottieView>(null);
  const [questionAnim] = useState(new Animated.Value(1));
  const { accuracyData, isLevelUpLoading, error, refresh } = useLevelUpAccuracy(user?.id, exam?.id);
  const { data: rawQuizModes = [], isLoading: isQuizModesLoading, isError: isQuizModesError } = useQuizModes() as any;
  const insets = useSafeAreaInsets();

  const fetchUserStage = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('user_progress')
      .select('level_up_stage')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching user stage:', error);
      Alert.alert('Error', 'Could not fetch your current level.');
      router.back();
    } else {
      // setStageIndex(data?.level_up_stage?.[exam?.id] || 0);
      setStageIndex(data?.level_up_stage?.[exam?.id] ?? 0);
    }
  }, [user]);

  // Fisher-Yates shuffle
  function shuffleArray<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  const renderPremiumBanner = () => {
    const isPremium = isPro;
    if (isPremium) return null;
    return (
      <View style={styles.premiumBanner}>
        <Crown size={20} color="#F59E0B" strokeWidth={2} />
        <Text style={styles.premiumBannerText}>
          Free Plan: Access limited.
        </Text>
        <TouchableOpacity style={styles.upgradeButtonSmall} onPress={() => router.push('/subscription')}>
          <Text style={styles.upgradeButtonTextSmall}>Upgrade</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const fetchQuestions = useCallback(async () => {
    if (!user) return;

    const isConnected = await checkNetwork();
    if (!isConnected) {
      Alert.alert('Offline', 'Level Up mode requires an active internet connection.');
      setLoading(false);
      router.back();
      return;
    }

    if (stageIndex >= STAGES.length) {
      setAllStagesCompleted(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    const currentDifficulty = STAGES[stageIndex];

    // Step 1: Get previous correctly answered question IDs from level_up sessions (never repeat)
    const { data: levelUpSessions, error: sessionError } = await supabase
      .from('quiz_sessions')
      .select('id, completed_at')
      .eq('user_id', user.id)
      .eq('exam_id', exam?.id)
      .eq('quiz_type', 'level_up')
      .order('completed_at', { ascending: false });

    const levelUpSessionIds = levelUpSessions?.map(s => s.id) || [];

    const { data: correctAnswers, error: answersError } = await supabase
      .from('user_answers')
      .select('question_id')
      .eq('user_id', user.id)
      .eq('is_correct', true)
      .in('quiz_session_id', levelUpSessionIds.length > 0 ? levelUpSessionIds : ['no-match']);

    const correctQuestionIds = correctAnswers?.map(a => a.question_id) || [];

    // Step 2: Get recently wrong question IDs (cool-down: last 2 level_up sessions)
    const recentSessionIds = levelUpSessionIds.slice(0, 2); // already sorted desc
    let recentlyWrongIds: string[] = [];
    if (recentSessionIds.length > 0) {
      const { data: recentWrong } = await supabase
        .from('user_answers')
        .select('question_id')
        .in('quiz_session_id', recentSessionIds)
        .eq('is_correct', false);
      recentlyWrongIds = recentWrong?.map(a => a.question_id) || [];
    }

    // Combine all IDs to exclude
    const allExcludeIds = [...new Set([...correctQuestionIds, ...recentlyWrongIds])];

    // Step 3: Fetch new questions excluding correctly answered AND recently wrong
    let query = supabase
      .from('questions')
      .select('*, options:question_options(*)')
      .eq('difficulty', currentDifficulty)
      .eq('exam', exam?.id)
      .eq('question_type', 'multiple_choice');

    if (allExcludeIds.length > 0) {
      query = query.not('id', 'in', `(${allExcludeIds.join(',')})`);
    }

    const isPremium = isPro;
    if (!isPremium) {
      query = query.eq('is_premium', false);
    }

    const { data: questions, error: questionError } = await query.limit(rawQuizModes[3]?.num_questions);

    if (questionError) {
      console.error('Error fetching questions:', questionError);
      Alert.alert('Error', 'Failed to load questions.');
      setQuestions([]);
    } else {
      // Shuffle questions but sort options alphabetically
      let shuffledQuestions = shuffleArray(questions || []).map(q => ({
        ...q,
        options: (q.options || []).sort((a: any, b: any) =>
          (a.option_letter || '').localeCompare(b.option_letter || '')
        )
      }));

      // Double-check premium filtering
      if (!isPremium) {
        shuffledQuestions = shuffledQuestions.filter(q => q.is_premium === false);
      }

      setQuestions(shuffledQuestions);
      setStageStartTime(Date.now());
    }
    setLoading(false);
  }, [user, stageIndex, rawQuizModes, isPro]);

  useEffect(() => {
    fetchUserStage();
  }, [fetchUserStage]);

  useEffect(() => {
    if (user) {
      fetchQuestions();
    }
  }, [user, stageIndex, fetchQuestions]);

  useEffect(() => {
    // Process the stage result once accuracy data is refreshed
    if (pendingStageResult && accuracyData) {
      const currentStageName = STAGES[stageIndex];
      if (!accuracyData[currentStageName]) return;

      const { score, total } = pendingStageResult;
      const latestAccuracy = accuracyData[currentStageName].accuracy;
      const newStageIndex = stageIndex + 1;

      // if (latestAccuracy >= 70) {
      //   setStagePassed(true);
      //   // Update user progress in Supabase
      //   const updateUserProgress = async () => {
      //     if (user) {
      //       const { error: updateError } = await supabase
      //         .from('user_progress')
      //         .upsert({ user_id: user.id, level_up_stage: newStageIndex, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      //       if (updateError) {
      //         console.error('Error updating stage:', updateError);
      //         Alert.alert('Error', 'Could not save your progress.');
      //       }
      //     }
      //   };
      //   updateUserProgress();
      // } 
      if (latestAccuracy >= 70) {
        setStagePassed(true);

        // Update user progress in Supabase using RPC
        const updateUserProgress = async () => {
          if (user && exam?.id) {
            const { error: updateError } = await supabase.rpc('update_exam_stage', {
              uid: user.id,
              exam_id: exam.id,
              new_stage: newStageIndex,
            });

            if (updateError) {
              console.error('Error updating stage:', updateError);
              Alert.alert('Error', 'Could not save your progress.');
            }
          }
        };

        updateUserProgress();
      }
      else {
        setStagePassed(false);
        setStageFailInfo({
          score,
          total,
          percentage: latestAccuracy.toFixed(0),
          reason: `Your total accuracy is (${latestAccuracy.toFixed(0)}%). You need at least 70% to pass this stage.`,
        });
      }
      // Reset the pending state
      setPendingStageResult(null);
    }
  }, [pendingStageResult, accuracyData]);

  const handleAnswer = (optionId: string, _isCorrectOption: boolean) => {
    // Only record the selection for now; do not reveal correctness yet.
    setSelectedOption(optionId);
  };


  const resetLevels = () => {
    if (!user) return;

    Alert.alert(
      "Reset Level Up Progress",
      "Warning: This will permanently erase:\n\n• Your Level Up quiz history\n• All performance statistics for this mode\n• Your current Level Up stage and progress\n\nThis action cannot be undone. Do you want to proceed?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            try {
              // 1. Reset level_up_stage
              console.log('[LevelUpScreen] Resetting level for:', { uid: user?.id, examId: exam?.id });

              const { error: updateError } = await supabase.rpc("update_exam_stage", {
                uid: user?.id,
                exam_id: exam?.id,
                new_stage: 0, // reset current exam only
              });

              if (updateError) {
                console.error('[LevelUpScreen] RPC Error:', updateError);
                throw updateError;
              }
              console.log('[LevelUpScreen] Level reset RPC successful');

              // 2. Get all level_up session IDs
              const { data: sessions, error: sessionError } = await supabase
                .from('quiz_sessions')
                .select('id')
                .eq('user_id', user.id)
                .eq('exam_id', exam?.id)
                .eq('quiz_type', 'level_up');

              if (sessionError) throw sessionError;

              const sessionIds = (sessions ?? []).map((s) => s.id);

              if (sessionIds.length > 0) {
                // 3. Delete related user_answers
                const { error: answerDeleteError } = await supabase
                  .from('user_answers')
                  .delete()
                  .in('quiz_session_id', sessionIds);

                if (answerDeleteError) throw answerDeleteError;

                // 4. Delete level_up sessions
                const { error: sessionDeleteError } = await supabase
                  .from('quiz_sessions')
                  .delete()
                  .in('id', sessionIds);

                if (sessionDeleteError) throw sessionDeleteError;
              }

              // 5. Reset local frontend states
              ToastAndroid.show('Level Up progress reset successfully', ToastAndroid.SHORT);
              setStageIndex(0);
              setScore(0);
              setCurrentQuestionIndex(0);
              setUserAnswers([]);
              setStageCompleted(false);
              setAllStagesCompleted(false);
            } catch (err) {
              console.error('Error resetting Level Up progress:', err);
              Alert.alert('Error', 'Could not reset your Level Up data.');
            }
          }
        }
      ]
    );
  };


  const handleNext = async () => {
    // Phase 1: If feedback not shown yet, reveal correctness and explanation
    if (!showExplanation) {
      if (!selectedOption) return;
      const correctId = questions[currentQuestionIndex]?.options.find(o => o.is_correct)?.id;
      const wasCorrect = selectedOption === correctId;
      setIsCorrect(wasCorrect);
      if (wasCorrect) {
        setScore(prev => prev + 1);
      }
      // Track answer now (when revealing feedback)
      setUserAnswers(prev => [
        ...prev,
        {
          question_id: questions[currentQuestionIndex]?.id,
          selected_option_id: selectedOption,
          is_correct: wasCorrect,
          answered_at: new Date().toISOString(),
        },
      ]);
      setShowExplanation(true);
      return;
    }

    // Phase 2: Feedback already shown -> move to next question or finish
    setShowExplanation(false);
    setSelectedOption(null);
    setIsCorrect(null);

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // Calculate time taken
      const now = Date.now();
      const timeTakenSeconds = stageStartTime ? Math.round((now - stageStartTime) / 1000) : 0;
      setStageCompleted(true);

      confettiRef.current?.start();
      if (user) {
        const newStageIndex = stageIndex + 1;
        // 1. Insert quiz session
        let sessionId = null;
        try {
          const { data: sessionData, error: sessionError } = await supabase
            .from('quiz_sessions')
            .insert([
              {
                user_id: user.id,
                quiz_type: 'level_up',
                score: score,
                total_questions: questions.length,
                time_taken_seconds: timeTakenSeconds,
                completed_at: new Date().toISOString(),
                exam_id: exam?.id,
              },
            ])
            .select('id')
            .single();
          if (sessionError) throw sessionError;
          sessionId = sessionData.id;
        } catch (err) {
          console.error('Error creating quiz session:', err);
          Alert.alert('Error', 'Could not save your quiz session.');
          return;
        }
        // 2. Insert user answers
        try {
          const answersToInsert = userAnswers.map(ans => ({
            ...ans,
            user_id: user.id,
            quiz_session_id: sessionId,
          }));
          const { error: answersError } = await supabase.from('user_answers').insert(answersToInsert);
          if (answersError) throw answersError;
        } catch (err) {
          console.error('Error saving answers:', err);
          Alert.alert('Error', 'Could not save your answers.');
          // Don't return; still update progress
        }
        // After saving, refresh accuracy and compute pass/fail
        setLastSessionId(sessionId);
        setLastStageTime(timeTakenSeconds);
        await refresh();
        setPendingStageResult({ score, total: questions.length });
      }
    }
  };

  const handleNextStage = () => {
    setStageCompleted(false);
    // setShowStageResults(false);
    setCurrentQuestionIndex(0);
    setScore(0);
    setUserAnswers([]); // Reset answers for new stage
    setStageStartTime(Date.now()); // Start timing for next stage
    setStageIndex(stageIndex + 1);
  };
  if (stageIndex == 3) {
    return (
      <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={[styles.container, { paddingTop: insets.top }]}>
        <View style={[styles.safeArea, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <ChevronLeft color={colors.text} size={24} />
            </TouchableOpacity>
          </View>
          <View style={{ ...styles.centered, flex: 0.9 }}>
            <Text style={styles.noQuestionsText}>Congratulations 🎉</Text>
            <Text style={styles.noQuestionsSubText}>You've completed all levels!</Text>
            <View style={{ justifyContent: 'space-between', flexDirection: 'row', gap: hs(30) }}>
              <Text style={{ color: colors.primary, fontSize: 16, marginTop: 16, fontWeight: 'bold' }} onPress={() => router.back()}>Back</Text>
              <Text style={{ color: colors.primary, fontSize: 16, marginTop: 16, fontWeight: 'bold' }} onPress={() => resetLevels()}>Reset levels</Text>
            </View>
          </View>
        </View>
      </LinearGradient>
    )
  }
  if (allStagesCompleted) {
    return (
      <LinearGradient colors={['#0F172A', '#1E293B']} style={[styles.container, { paddingTop: insets.top }]}>
        <View style={[styles.safeArea, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <ChevronLeft color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.centered}>
            <Text style={[styles.noQuestionsText, { fontSize: ms(22) }]}>Congratulations!</Text>
            <Text style={styles.noQuestionsSubText}>You've completed all levels!</Text>
          </View>
        </View>
      </LinearGradient>
    );
  }

  if (loading) {
    return (
      <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={[styles.container, { paddingTop: insets.top }]}>
        <View style={[{ ...styles.centered, flex: 0.9, paddingBottom: insets.bottom + 20 }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { fontSize: ms(16) }]}>
            {STAGES[stageIndex] ? `Loading ${STAGES[stageIndex]} questions...` : 'Loading...'}
          </Text>
        </View>
      </LinearGradient>
    );
  }
  if (pendingStageResult) {
    return (
      <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={[styles.container, { paddingTop: insets.top }]}>
        <View style={[styles.safeArea, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <ChevronLeft color={colors.text} size={24} />
            </TouchableOpacity>
          </View>
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.noQuestionsText, { fontSize: ms(22) }]}>Processing...</Text>
            <Text style={styles.noQuestionsSubText}>Please wait while we process your results.</Text>
          </View>
        </View>
      </LinearGradient>
    )
  }
  if (stageCompleted && stagePassed !== null && !pendingStageResult) {
    return (
      <StageResult
        passed={stagePassed}
        accuracyData={accuracyData}
        stageIndex={stageIndex}
        score={score}
        totalQuestions={questions.length}
        timeTaken={lastStageTime}
        onNextStage={handleNextStage}
        onRetry={() => {
          setUserAnswers([]);
          setStageCompleted(false);
          setCurrentQuestionIndex(0);
          setScore(0);
          fetchQuestions();
        }}
        onBack={() => router.back()}
      />
    );
  }
  //   if (stageCompleted && false) {
  //     const currentStageName = STAGES[stageIndex];
  //     const isLastStage = stageIndex >= STAGES.length - 1;

  //     return (
  //       <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.container}>
  //         <SafeAreaView style={styles.safeArea}>
  //           <ScrollView
  //             contentContainerStyle={{ justifyContent: 'center', alignItems: 'center', paddingVertical: vs(24), flex: 0.9 }}
  //             keyboardShouldPersistTaps="handled"
  //             showsVerticalScrollIndicator={false}
  //           >
  //             {!stagePassed && stageFailInfo && (
  //               <View style={{ width: '100%', backgroundColor: '#1e293b', borderRadius: ms(16), padding: hs(20), alignItems: 'center', borderWidth: 2, borderColor: '#dc2626',flex:1}}>
  //                 <View style={{ backgroundColor: '#dc2626', borderRadius: 50, padding: 18, marginBottom: vs(10) }}>
  //                   <Text style={{ fontSize: ms(32), color: '#fff' }}>❌</Text>
  //                 </View>
  //                 <Text style={{ color: '#dc2626', fontWeight: 'bold', fontSize: ms(22), marginBottom: vs(8) }}>Stage Not Passed</Text>
  //                 <Text style={{ color: '#fff', fontSize: ms(16), marginBottom: vs(8), textAlign: 'center' }}>{stageFailInfo.reason}</Text>
  //                 {/* Stats Grid */}
  //                 <View style={{marginTop:vs(40)}}>

  //                 <StatsGrid
  //                   accuracy={((score / questions.length) * 100).toFixed(0)}
  //                   score={score}
  //                   total={questions.length}
  //                   timeInMinutes={lastStageTime ? Number((lastStageTime/60).toFixed(1)) : 0}
  //                   />
  //                   {!isLevelUpLoading && accuracyData && accuracyData[currentStageName] ? (
  //                     <View>
  //                     <Text style={{ color: '#fff', fontSize: ms(20), marginBottom: vs(8), textAlign: 'center' ,fontWeight:'bold',marginTop:vs(20)}}>
  //                       Overall Stats </Text>
  //                     <StatsGrid 
  //                       accuracy={Number(accuracyData[currentStageName].accuracy).toFixed(0)}
  //                       score={accuracyData[currentStageName].correct}
  //                       total={accuracyData[currentStageName].total}
  //                       timeInMinutes={lastStageTime ? Number((lastStageTime/60).toFixed(1)) : 0}
  //                       isOverall={true}
  //                       />
  //                       </View>
  // ) : null}
  //                   {isLevelUpLoading && <><ActivityIndicator size="large" color="#fff" /> <Text style={{ color: '#fff', fontSize: ms(16), marginBottom: vs(8), textAlign: 'center' }}>Loading...</Text></>}
  //                   {!accuracyData && <Text style={{ color: '#fff', fontSize: ms(16), marginBottom: vs(8), textAlign: 'center' }}>No accuracy data available</Text>}
  //                   </View>
  //                 <View style={{ flexDirection: 'row', gap: hs(12), marginTop: vs(16) }}>
  //                   <TouchableOpacity style={[styles.nextStageButton, { backgroundColor: '#dc2626', padding:vs(10) }]} onPress={() => {
  //                     setCurrentQuestionIndex(0);
  //                     setScore(0);
  //                     setUserAnswers([]);
  //                     setStageCompleted(false);
  //                     setStageFailInfo(null);
  //                     setStagePassed(null);
  //                     fetchQuestions();
  //                   }}>
  //                     <Text style={styles.nextStageButtonText}>Try Again</Text>
  //                   </TouchableOpacity>
  //                   {/* {lastSessionId && (
  //                     <TouchableOpacity style={[styles.nextStageButton, { backgroundColor: '#334155', padding:vs(10) }]} onPress={() => router.push(`/results?session=${lastSessionId}&mode=level_up`)}>
  //                       <Text style={styles.nextStageButtonText}>View Result</Text>
  //                     </TouchableOpacity>
  //                   )} */}
  //                 </View>
  //               </View>
  //             )} 
  //             {stagePassed && (
  //               <>
  //                 <View style={{ width: '100%', backgroundColor: '#1e293b', borderRadius: ms(16), padding: hs(20), alignItems: 'center', borderWidth: 2, borderColor: '#22c55e',flex:1}}>
  //                 <ConfettiCannon count={200} origin={{ x: -10, y: 0 }} autoStart={true} ref={confettiRef} fadeOut={true}/>
  //                   <View style={{ backgroundColor: '#22c55e', borderRadius: 50, padding: 18, marginBottom: vs(10) }}>
  //                     <Text style={{ fontSize: ms(32), color: '#fff' }}>🏆</Text>
  //                   </View>
  //                   <Text style={{ color: '#22c55e', fontWeight: 'bold', fontSize: ms(22), marginBottom: vs(8) }}>{currentStageName.toUpperCase()} Stage Complete!</Text>
  //                   {/* <Text style={{ color: '#fff', fontSize: ms(16), marginBottom: vs(8) }}>Your Score: {score} / {questions.length}</Text> */}
  //                   <Text style={{ color: '#fff', fontSize: ms(20),textAlign: 'center' ,fontWeight:'bold',marginTop:vs(20)}}>
  //                       Current Assessment </Text>
  //                   {/* Stats Grid */}
  //                   <View style={{marginTop:vs(40)}}>

  //                   <StatsGrid
  //                     accuracy={((score / questions.length) * 100).toFixed(0)}
  //                     score={score}
  //                     total={questions.length}
  //                     timeInMinutes={lastStageTime ? Number((lastStageTime / 60).toFixed(1)) : 0}
  //                     />

  //                   {!isLevelUpLoading &&accuracyData && accuracyData[currentStageName] ? (
  //                     <View>
  //                     <Text style={{ color: '#fff', fontSize: ms(20), marginBottom: vs(8), textAlign: 'center' ,fontWeight:'bold',marginTop:vs(20)}}>
  //                       Overall Stats </Text>
  //                     <StatsGrid 
  //                       accuracy={Number(accuracyData[currentStageName].accuracy).toFixed(0)}
  //                       score={accuracyData[currentStageName].correct}
  //                       total={accuracyData[currentStageName].total}
  //                       timeInMinutes={lastStageTime ? Number((lastStageTime/60).toFixed(1)) : 0}
  //                       isOverall={true}
  //                       />
  //                       </View>
  //                   ) : null}
  //                   {isLevelUpLoading && <View><ActivityIndicator size="large" color="#fff" /> <Text style={{ color: '#fff', fontSize: ms(16), marginBottom: vs(8), textAlign: 'center' }}>Loading...</Text></View>}
  //                   {!accuracyData && <Text style={{ color: '#fff', fontSize: ms(16), marginBottom: vs(8), textAlign: 'center' }}>No accuracy data available</Text>}


  //                     </View>
  //                   <View style={{ flexDirection: 'row', gap: hs(12), marginTop: vs(16) }}>
  //                     {!isLastStage ? (
  //                       <TouchableOpacity style={[styles.nextStageButton, { flex: 1 }]} onPress={handleNextStage}>
  //                         <Text style={styles.nextStageButtonText}>Continue</Text>
  //                       </TouchableOpacity>
  //                     ) : (
  //                       <TouchableOpacity style={[styles.nextStageButton, { flex: 1 }]} onPress={() => router.replace('/(tabs)')}>
  //                         <Text style={styles.nextStageButtonText}>Finish</Text>
  //                       </TouchableOpacity>
  //                     )}
  //                     {/* {lastSessionId && (
  //                       <TouchableOpacity style={[styles.nextStageButton, { backgroundColor: '#334155', flex: 1 }]} onPress={() => router.push(`/results?session=${lastSessionId}&mode=level_up`)}>
  //                         <Text style={styles.nextStageButtonText}>View Result</Text>
  //                       </TouchableOpacity>
  //                     )} */}
  //                   </View>
  //                 </View>
  //               </>
  //             )} 
  //           </ScrollView>
  //         </View>
  //       </LinearGradient>
  //     );
  //   }

  if (questions.length === 0) {
    const isPremium = isPro;
    return (
      <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={[styles.container, { paddingTop: insets.top }]}>
        <View style={[styles.safeArea, { paddingBottom: insets.bottom }]}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <ChevronLeft color={colors.text} size={24} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: hs(24), paddingBottom: vs(40) }}
            showsVerticalScrollIndicator={false}
          >
            <View style={{ marginBottom: vs(24), position: 'relative', marginTop: vs(20) }}>
              <BookOpen size={ms(64)} color={colors.primary} strokeWidth={1.5} />
              <View style={{ position: 'absolute', bottom: -5, right: -5, backgroundColor: colors.background, borderRadius: 50, padding: 2 }}>
                <AlertCircle size={ms(24)} color="#EF4444" fill={colors.background} />
              </View>
            </View>

            <Text style={[styles.noQuestionsText, { color: colors.text, marginBottom: vs(8) }]}>No Questions Available</Text>
            <Text style={[styles.noQuestionsSubText, { color: colors.subText, marginBottom: vs(32) }]}>
              It looks like there are no {STAGES[stageIndex]} questions ready for you yet.
            </Text>

            {!isPremium && (
              <View style={{
                width: '100%',
                backgroundColor: colors.card,
                borderRadius: ms(16),
                padding: hs(20),
                alignItems: 'center',
                borderWidth: 1,
                borderColor: colors.border,
                marginBottom: vs(24),
                // Premium gold tint
                shadowColor: "#FFD700",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
                elevation: 2,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: vs(8), gap: hs(8) }}>
                  <Crown size={ms(20)} color="#FFD700" fill="#FFD700" />
                  <Text style={{ fontSize: ms(16), fontWeight: '700', color: colors.text }}>Go Premium</Text>
                </View>
                <Text style={{ fontSize: ms(14), color: colors.subText, textAlign: 'center', lineHeight: ms(20), marginBottom: vs(16) }}>
                  Upgrade to unlock unlimited questions and practice without limits.
                </Text>

                <TouchableOpacity
                  style={{
                    backgroundColor: '#FFD700',
                    width: '100%',
                    paddingVertical: vs(12),
                    borderRadius: ms(10),
                    alignItems: 'center',
                  }}
                  onPress={() => router.push('/subscription')}>
                  <Text style={{ color: '#0F172A', fontWeight: '700', fontSize: ms(14), textTransform: 'uppercase' }}>Unlock Now</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={{
                width: '100%',
                paddingVertical: vs(14),
                paddingHorizontal: hs(20),
                borderRadius: ms(12),
                borderWidth: 1,
                borderColor: colors.border,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: hs(8),
                backgroundColor: colors.card,
              }}
              onPress={handleNextStage}
            >
              <Text style={{ color: colors.text, fontSize: ms(16), fontWeight: '600' }}>Skip to {STAGES[stageIndex + 1] ? STAGES[stageIndex + 1] : 'Next'} Stage</Text>
              <ChevronLeft size={ms(20)} color={colors.text} style={{ transform: [{ rotate: '180deg' }] }} />
            </TouchableOpacity>
          </ScrollView>
        </View>
      </LinearGradient>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = (currentQuestionIndex + 1) / questions.length;
  const { backgroundColor, textColor } = getDifficultyStyle(currentQuestion.difficulty);
  const currentStageName = STAGES[stageIndex];



  return (
    <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={[styles.container, { paddingTop: insets.top }]}>
      <View style={[styles.safeArea, { paddingBottom: 0 }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft color={colors.text} size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Level Up - {currentStageName.toUpperCase()}</Text>
        </View>

        {renderPremiumBanner()}
        <Progress.Bar progress={progress} width={null} style={styles.progressBar} color={colors.primary} unfilledColor={colors.border} borderWidth={0} />
        <Text style={{ color: colors.subText, fontSize: ms(14), textAlign: 'center', marginTop: vs(4), marginBottom: vs(14) }}>{currentQuestionIndex + 1} of {questions.length}</Text>
        <ScrollView
          contentContainerStyle={{ paddingBottom: vs(32) }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[styles.quizContainer, { opacity: questionAnim }]}>
            <Text style={styles.questionText}>{currentQuestion.question_text}</Text>

            {currentQuestion.options.map((option, index) => {
              const letter = String.fromCharCode(65 + index); // Converts 0 to 'A', 1 to 'B', etc.
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.optionButton,
                    // Gold highlight for selected option before feedback
                    !showExplanation && selectedOption === option.id && styles.selectedOption,
                    // Only show correctness styles after feedback is revealed
                    showExplanation && (
                      option.id === selectedOption
                        ? (isCorrect ? styles.correctOption : styles.incorrectOption)
                        : (!isCorrect && option.is_correct ? styles.correctOption : undefined)
                    ),
                    // Dim other options only after feedback is shown
                    showExplanation && selectedOption && selectedOption !== option.id && styles.disabledOption
                  ]}
                  onPress={() => handleAnswer(option.id, option.is_correct)}
                  disabled={showExplanation}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ marginRight: 20 }}>
                      <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: ms(15) }}>{letter}.</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.optionText}>{option.option_text}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}

            {showExplanation && (
              <View style={styles.explanationContainer}>
                <Text style={styles.explanationTitle}>Explanation</Text>
                <Text style={styles.explanationText}>{currentQuestion.explanation}</Text>
              </View>
            )}
          </Animated.View>
        </ScrollView>

        {/* Fixed Bottom Footer */}
        <View style={[styles.footerAction, { paddingBottom: Math.max(insets.bottom, 20) + vs(10) }]}>
          {!showExplanation ? (
            <TouchableOpacity
              style={[styles.startQuizButtonLarge, !selectedOption && { opacity: 0.5 }]}
              onPress={handleNext}
              disabled={!selectedOption}
            >
              <LinearGradient
                colors={[colors.primary, colors.secondary]}
                style={styles.actionButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.footerButtonText}>Submit Answer</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.startQuizButtonLarge}
              onPress={handleNext}
            >
              <LinearGradient
                colors={[colors.primary, colors.secondary]}
                style={styles.actionButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.footerButtonText}>Next</Text>
                {/* <ChevronLeft size={24} color="#0F172A" style={{ transform: [{ rotate: '180deg' }] }} /> */}
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </LinearGradient >
  );
  // ...
}



interface StageResultProps {
  passed: boolean;
  accuracyData: any;
  stageIndex: number;
  score: number;
  totalQuestions: number;
  timeTaken: number | null;
  onNextStage: () => void;
  onRetry: () => void;
  onBack: () => void;
}

function StageResult({
  passed,
  accuracyData,
  stageIndex,
  score,
  totalQuestions,
  timeTaken,
  onNextStage,
  onRetry,
  onBack,
}: StageResultProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const currentStage = STAGES[stageIndex];
  const overallAccuracy = accuracyData?.[currentStage]?.accuracy.toFixed(0) || '...';
  const thisRoundAccuracy = totalQuestions > 0 ? ((score / totalQuestions) * 100).toFixed(0) : '0';

  const resultTitle = passed ? "Stage Passed!" : "Stage Failed";
  const resultColor = passed ? '#22C55E' : '#EF4444';
  const resultIcon = passed ? '🎉' : '😔';

  const stats = [
    { icon: Trophy, label: 'Overall Score', value: `${accuracyData?.[currentStage]?.correct}/${accuracyData?.[currentStage]?.total}` },
    { icon: Sparkles, label: 'This Round Score', value: `${score}/${totalQuestions}` },
    { icon: BarChart, label: 'Overall Acc.', value: `${overallAccuracy}%` },
    { icon: Target, label: 'This Round', value: `${thisRoundAccuracy}%` },
    { icon: Clock, label: 'Time', value: `${timeTaken ? Number((timeTaken / 60).toFixed(1)) : 0}m` },

  ];

  return (
    <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={[styles.container, { paddingTop: insets.top }]}>
      <View style={[styles.safeArea, { paddingBottom: 0 }]}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            alignItems: 'center',
            paddingHorizontal: hs(20),
            paddingBottom: vs(120),
            paddingTop: vs(20)
          }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.resultCard}>
            <Text style={styles.resultIcon}>{resultIcon}</Text>
            <Text style={[styles.resultTitle, { color: resultColor }]}>{resultTitle}</Text>

            {passed ? (
              <Text style={styles.resultSubtitle}>
                Congratulations! You've mastered the <Text style={{ fontWeight: 'bold' }}>{currentStage}</Text> stage.
              </Text>
            ) : (
              <Text style={styles.resultSubtitle}>
                Don't worry, you can try again. You need <Text style={{ fontWeight: 'bold' }}>70%</Text> overall accuracy to pass.
              </Text>
            )}

            <View style={styles.divider} />

            <Text style={styles.statsHeader}>Stage Statistics</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 10 }}>
              <Text style={{ color: colors.subText }}>Overall score</Text>
              <Text style={{ color: colors.subText }}>{accuracyData?.[currentStage]?.correct}/{accuracyData?.[currentStage]?.total}</Text>
            </View>
            <View style={{ width: '100%', height: 10, backgroundColor: colors.border, borderRadius: 5 }}>
              <View style={{ width: `${overallAccuracy}%`, height: 10, backgroundColor: overallAccuracy < 40 ? '#EF4444' : overallAccuracy < 70 ? '#8A2BE2' : '#22C55E', borderRadius: 5 }}></View>
            </View>
            <StatsGrid items={stats} />
          </View>
        </ScrollView>

        {/* Fixed Footer for Result Actions */}
        <View style={[styles.footerAction, { paddingBottom: Math.max(insets.bottom, 20) + vs(10) }]}>
          {passed ? (
            <TouchableOpacity
              style={styles.startQuizButtonLarge}
              onPress={onNextStage}
            >
              <LinearGradient
                colors={['#22C55E', '#15803D']} // Green Gradient
                style={styles.actionButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.footerButtonText}>Next Stage</Text>
                <ArrowRight size={24} color="#FFFFFF" strokeWidth={2.5} />
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.startQuizButtonLarge}
              onPress={onRetry}
            >
              <LinearGradient
                colors={['#8A2BE2', '#D97706']} // Orange/Gold Gradient
                style={styles.actionButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.footerButtonText}>Try Again</Text>
                <RefreshCcw size={24} color="#FFFFFF" strokeWidth={2.5} />
              </LinearGradient>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16, alignItems: 'center' }}>
            <Text style={[styles.backLink, { fontSize: ms(16), fontWeight: '600', color: colors.subText }]}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  );
}

interface StatsGridProps {
  items: { icon: React.ElementType; label: string; value: string }[];
}

function StatsGrid({ items }: StatsGridProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.statsGrid}>
      {items.map((item, index) => (
        <View key={index} style={styles.statGridItem}>
          <item.icon color={colors.subText} size={ms(24)} />
          <Text style={styles.statGridLabel}>{item.label}</Text>
          <Text style={styles.statGridValue}>{item.value}</Text>
        </View>
      ))}
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    // paddingTop removed
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: hs(20),
    paddingVertical: vs(16),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backButton: {
    marginRight: hs(16),
  },
  headerTitle: {
    fontSize: ms(18),
    fontWeight: 'bold',
    color: colors.text,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: hs(20),
  },
  loadingText: {
    fontSize: ms(16),
    color: colors.text,
    marginTop: vs(16),
  },
  noQuestionsText: {
    fontSize: ms(20),
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
  },
  noQuestionsSubText: {
    fontSize: ms(16),
    color: colors.subText,
    marginTop: vs(8),
    textAlign: 'center',
  },
  progressBar: {
    height: vs(4),
    width: '100%',
    backgroundColor: colors.border,
    borderRadius: 0,
    marginBottom: vs(8),
  },
  quizContainer: {
    paddingHorizontal: hs(20),
    paddingTop: vs(20),
  },
  questionText: {
    fontSize: ms(18),
    color: colors.text,
    lineHeight: ms(26),
    marginBottom: vs(24),
  },
  optionButton: {
    backgroundColor: colors.inputBg,
    borderRadius: ms(12),
    padding: hs(16),
    marginBottom: vs(12),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedOption: {
    borderColor: colors.primary,
    backgroundColor: colors.card,
  },
  correctOption: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  incorrectOption: {
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  disabledOption: {
    opacity: 0.5,
  },
  optionText: {
    fontSize: ms(16),
    color: colors.text,
    flex: 1,
  },
  explanationContainer: {
    backgroundColor: colors.card,
    borderRadius: ms(12),
    padding: hs(16),
    marginTop: vs(16),
    marginBottom: vs(24),
  },
  explanationTitle: {
    fontSize: ms(16),
    fontWeight: '700',
    color: colors.text,
    marginBottom: vs(8),
  },
  explanationText: {
    textAlign: 'left',
    fontSize: ms(14),
    color: colors.subText,
    lineHeight: ms(20),
  },
  nextButton: {
    backgroundColor: colors.primary,
    paddingVertical: vs(16),
    borderRadius: ms(12),
    alignItems: 'center',
    marginTop: vs(24),
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  nextButtonText: {
    color: '#0F172A',
    fontSize: ms(16),
    fontWeight: '700',
  },
  premiumBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingVertical: vs(8),
    paddingHorizontal: hs(12),
    marginHorizontal: hs(20),
    marginBottom: vs(8),
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    gap: hs(8),
  },
  premiumBannerText: {
    color: "#F59E0B",
    fontSize: ms(12),
    flex: 1,
    fontWeight: '500',
  },
  upgradeButtonSmall: {
    backgroundColor: "#F59E0B",
    paddingVertical: vs(6),
    paddingHorizontal: hs(12),
    borderRadius: ms(8),
  },
  upgradeButtonTextSmall: {
    color: '#0F172A',
    fontWeight: 'bold',
    fontSize: ms(10),
  },
  upgradeButton: {
    backgroundColor: '#FFD700',
    paddingVertical: vs(12),
    borderRadius: ms(12),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  upgradeButtonText: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: ms(14),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Results
  resultCard: {
    backgroundColor: colors.card,
    borderRadius: ms(16),
    padding: hs(20),
    margin: hs(15),
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resultIcon: {
    fontSize: ms(50),
    marginBottom: vs(10),
  },
  resultTitle: {
    fontSize: ms(28),
    fontWeight: 'bold',
    marginBottom: vs(8),
    color: colors.text,
  },
  resultSubtitle: {
    fontSize: ms(16),
    color: colors.subText,
    textAlign: 'center',
    marginBottom: vs(20),
    lineHeight: ms(24),
  },
  noContentCard: {
    backgroundColor: colors.card,
    borderRadius: ms(24),
    padding: hs(32),
    alignItems: 'center',
    width: '90%',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  noContentIconContainer: {
    width: ms(80),
    height: ms(80),
    backgroundColor: colors.inputBg,
    borderRadius: ms(40),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: vs(24),
    borderWidth: 1,
    borderColor: colors.border,
  },
  noContentIconBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: colors.card,
    borderRadius: 12,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: vs(16),
    paddingHorizontal: hs(24),
    borderRadius: ms(16),
    gap: hs(8),
    marginTop: vs(32),
  },
  skipButtonText: {
    color: '#0F172A',
    fontSize: ms(16),
    fontWeight: '700',
  },
  statsHeader: {
    fontSize: ms(18),
    fontWeight: '600',
    color: colors.text,
    marginBottom: vs(15),
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    width: '100%',
    marginVertical: vs(20),
  },
  actionButton: {
    borderRadius: ms(12),
    paddingVertical: vs(15),
    paddingHorizontal: hs(30),
    width: '100%',
    alignItems: 'center',
    marginBottom: vs(15),
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: ms(16),
    fontWeight: 'bold',
  },
  backLink: {
    color: colors.subText,
    fontSize: ms(14),
    marginTop: vs(5),
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: vs(18),
    width: '100%',
    gap: hs(12),
  },
  statGridItem: {
    alignItems: 'center',
    padding: hs(12),
    borderRadius: ms(12),
    backgroundColor: colors.inputBg,
    minWidth: hs(90),
    borderWidth: 1,
    borderColor: colors.border,
  },
  statGridLabel: {
    color: colors.subText,
    fontSize: ms(12),
    marginTop: vs(5),
    textAlign: 'center',
  },
  statGridValue: {
    color: colors.text,
    fontSize: ms(16),
    fontWeight: 'bold',
    marginTop: vs(2),
  },
  inlinePremiumCard: {
    marginTop: vs(24),
    width: '100%',
    backgroundColor: 'rgba(255, 215, 0, 0.05)',
    borderRadius: ms(16),
    padding: hs(16),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  premiumHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
    marginBottom: vs(8),
  },
  premiumHeaderText: {
    color: '#FFD700',
    fontWeight: '700',
    fontSize: ms(16),
  },
  premiumDescText: {
    color: colors.subText,
    fontSize: ms(13),
    textAlign: 'center',
    marginBottom: vs(16),
    lineHeight: ms(20),
  },
  skipButtonSecondary: {
    backgroundColor: 'transparent',
    marginTop: vs(0), // Removed margin top as the card handles spacing
    paddingVertical: vs(12),
  },
  premiumBadgeText: {
    fontSize: ms(10),
    fontWeight: '800',
    color: '#0F172A', // Dark text for contrast
  },
  footerAction: {
    padding: hs(20),
    paddingBottom: vs(20), // Adjusted for safe area if needed
    backgroundColor: colors.card, // Match card/background
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  startQuizButtonLarge: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  actionButtonGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 10,
    borderRadius: 12,
  },
  footerButtonText: {
    color: '#FFFFFF',
    fontSize: ms(18),
    fontWeight: '700',
  },
});
