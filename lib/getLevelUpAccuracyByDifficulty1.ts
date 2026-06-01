import { supabase } from '@/lib/supabase';

type DifficultyLevel = 'easy' | 'medium' | 'hard';

interface Answer {
  question_id: string;
  is_correct: boolean;
}

interface Question {
  id: string;
  difficulty: DifficultyLevel;
}

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

export async function getLevelUpAccuracyByDifficulty(userId: string): Promise<DifficultyAccuracyMap> {
  try {
    console.log(`User ID: ${userId}`)
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

    const uniqueQuestionIds = Array.from(new Set((answers ?? []).map(a => a.question_id)));

    if (uniqueQuestionIds.length === 0) return emptyStats();

    const { data: questions, error: questionError } = await supabase
      .from('questions')
      .select('id, difficulty')
      .in('id', uniqueQuestionIds);

    if (questionError) throw questionError;

    const difficultyMap: Record<DifficultyLevel, Map<string, boolean>> = {
      easy: new Map(),
      medium: new Map(),
      hard: new Map(),
    };

    const questionDifficultyMap = new Map<string, DifficultyLevel>(
      (questions ?? []).map((q: Question) => [q.id, q.difficulty])
    );

    for (const answer of answers ?? []) {
      const difficulty = questionDifficultyMap.get(answer.question_id);
      if (!difficulty) continue;

      const levelMap = difficultyMap[difficulty];
      if (!levelMap.has(answer.question_id)) {
        levelMap.set(answer.question_id, answer.is_correct);
      } else if (answer.is_correct) {
        levelMap.set(answer.question_id, true); // upgrade to correct if any correct
      }
    }

    const result: DifficultyAccuracyMap = {
      easy: calculateStats(difficultyMap.easy),
      medium: calculateStats(difficultyMap.medium),
      hard: calculateStats(difficultyMap.hard),
    };
console.log(`Result: ${result}`)
    return result;
  } catch (error) {
    console.error('Error in getLevelUpAccuracyByDifficulty:', error);
    return emptyStats();
  }
}

function calculateStats(map: Map<string, boolean>): AccuracyStats {
  const total = map.size;
  const correct = Array.from(map.values()).filter(Boolean).length;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  return { accuracy, correct, total };
}

function emptyStats(): DifficultyAccuracyMap {
  return {
    easy: { accuracy: 0, correct: 0, total: 0 },
    medium: { accuracy: 0, correct: 0, total: 0 },
    hard: { accuracy: 0, correct: 0, total: 0 },
  };
}
