import { supabase } from '@/lib/supabase';
type DifficultyLevel = 'easy' | 'medium' | 'hard';

interface AccuracyStats {
  accuracy: number;
  correct: number;
  total: number;
}

interface DifficultyAccuracyMap {
  easy: AccuracyStats;
  medium: AccuracyStats;
  hard: AccuracyStats;
}

export async function getLevelUpAccuracyByDifficulty(userId: string, examId: string): Promise<DifficultyAccuracyMap> {
  try {
    const { data: sessions, error: sessionError } = await supabase
      .from('quiz_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('quiz_type', 'level_up');

    if (sessionError) throw sessionError;

    const sessionIds = (sessions ?? []).map(session => session.id as string);
    if (sessionIds.length === 0) return emptyStats();

    const { data: answers, error: answerError } = await supabase
      .from('user_answers')
      .select('question_id, is_correct')
      .eq('user_id', userId)
      .in('quiz_session_id', sessionIds);

    if (answerError) throw answerError;

    const answeredQuestionIds = answers.map(a => a.question_id);

    const { data: answeredQuestions, error: questionError } = await supabase
      .from('questions')
      .select('id, difficulty')
      .eq("exam", examId)
      .in('id', answeredQuestionIds);

    if (questionError) throw questionError;

    const correctCounts: Record<DifficultyLevel, number> = {
      easy: 0,
      medium: 0,
      hard: 0,
    };

    const difficultyMap = new Map<string, DifficultyLevel>(
      answeredQuestions.map(q => [q.id, q.difficulty])
    );

    for (const answer of answers) {
      const difficulty = difficultyMap.get(answer.question_id);
      if (!difficulty) continue;
      if (answer.is_correct) {
        correctCounts[difficulty]++;
      }
    }

    // ✅ Fetch all questions and count totals by difficulty manually
    const { data: allQuestions, error: allQuestionError } = await supabase
      .from('questions')
      .select('difficulty')
      .eq("exam", examId);

    if (allQuestionError) throw allQuestionError;

    const totalCounts: Record<DifficultyLevel, number> = {
      easy: 0,
      medium: 0,
      hard: 0,
    };

    for (const q of allQuestions ?? []) {
      const level = q.difficulty as DifficultyLevel;
      if (level in totalCounts) {
        totalCounts[level]++;
      }
    }

    const result: DifficultyAccuracyMap = {
      easy: calculateStats(correctCounts.easy, totalCounts.easy),
      medium: calculateStats(correctCounts.medium, totalCounts.medium),
      hard: calculateStats(correctCounts.hard, totalCounts.hard),
    };

    return result;
  } catch (error) {
    console.error('Error in getLevelUpAccuracyByDifficulty:', error);
    return emptyStats();
  }
}

function calculateStats(correct: number, total: number): AccuracyStats {
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  // console.log(`Overall Score: ${correct}/${total}`)
  return { accuracy, correct, total };
}

function emptyStats(): DifficultyAccuracyMap {
  return {
    easy: { accuracy: 0, correct: 0, total: 0 },
    medium: { accuracy: 0, correct: 0, total: 0 },
    hard: { accuracy: 0, correct: 0, total: 0 },
  };
}
