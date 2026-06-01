import { supabase } from '@/lib/supabase';

export async function updateProgress(userId: string, sessionData: {
  questionsAnswered: number;
  correctAnswers: number;
  timeTaken: number;
}) {
  try {
    const { data: progress, error: progressError } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', userId)
      .single();

    const today = new Date().toISOString().split('T')[0];
    const lastStudied = progress?.last_studied ? new Date(progress.last_studied) : null;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    let newStreak = 1;
    if (lastStudied) {
      if (lastStudied.toISOString().split('T')[0] === yesterday.toISOString().split('T')[0]) {
        newStreak = (progress?.study_streak || 0) + 1;
      } else if (lastStudied.toISOString().split('T')[0] === today) {
        newStreak = progress?.study_streak || 1;
      }
    }

    const { error: updateError } = await supabase
      .from('user_progress')
      .upsert({
        user_id: userId,
        questions_answered: (progress?.questions_answered || 0) + sessionData.questionsAnswered,
        questions_correct: (progress?.questions_correct || 0) + sessionData.correctAnswers,
        last_studied: new Date().toISOString(),
        study_streak: newStreak,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (updateError) throw updateError;
  } catch (error) {
    console.error('Error updating progress:', error);
    throw error;
  }
}
