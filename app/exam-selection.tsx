import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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

import { useExam } from '@/contexts/ExamContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Exam } from '@/types';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowLeft, ChevronRight, Search } from 'lucide-react-native';

export default function ExamSelectionScreen() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [exams, setExams] = useState<Exam[]>([]);
  const { setExam } = useExam();
  // Fetch exams
  const { data: examsData, isLoading } = useQuery({
    queryKey: ['exams'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exams')
        .select('*, questions(count)')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data.map(exam => ({ ...exam, questions_count: (exam.questions as any)[0]?.count || 0 })) as Exam[];
    },
  });

  useEffect(() => {
    if (!isLoading) {
      setExams(examsData || []);
    }
  }, [isLoading, examsData]);

  const filteredExams = exams.filter(exam =>
    exam.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (exam.short_name && exam.short_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // User selects an exam and is routed directly to the dashboard; no version selection required.
  const handleExamSelect = (exam: Exam) => {
    setExam(exam);
    router.replace('/(tabs)');
  };


  return (
    <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={[styles.container, { paddingTop: insets.top }]}>
      <View style={{ flex: 1, paddingBottom: insets.bottom + 20 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={colors.text} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.title}>Choose Course</Text>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Search size={20} color="#94A3B8" strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search certifications..."
            placeholderTextColor="#64748B"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Exams List */}
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.examsList}>
            <Text style={styles.subtitle}>What are you preparing for?</Text>
            {filteredExams.map((exam) => (
              <TouchableOpacity
                key={exam.id}
                style={styles.examCard}
                onPress={() => handleExamSelect(exam)}
              >
                <View style={styles.examInfo}>
                  <Text style={styles.examName}>{exam.title}</Text>
                  <Text style={styles.examCode}>{exam.short_name}</Text>
                  <View style={styles.examMeta}>
                    <Text style={styles.examMetaText}>
                      {(exam as any).questions_count || 0} questions
                    </Text>
                  </View>
                </View>
                <ChevronRight size={20} color="#94A3B8" strokeWidth={2} />
              </TouchableOpacity>
            ))}
            {filteredExams.length === 0 && searchQuery && (
              <View style={styles.noResults}>
                <Text style={styles.noResultsText}>No certifications found</Text>
                <Text style={styles.noResultsSubtext}>
                  Try adjusting your search terms
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </LinearGradient>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    // paddingTop: 30, // Removed hardcoded padding
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    margin: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    marginLeft: 12,
  },
  scrollView: {
    flex: 1,
  },
  examsList: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  subtitle: {
    fontSize: 16,
    color: colors.subText,
    marginBottom: 24,
  },
  examCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  examInfo: {
    flex: 1,
  },
  examName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  examCode: {
    fontSize: 14,
    color: colors.subText,
    marginBottom: 8,
  },
  examMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  examMetaText: {
    fontSize: 12,
    color: colors.subText,
  },
  noResults: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  noResultsText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.subText,
    marginBottom: 8,
  },
  noResultsSubtext: {
    fontSize: 14,
    color: colors.subText,
    textAlign: 'center',
  },
});