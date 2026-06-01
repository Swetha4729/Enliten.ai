import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { Easing, FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

// Responsive utility functions
const { width, height } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;
const hs = (size: number) => (width / guidelineBaseWidth) * size;
const vs = (size: number) => (height / guidelineBaseHeight) * size;
const ms = (size: number, factor = 0.5) => size + (hs(size) - size) * factor;

import { useAuth } from '@/contexts/AuthContext';
import { useExam } from '@/contexts/ExamContext';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useQuizModes } from '@/lib/QuizModes';
import { supabase } from '@/lib/supabase';
import { prefetchOfflineBank } from '@/utils/offlineSync';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ChartBar as BarChart, Bell, BookOpen, Calendar, Calendar1, CheckCircle, ChevronLeft, ChevronRight, Clock, Crown, CreditCard as Edit, Flame, Layers, Target, TrendingUp, Trophy, X, Bot, ShoppingBag, Camera } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { title } from 'process';
const today = new Date();

const SHORTCUTS = [
  {
    id: 'ai_mentor',
    title: 'AI Mentor',
    description: 'Chat with AI tutor',
    icon: Bot,
    color: '#6366F1',
    bgGradient: ['rgba(99, 102, 241, 0.12)', 'rgba(99, 102, 241, 0.02)'] as [string, string],
    borderColor: 'rgba(99, 102, 241, 0.25)',
  },
  {
    id: 'digital_store',
    title: 'Digital Store',
    description: 'Guides & mock tests',
    icon: ShoppingBag,
    color: '#EC4899',
    bgGradient: ['rgba(236, 72, 153, 0.12)', 'rgba(236, 72, 153, 0.02)'] as [string, string],
    borderColor: 'rgba(236, 72, 153, 0.25)',
  },
  {
    id: 'doubt_solver',
    title: 'Doubt Solver',
    description: 'Scan & solve questions',
    icon: Camera,
    color: '#10B981',
    bgGradient: ['rgba(16, 185, 129, 0.12)', 'rgba(16, 185, 129, 0.02)'] as [string, string],
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  {
    id: 'study_planner',
    title: 'Study Planner',
    description: 'AI revision schedule',
    icon: Calendar,
    color: '#F59E0B',
    bgGradient: ['rgba(245, 158, 11, 0.12)', 'rgba(245, 158, 11, 0.02)'] as [string, string],
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
];

const timeAgo = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return `Just now`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
};

const QUIZ_MODES = [
  {
    id: 'daily',
    title: 'Question of the Day',
    icon: Calendar,
    subtitle: today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    color: '#3B82F6',
    order_index: 0,
    isPremium: false,
  },
  {
    id: 'flashcard',
    title: 'Flashcards',
    icon: Layers,
    subtitle: 'Adaptive Learning',
    color: '#EC4899',
    order_index: 1,
    isPremium: true,
  },
  {
    id: 'quick_10',
    title: 'Practice Quiz',
    icon: Target,
    subtitle: 'Short quiz round',
    color: '#8B5CF6',
    order_index: 2,
    isPremium: false,
  },
  {
    id: 'pyq',
    title: 'Practice Quiz (PYQ)',
    icon: Calendar1,
    subtitle: 'Previous Year Questions',
    color: '#acd43eff',
    order_index: 3,
    isPremium: false,
  },
  {
    id: 'timed',
    title: 'Timed Quiz',
    icon: Clock,
    subtitle: 'Beat the clock',
    color: '#06B6D4',
    order_index: 4,
    isPremium: false,
  },
  {
    id: 'level_up',
    title: 'Level Up',
    icon: TrendingUp,
    subtitle: 'Progressive difficulty',
    color: '#0f6b1cff',
    order_index: 5,
    isPremium: true,
  },
  {
    id: 'missed',
    title: 'Missed Questions Quiz',
    icon: X,
    subtitle: 'Practice weak areas',
    color: '#EF4444',
    order_index: 6,
    isPremium: true,
  },
  {
    id: 'weakest_subject',
    title: 'Weakest Domain Quiz',
    icon: BarChart,
    subtitle: 'Focus on gaps',
    color: '#F97316',
    order_index: 7,
    isPremium: true,
  },
  {
    id: 'full_test',
    title: 'Full Mock Test',
    icon: CheckCircle,
    subtitle: 'Take the full exam',
    color: '#890d6cff',
    order_index: 8,
    isPremium: false,

  },
  {
    id: 'custom',
    title: 'Build Your Own Quiz',
    icon: Edit,
    subtitle: 'Customize your practice',
    color: '#10B981',
    order_index: 9,
    isPremium: true,
  },
];

function enrichModesFromLocal(fetchedModes: any[]): any[] {
  return fetchedModes.map(fetched => {
    const local = QUIZ_MODES.find(localMode => localMode.id === fetched.id);
    return {
      ...fetched,
      subtitle: local?.id === 'daily' ? today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : fetched.subtitle,
      icon: local?.icon,
      color: local?.color,
      order_index: local?.order_index,
      isPremium: fetched.is_premium,
    };
  });
}


export default function StudyScreen() {
  // const temp_app=true;
  // if(temp_app){
  //   return(<Text>StudyScreen</Text>);
  // }
  const insets = useSafeAreaInsets();

  const { colors, isDark } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const { user } = useAuth();
  const { isPro } = useRevenueCat(); // Get real-time status
  const { exam } = useExam();


  const {
    data: rawQuizModes,
    isLoading: isQuizModesLoading,
    isError: isQuizModesError,
    error: quizModesError
  } = useQuizModes();
  const quizModes = Array.isArray(rawQuizModes) ? enrichModesFromLocal(rawQuizModes) : [];
  console.log(quizModes)

  const [studiedDays, setStudiedDays] = useState<number[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const [isNotificationsModalVisible, setIsNotificationsModalVisible] = useState(false);
  const [expandedNotifications, setExpandedNotifications] = useState<string[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [freeProgress, setFreeProgress] = useState({ total: 0, consumed: 0, loading: true });
  const [examProgress, setExamProgress] = useState({ total: 0, correct: 0, loading: true });

  // Fetch exam-wide progress (correct / total) — works for both free and pro users
  useEffect(() => {
    const fetchExamProgress = async () => {
      if (!user || !exam) {
        setExamProgress(prev => ({ ...prev, loading: false }));
        setFreeProgress(prev => ({ ...prev, loading: false }));
        return;
      }
      setExamProgress(prev => ({ ...prev, loading: true }));
      if (!isPro) setFreeProgress(prev => ({ ...prev, loading: true }));
      try {
        // 1. Total questions for this exam (scoped by user plan)
        let totalQuery = supabase
          .from('questions')
          .select('*', { count: 'exact', head: true })
          .eq('exam', exam.id);

        if (!isPro) {
          totalQuery = totalQuery.eq('is_premium', false);
        }

        const { count: totalCount, error: totalError } = await totalQuery;
        if (totalError) throw totalError;

        // 2. Unique questions answered CORRECTLY by this user for this exam
        let answeredQuery = supabase
          .from('user_answers')
          .select('question_id, questions!inner(id, exam, is_premium)')
          .eq('user_id', user.id)
          .eq('is_correct', true)
          .eq('questions.exam', exam.id);

        if (!isPro) {
          answeredQuery = answeredQuery.eq('questions.is_premium', false);
        }

        const { data: answeredData, error: ansError } = await answeredQuery;
        if (ansError) throw ansError;

        const uniqueCorrect = new Set((answeredData || []).map((a: any) => a.question_id)).size;
        const total = totalCount || 0;

        setExamProgress({ total, correct: uniqueCorrect, loading: false });

        // Also update freeProgress for free users (used by the quick stat card)
        if (!isPro) {
          setFreeProgress({ total, consumed: uniqueCorrect, loading: false });
        } else {
          setFreeProgress(prev => ({ ...prev, loading: false }));
        }

        // Prefetch offline questions when exam resolves
        if (exam?.id) {
          prefetchOfflineBank(exam.id, user.id, isPro);
        }

      } catch (err) {
        console.error('Error fetching exam progress:', err);
        setExamProgress(prev => ({ ...prev, loading: false }));
        setFreeProgress(prev => ({ ...prev, loading: false }));
      }
    };

    fetchExamProgress();
  }, [user, exam, isPro]);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('is_active', true)
          .or(`expires_at.is.null,expires_at.gte.${new Date().toISOString()}`)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching notifications:', error);
          return;
        }

        const filtered = (data || []).filter(
          (n) => n.target_platform === 'all' || n.target_platform === Platform.OS
        );
        setNotifications(filtered);

        const readIdsStr = await AsyncStorage.getItem('read_notifications');
        if (readIdsStr) {
          setReadNotificationIds(JSON.parse(readIdsStr));
        }
      } catch (err) {
        console.error('Notifications fetch failed:', err);
      }
    };
    fetchNotifications();
  }, []);

  const unreadCount = notifications.filter((n) => !readNotificationIds.includes(n.id)).length;

  const toggleExpandNotification = async (id: string) => {
    let newReadIds = [...readNotificationIds];
    if (!readNotificationIds.includes(id)) {
      newReadIds.push(id);
      setReadNotificationIds(newReadIds);
      await AsyncStorage.setItem('read_notifications', JSON.stringify(newReadIds));
    }

    if (expandedNotifications.includes(id)) {
      setExpandedNotifications(expandedNotifications.filter((i) => i !== id));
    } else {
      setExpandedNotifications([...expandedNotifications, id]);
    }
  };


  const progressWidth = useSharedValue(0);

  useEffect(() => {
    if (examProgress.total > 0) {
      const percentage = Math.min((examProgress.correct / examProgress.total) * 100, 100);
      progressWidth.value = withTiming(percentage, { duration: 1000, easing: Easing.out(Easing.exp) });
    }
  }, [examProgress]);

  const animatedProgressStyle = useAnimatedStyle(() => {
    return {
      width: `${progressWidth.value}%`,
    };
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => i + 1);
  };

  const getMonthName = (date: Date) =>
    date.toLocaleString('default', { month: 'long', year: 'numeric' });

  useEffect(() => {
    // Fetch quiz sessions for the displayed month and mark days with sessions as studied
    const fetchStudiedDays = async () => {
      if (!user) return;
      setLoadingCalendar(true);
      const month = calendarMonth.getMonth() + 1;
      const year = calendarMonth.getFullYear();
      const daysInMonth = new Date(year, month, 0).getDate();
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const endDate = `${year}-${month.toString().padStart(2, '0')}-${daysInMonth}`;
      const { data, error } = await supabase
        .from('quiz_sessions')
        .select('created_at')
        .eq('user_id', user.id)
        .eq('exam_id', exam.id)
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`);
      // console.log('Supabase quiz_sessions data:', data, 'error:', error);
      if (!error && data) {
        // Extract unique days from created_at timestamps
        const daysSet = new Set<number>();
        data.forEach((row: any) => {
          const d = new Date(row.created_at);
          // console.log('Session row:', row.created_at, '->', d.getFullYear(), d.getMonth() + 1, d.getDate());
          if (
            d.getFullYear() === year &&
            d.getMonth() + 1 === month
          ) {
            daysSet.add(d.getDate());
          }
        });
        const studiedArr = Array.from(daysSet);
        // console.log('Fetched studied days:', studiedArr);
        setStudiedDays(studiedArr);
      } else {
        setStudiedDays([]);
      }
      setLoadingCalendar(false);
    };
    fetchStudiedDays();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, calendarMonth]);

  const handleQuizMode = async (mode: any) => {
    // Use isPro for instant real-time check. 
    // user.subscription_status might be slightly stale if AuthContext hasn't refreshed.
    if (mode.isPremium && !isPro) {
      Alert.alert(
        'Premium Feature',
        'This quiz mode is available with a premium subscription.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade', onPress: () => router.push('/subscription') },
        ]
      );
      return;
    }

    // ... rest of function

    try {
      // Create session at quiz start
      // const { data, error } = await supabase
      //   .from('quiz_sessions')
      //   .insert([
      //     {
      //       user_id: user?.id,
      //       quiz_type: mode.id,
      //       created_at: new Date().toISOString(),
      //     },
      //   ])
      //   .select()
      //   .single();
      // if (error) {
      //   console.error('Failed to create quiz session:', error);
      //   Alert.alert('Error', 'Could not start quiz session.');
      //   return;
      // }
      if (mode.id === 'daily') {
        router.push('/quiz/daily');
      } else if (mode.id === 'level_up') {
        router.push('/quiz/levelup');
      } else if (mode.id === 'flashcard' || mode.id === 'adaptive') {
        router.push('/flashcards');
      }
      else {
        router.push(`/quiz/${mode.id}`);
      }
    } catch (err) {
      console.error('Unexpected error creating quiz session:', err);
      Alert.alert('Error', 'Could not start quiz session.');
    }
  };

  const handleShortcut = (shortcut: typeof SHORTCUTS[0]) => {
    if (shortcut.id === 'ai_mentor') {
      router.push('/ai-mentor');
    } else if (shortcut.id === 'digital_store') {
      router.push('/subscription');
    } else if (shortcut.id === 'doubt_solver') {
      Alert.alert(
        'Doubt Solver',
        'Take a photo of any question or equation, and get instant step-by-step solutions from AI. Launching in the next build!',
        [{ text: 'Awesome', style: 'default' }]
      );
    } else if (shortcut.id === 'study_planner') {
      Alert.alert(
        'Study Planner',
        'Plan your learning schedule and set study milestones automatically with AI. Launching in the next build!',
        [{ text: 'Sounds Good', style: 'default' }]
      );
    }
  };



  return (
    <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={[styles.container, { paddingTop: insets.top }]}>
      <View style={{ flex: 1, paddingBottom: insets.bottom + 90 }}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
          {/* Enhanced Header */}
          <Animated.View entering={FadeInDown.duration(600).delay(100)} style={styles.header}>
            <View style={styles.headerTopRow}>
              <View style={styles.userInfoContainer}>
                <View style={styles.avatarWrapper}>
                  {user?.avatar_url ? (
                    <Image source={{ uri: user.avatar_url }} style={[styles.userAvatar, isPro && styles.userAvatarPro]} />
                  ) : (
                    <View style={[styles.userAvatarPlaceholder, { backgroundColor: colors.primary }, isPro && styles.userAvatarPro]}>
                      <Text style={styles.userAvatarText}>
                        {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
                      </Text>
                    </View>
                  )}
                  {isPro && (
                    <View style={styles.proCrownBadge}>
                      <Crown size={12} color="#FFFFFF" strokeWidth={2.5} />
                    </View>
                  )}
                </View>
                <View style={styles.userGreetingTextContainer}>
                  <Text style={[styles.greetingSubtext, { color: colors.subText }]}>{getGreeting()}</Text>
                  <Text style={[styles.greetingTitle, { color: colors.text }]} numberOfLines={1}>
                    {user?.full_name ? user.full_name : 'Ready to learn?'}
                  </Text>
                </View>
              </View>

              <View style={styles.headerActions}>
                <TouchableOpacity onPress={() => setIsNotificationsModalVisible(true)} style={styles.bellIconContainer}>
                  <Bell size={22} color={colors.text} strokeWidth={2} />
                  {unreadCount > 0 && (
                    <View style={styles.notificationBadge} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>

          {/* Quick Stats Row */}
          <Animated.View entering={FadeInDown.duration(600).delay(200)} style={styles.quickStatsRow}>
            <TouchableOpacity style={[styles.quickStatCard]} onPress={() => router.push('/exam-selection')} activeOpacity={0.7}>
              <View style={styles.quickStatIconRow}>
                <Target size={20} color="#F59E0B" strokeWidth={2} />
                <ChevronRight size={14} color={colors.subText} style={{ opacity: 0.6 }} />
              </View>
              <Text style={[styles.quickStatValue, { color: colors.text }]} numberOfLines={1}>{exam ? exam.short_name : '—'}</Text>
              <Text style={[styles.quickStatLabel, { color: "#F59E0B", opacity: 0.8 }]}>Tap to change</Text>
            </TouchableOpacity>
            <View style={styles.quickStatCard}>
              <Flame size={20} color={'#F97316'} strokeWidth={2} />
              <Text style={[styles.quickStatValue, { color: colors.text }]}>{studiedDays.length}</Text>
              <Text style={[styles.quickStatLabel, { color: colors.subText }]}>Days Active</Text>
            </View>
            {examProgress.total > 0 && (
              <View style={styles.quickStatCard}>
                <Layers size={20} color={isPro ? colors.primary : colors.secondary} strokeWidth={2} />
                <Text style={[styles.quickStatValue, { color: colors.text }]}>{Math.max(0, examProgress.total - examProgress.correct)}</Text>
                <Text style={[styles.quickStatLabel, { color: colors.subText }]}>Qs Left</Text>
              </View>
            )}

          </Animated.View>
          {/* Calendar & Shortcuts Row */}
          <View style={styles.responsiveSectionRow}>
            {/* Study Progress Section (Calendar) */}
            <Animated.View entering={FadeInDown.duration(600).delay(300)} style={styles.calendarColumn}>
              <Text style={styles.sectionTitle}>Study Streak</Text>
              <View style={styles.calendarContainer}>
                {/* Month navigation */}
                <View style={styles.calendarHeader}>
                  <TouchableOpacity
                    onPress={() => setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                    style={styles.calendarMonthBtn}
                    accessibilityLabel="Previous Month"
                  >
                    <ChevronLeft size={18} color={colors.subText} strokeWidth={2.5} />
                  </TouchableOpacity>
                  <View style={styles.calendarMonthCenter}>
                    <Text style={[styles.calendarMonthText, { color: colors.text }]}>
                      {getMonthName(calendarMonth)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                    style={styles.calendarMonthBtn}
                    accessibilityLabel="Next Month"
                  >
                    <ChevronRight size={18} color={colors.subText} strokeWidth={2.5} />
                  </TouchableOpacity>
                </View>
                {/* Weekday labels */}
                <View style={styles.weekdayRow}>
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                    <View key={i} style={styles.weekdayCell}>
                      <Text style={[styles.weekdayLabel, { color: colors.subText }]}>{d}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.calendarGrid}>
                  {/* Empty slots for offset */}
                  {Array.from({ length: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay() }).map((_, i) => (
                    <View key={`empty-${i}`} style={styles.calendarDayEmpty} />
                  ))}
                  {getDaysInMonth(calendarMonth).map((day) => {
                    const dateObj = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
                    const isToday = (() => {
                      const now = new Date();
                      return (
                        dateObj.getFullYear() === now.getFullYear() &&
                        dateObj.getMonth() === now.getMonth() &&
                        dateObj.getDate() === now.getDate()
                      );
                    })();
                    const isStudied = studiedDays.includes(day);
                    return (
                      <View
                        key={day}
                        style={[
                          styles.calendarDay,
                          isStudied && styles.studiedDay,
                          isToday && styles.todayDay,
                        ]}
                      >
                        <Text
                          style={[
                            styles.calendarDayText,
                            isStudied && styles.studiedDayText,
                            isToday && styles.todayDayText,
                          ]}
                        >
                          {day}
                        </Text>
                      </View>
                    );
                  })}
                </View>
                <View style={styles.calendarLegend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
                    <Text style={styles.legendText}>Today</Text>
                  </View>
                  <View style={[styles.legendItem, { marginLeft: 20 }]}>
                    <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
                    <Text style={styles.legendText}>Studied</Text>
                  </View>
                </View>
              </View>
            </Animated.View>

            {/* Shortcuts Section */}
            <Animated.View entering={FadeInDown.duration(600).delay(350)} style={styles.shortcutsColumn}>
              <Text style={styles.sectionTitle}>Quick Tools</Text>
              <View style={styles.shortcutsContainer}>
                {SHORTCUTS.map((shortcut) => {
                  const Icon = shortcut.icon;
                  return (
                    <TouchableOpacity
                      key={shortcut.id}
                      style={[styles.shortcutCard, { borderColor: shortcut.borderColor }]}
                      onPress={() => handleShortcut(shortcut)}
                      activeOpacity={0.7}
                    >
                      <LinearGradient
                        colors={shortcut.bgGradient}
                        style={shortcut.bgGradient ? styles.shortcutGradient : {}}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        <View style={styles.shortcutHeaderRow}>
                          <View style={[styles.shortcutIconContainer, { backgroundColor: shortcut.color }]}>
                            <Icon size={20} color="#FFFFFF" strokeWidth={2.2} />
                          </View>
                          <ChevronRight size={14} color={colors.subText} style={{ opacity: 0.6 }} />
                        </View>
                        <View style={styles.shortcutTextContainer}>
                          <Text style={[styles.shortcutTitle, { color: colors.text }]}>
                            {shortcut.title}
                          </Text>
                          <Text style={[styles.shortcutDesc, { color: colors.subText }]} numberOfLines={1}>
                            {shortcut.description}
                          </Text>
                        </View>
                      </LinearGradient>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Animated.View>
          </View>

          {/* Exam Progress Card (Both Free & Pro Users) */}
          {!examProgress.loading && examProgress.total > 0 && (
            <Animated.View entering={FadeInDown.duration(600).delay(400)}>
              <View style={styles.progressContainer}>
                <View style={styles.progressHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={styles.examProgressIcon}>
                      <BookOpen size={16} color={colors.primary} strokeWidth={2.5} />
                    </View>
                    <Text style={styles.progressTitle}>Exam Progress</Text>
                  </View>
                  <Text style={styles.progressCount}>
                    {examProgress.correct}<Text style={{ color: colors.subText, fontSize: 14, fontWeight: '500' }}> / {examProgress.total}</Text>
                  </Text>
                </View>
                <View style={styles.progressBarBg}>
                  <Animated.View
                    style={[
                      styles.progressBarFill,
                      animatedProgressStyle,
                      examProgress.total > 0 && examProgress.correct === examProgress.total && { backgroundColor: '#10B981' }
                    ]}
                  />
                </View>
                <View style={styles.progressFooterRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <CheckCircle size={14} color={'#10B981'} strokeWidth={2.5} />
                    <Text style={styles.progressFooter}>
                      {Math.max(0, examProgress.total - examProgress.correct)} questions remaining
                    </Text>
                  </View>
                  {!isPro && (
                    <TouchableOpacity onPress={() => router.push('/subscription')} style={styles.upgradeChip}>
                      <Crown size={12} color="#F59E0B" strokeWidth={2.5} />
                      <Text style={[styles.upgradeChipText, { color: "#F59E0B" }]}>Upgrade</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {examProgress.total > 0 && (
                  <Text style={styles.progressPercentage}>
                    {Math.round((examProgress.correct / examProgress.total) * 100)}% Complete
                  </Text>
                )}
              </View>
            </Animated.View>
          )}

          {/* Premium Subscription Banner (Free users only, shown when no progress data) */}
          {!isPro && (examProgress.loading || examProgress.total === 0) && (
            <Animated.View entering={FadeInDown.duration(600).delay(400)}>
              <TouchableOpacity onPress={() => router.push('/subscription')} style={[styles.premiumBanner, { backgroundColor: colors.card }]}>
                <View style={styles.premiumGradient}>
                  <View style={styles.premiumBannerIconContainer}>
                    <Crown size={24} color="#F59E0B" strokeWidth={2} />
                  </View>
                  <View style={styles.premiumBannerTextContainer}>
                    <Text style={[styles.premiumTextHeader, { color: colors.text }]}>Unlock Premium</Text>
                    <Text style={[styles.premiumTextSub, { color: colors.subText }]}>Get all 6 advanced quiz modes</Text>
                  </View>
                  <View style={[styles.premiumArrowBox, { backgroundColor: colors.inputBg }]}>
                    <ChevronRight size={20} color="#F59E0B" />
                  </View>
                </View>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Quiz Modes */}
          <Animated.View entering={FadeInDown.duration(600).delay(500)} style={styles.quizModesContainer}>
            <Text style={styles.sectionTitle}>Quiz Modes</Text>

            {(isQuizModesLoading) &&
              (

                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <SpinnerAnimation color={colors.primary} />
                </View>
              )
            }

            {quizModes?.sort((a, b) => a.order_index - b.order_index)?.map((mode: any, index: number) => {
              const IconComponent = mode.icon;

              if (mode.is_active) {
                return (
                  <Animated.View key={mode.id} entering={FadeInDown.duration(400).delay(550 + (index * 50))}>
                    <TouchableOpacity
                      style={[styles.quizModeCard, !isPro && mode.isPremium ? { opacity: 0.85 } : {}]}
                      onPress={() => handleQuizMode(mode)}
                    >
                      <View style={styles.quizModeContent}>
                        <View style={[styles.quizModeIcon, { backgroundColor: mode.color }]}>
                          <IconComponent size={24} color="#FFFFFF" strokeWidth={2} />
                        </View>
                        <View style={styles.quizModeText}>
                          <Text style={[styles.quizModeTitle, !isPro && mode.isPremium && { color: colors.subText }]}>{mode.title}</Text>
                          <Text style={styles.quizModeSubtitle}>
                            {mode.subtitle}
                          </Text>
                        </View>
                        {mode.isPremium && (
                          <View style={[styles.premiumBadge, isPro && { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                            {isPro ? (
                              <Target size={14} color="#10B981" />
                            ) : (
                              <Crown size={14} color="#F59E0B" strokeWidth={2.5} />
                            )}
                            <Text style={[styles.premiumBadgeText, isPro && { color: '#10B981' }]}>
                              {isPro ? 'Unlocked' : 'Premium'}
                            </Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  </Animated.View>
                );
              }
            })}
          </Animated.View>
        </ScrollView>

        {/* Daily Question Modal */}

        {/* Notifications Modal */}
        <Modal
          visible={isNotificationsModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setIsNotificationsModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Notifications</Text>
                <TouchableOpacity onPress={() => setIsNotificationsModalVisible(false)} style={styles.closeModalButton}>
                  <X size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.notificationsList}>
                {notifications.length === 0 ? (
                  <Text style={[styles.emptyNotificationsText, { color: colors.subText }]}>No notifications right now.</Text>
                ) : (
                  notifications.map((notif) => {
                    const isExpanded = expandedNotifications.includes(notif.id);
                    const isRead = readNotificationIds.includes(notif.id);

                    return (
                      <TouchableOpacity
                        key={notif.id}
                        style={[
                          styles.notificationCard,
                          { backgroundColor: colors.card, borderColor: colors.border },
                          !isRead && { borderColor: '#8A2BE2', borderWidth: 1 } // Primary/highlight color
                        ]}
                        onPress={() => toggleExpandNotification(notif.id)}
                      >
                        <View style={styles.notificationHeader}>
                          <Text style={[styles.notificationTitle, { color: colors.text }]} numberOfLines={isExpanded ? undefined : 1}>
                            {notif.title}
                          </Text>
                          {!isRead && <View style={styles.unreadDot} />}
                        </View>

                        <Text
                          style={[styles.notificationMessage, { color: colors.subText }]}
                          numberOfLines={isExpanded ? undefined : 2}
                        >
                          {notif.message}
                        </Text>

                        <Text style={[styles.notificationDate, { color: colors.subText }]}>
                          {timeAgo(notif.created_at)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

      </View>
    </LinearGradient>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    // paddingTop removed (dynamic)
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 15,
  },
  header: {
    flexDirection: 'column',
    marginTop: 12,
    marginBottom: 8,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarWrapper: {
    position: 'relative' as const,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.border,
  },
  userAvatarPro: {
    borderWidth: 2.5,
    borderColor: '#8A2BE2',
  },
  proCrownBadge: {
    position: 'absolute' as const,
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#8A2BE2',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    borderWidth: 2,
    borderColor: colors.card,
  },
  userAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  userGreetingTextContainer: {
    marginLeft: 14,
    flex: 1,
  },
  greetingSubtext: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 2,
    opacity: 0.8,
  },
  greetingTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bellIconContainer: {
    padding: 10,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Quick Stats Row
  quickStatsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  quickStatCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
    marginTop: 30,
  },
  quickStatCardTappable: {
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  quickStatIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quickStatValue: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  quickStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  // Progress
  progressContainer: {
    backgroundColor: colors.card,
    marginBottom: 20,
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  progressTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  examProgressIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    justifyContent: 'center',
    alignItems: 'center' as const,
  },
  progressPercentage: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700' as const,
    marginTop: 10,
    textAlign: 'right' as const,
    opacity: 0.85,
  },
  progressCount: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: colors.inputBg,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  progressFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  progressFooter: {
    color: colors.subText,
    fontSize: 13,
    fontWeight: '500',
  },
  upgradeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  upgradeChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  // Calendar
  calendarContainer: {
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    width: '100%',
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  calendarMonthBtn: {
    backgroundColor: colors.inputBg,
    borderRadius: 12,
    padding: 8,
  },
  calendarMonthCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarMonthText: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
  },
  weekdayLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    opacity: 0.45,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
    paddingHorizontal: 2,
  },
  calendarDay: {
    width: '13%',
    aspectRatio: 1,
    borderRadius: 10,
    backgroundColor: colors.inputBg,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 8,
  },
  calendarDayEmpty: {
    width: '13%',
    aspectRatio: 1,
  },
  studiedDay: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  todayDay: {
    backgroundColor: colors.primary,
    borderWidth: 0,
  },
  calendarDayText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    opacity: 0.55,
  },
  studiedDayText: {
    color: '#10B981',
    fontWeight: '800',
    opacity: 1,
  },
  todayDayText: {
    color: '#ffffff',
    fontWeight: '800',
    opacity: 1,
  },
  // Responsive row/grid
  responsiveSectionRow: {
    flexDirection: width > 768 ? 'row' : 'column',
    gap: 20,
    marginBottom: 20,
    width: '100%',
  },
  calendarColumn: {
    flex: width > 768 ? 1.2 : 1,
    width: '100%',
  },
  shortcutsColumn: {
    flex: width > 768 ? 1 : 1,
    width: '100%',
  },
  shortcutsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    width: '100%',
  },
  shortcutCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  shortcutGradient: {
    padding: 16,
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 12,
    height: 125,
    justifyContent: 'space-between',
  },
  shortcutHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  shortcutIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  shortcutTextContainer: {
    width: '100%',
  },
  shortcutTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  shortcutDesc: {
    fontSize: 11,
    fontWeight: '500',
    opacity: 0.6,
  },
  calendarLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 20,
    width: '100%'
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: colors.subText,
  },
  // Exam selector (still used in JSX)
  examSelectorWrapper: {
    marginBottom: 24,
  },
  examContextText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.subText,
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  examSelectorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  examSelectorInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  examText: {
    fontSize: 16,
    fontWeight: '700',
  },
  // Premium banner
  premiumBanner: {
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  premiumGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  premiumBannerIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  premiumBannerTextContainer: {
    flex: 1,
  },
  premiumTextHeader: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
    letterSpacing: -0.3,
  },
  premiumTextSub: {
    fontSize: 13,
    fontWeight: '500',
  },
  premiumArrowBox: {
    borderRadius: 12,
    padding: 6,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 14,
    letterSpacing: -0.3,
  },
  quizModesContainer: {
    marginBottom: 20,
  },
  quizModeCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  quizModeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  quizModeIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  quizModeText: {
    flex: 1,
  },
  quizModeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  quizModeSubtitle: {
    fontSize: 13,
    color: colors.subText,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 4,
  },
  premiumBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#F59E0B',
  },

  notificationBadge: {
    position: 'absolute',
    top: 6,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: colors.background,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: '75%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeModalButton: {
    padding: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(128,128,128,0.1)',
  },
  notificationsList: {
    paddingBottom: 20,
  },
  emptyNotificationsText: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
  },
  notificationCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  notificationTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    marginRight: 8,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginTop: 6,
  },
  notificationMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  notificationDate: {
    fontSize: 12,
  },
});
function SpinnerAnimation({ color = '#8A2BE2' }: { color?: string }) {
  const rotation = useSharedValue(0);
  React.useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 1200, easing: Easing.linear }),
      -1,
      false
    );
  }, []);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));
  return (
    <Animated.View style={[{ width: 64, height: 64, marginBottom: 16 }, animatedStyle]}>
      <Svg width={64} height={64} viewBox="0 0 64 64">
        <Circle
          cx={32}
          cy={32}
          r={28}
          stroke={color}
          strokeWidth={6}
          strokeDasharray={"44 88"}
          fill="none"
        />
      </Svg>
    </Animated.View>
  );
}