import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { BarChart, ChevronLeft, Clock, Home, Repeat, Target, Trophy } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Responsive utility functions
const { width, height } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;
const hs = (size: number) => (width / guidelineBaseWidth) * size;
const vs = (size: number) => (height / guidelineBaseHeight) * size;
const ms = (size: number, factor = 0.5) => size + (hs(size) - size) * factor;

export default function ResultsScreen() {
  const { colors } = useTheme();
  const { session } = useLocalSearchParams<{ session: string }>();
  const { mode } = useLocalSearchParams<{ mode: string }>();
  const [results, setResults] = useState<any>(null);
  const [exam, setExam] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!session) {
      router.replace('/(tabs)');
      return;
    }

    fetchResults();
  }, [session]);

  const fetchResults = async () => {
    try {
      const { data, error } = await supabase
        .from('quiz_sessions')
        .select('*')
        .eq('id', session)
        .single();

      if (error) throw error;
      setResults(data);
      // Try to fetch exam info if quiz_type matches an exam short_name
      if (data?.quiz_type) {
        const { data: examData, error: examError } = await supabase
          .from('exams')
          .select('*')
          .eq('short_name', data.quiz_type)
          .single();
        if (!examError && examData) setExam(examData);
      }
    } catch (err) {
      console.error('Error fetching results:', err);
      router.replace('/(tabs)');
    } finally {
      setLoading(false);
    }
  };


  if (loading || !results) {
    return (
      <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.container}>
        <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text, marginTop: 20 }]}>Loading results...</Text>
        </View>
      </LinearGradient>
    );
  }

  const accuracy = Math.round((results.score / results.total_questions) * 100);
  const timeInMinutes = Math.round(results.time_taken_seconds / 60 * 10) / 10;

  const passed = accuracy >= 70; // Assuming 70% is passing

  return (
    <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.container}>
      {passed && <ConfettiCannon count={200} origin={{ x: -10, y: 0 }} fadeOut={true} />}
      <View style={{ flex: 1, paddingTop: insets.top }}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.replace('/(tabs)')}
          >
            <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Quiz Results</Text>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 20 }
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <View style={styles.scoreContainer}>
              <View style={[styles.trophyContainer, { backgroundColor: passed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)' }]}>
                {passed ? <Trophy size={48} color={colors.primary} strokeWidth={1.5} /> : <Target size={48} color="#EF4444" strokeWidth={1.5} />}
              </View>
              <Text style={[styles.examTitle, { color: colors.text }]}>
                {exam?.title || 'Quiz Complete'}
              </Text>
              <Text style={[styles.resultSubtitle, { color: colors.subText }]}>
                {passed ? "Excellent work! Keep it up." : "Good effort. Keep practicing!"}
              </Text>
            </View>

            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.statIcon, { backgroundColor: colors.inputBg }]}>
                  <Target size={24} color={colors.primary} strokeWidth={2} />
                </View>
                <Text style={[styles.statValue, { color: colors.text }]}>{accuracy}%</Text>
                <Text style={[styles.statLabel, { color: colors.subText }]}>Accuracy</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.statIcon, { backgroundColor: colors.inputBg }]}>
                  <BarChart size={24} color="#3B82F6" strokeWidth={2} />
                </View>
                <Text style={[styles.statValue, { color: colors.text }]}>{results.score}</Text>
                <Text style={[styles.statLabel, { color: colors.subText }]}>Score</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.statIcon, { backgroundColor: colors.inputBg }]}>
                  <Clock size={24} color="#8B5CF6" strokeWidth={2} />
                </View>
                <Text style={[styles.statValue, { color: colors.text }]}>{timeInMinutes}m</Text>
                <Text style={[styles.statLabel, { color: colors.subText }]}>Time</Text>
              </View>
            </View>

            <View style={{ width: '100%', gap: vs(12), marginTop: 'auto' }}>
              {mode === 'level_up' && (
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: colors.primary }]}
                  onPress={() => router.replace('/quiz/levelup')}
                >
                  <Repeat size={20} color="#0F172A" />
                  <Text style={styles.buttonText}>Continue Level Up</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.button, { backgroundColor: mode === 'level_up' ? 'transparent' : colors.primary, borderWidth: mode === 'level_up' ? 1 : 0, borderColor: colors.border }]}
                onPress={() => router.replace('/(tabs)')}
              >
                <Home size={20} color={mode === 'level_up' ? colors.text : "#0F172A"} />
                <Text style={[styles.buttonText, mode === 'level_up' && { color: colors.text }]}>Return to Home</Text>
              </TouchableOpacity>
            </View>

          </View>
        </ScrollView>
      </View>
    </LinearGradient>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: ms(20),
    fontWeight: '700',
    color: '#F8FAFC',
  },
  content: {
    flex: 1,
    padding: hs(20),
    alignItems: 'center',
  },
  scoreContainer: {
    alignItems: 'center',
    marginVertical: vs(24),
  },
  trophyContainer: {
    width: ms(80),
    height: ms(80),
    borderRadius: ms(40),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: vs(16),
  },
  examTitle: {
    fontSize: ms(24),
    fontWeight: '800',
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: vs(8),
  },
  resultSubtitle: {
    fontSize: ms(16),
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: vs(2),
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: hs(12),
    marginBottom: vs(40),
    width: '100%',
    justifyContent: 'center',
  },
  statCard: {
    backgroundColor: '#334155',
    borderRadius: ms(16),
    padding: hs(16),
    alignItems: 'center',
    flex: 1,
    minWidth: '30%',
    borderWidth: 1,
    borderColor: '#475569',
  },
  statIcon: {
    width: ms(48),
    height: ms(48),
    borderRadius: ms(12),
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: vs(12),
  },
  statValue: {
    fontSize: ms(20),
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: vs(4),
  },
  statLabel: {
    fontSize: ms(13),
    color: '#94A3B8',
  },
  button: {
    backgroundColor: '#8A2BE2',
    paddingHorizontal: hs(24),
    paddingVertical: vs(16),
    borderRadius: ms(12),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: hs(8),
  },
  buttonText: {
    fontSize: ms(16),
    fontWeight: '600',
    color: '#0F172A',
  },
});
