import { getLevelUpAccuracyByDifficulty } from '@/lib/getLevelUpAccuracyByDifficulty';
import React, { useCallback, useState } from 'react';

type AccuracyStats = {
  accuracy: number;
  correct: number;
  total: number;
};

type DifficultyAccuracyMap = {
  easy: AccuracyStats;
  medium: AccuracyStats;
  hard: AccuracyStats;
};

export function useLevelUpAccuracy(userId?: string, examId?: string) {
  const [accuracyData, setAccuracyData] = useState<DifficultyAccuracyMap | null>(null);
  const [isLevelUpLoading, setIsLevelUpLoading] = useState(false);
  const [error, setError] = useState<null | string>(null);

  const refresh = useCallback(async () => {
    console.log("Refreshing...")
    if (!userId || !examId) return;
    try {
      setIsLevelUpLoading(true);
      const result = await getLevelUpAccuracyByDifficulty(userId, examId);
      setAccuracyData(result);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError('Failed to fetch accuracy data');
    } finally {
      setIsLevelUpLoading(false);
    }
  }, [userId, examId]);

  // Auto-refresh when userId changes and is truthy
  React.useEffect(() => {
    if (userId && examId) {
      refresh();
    }
  }, [userId, examId, refresh]);
console.log(`Result: ${accuracyData?.["medium"].accuracy}%`)
  return { accuracyData, isLevelUpLoading, error, refresh };
}

