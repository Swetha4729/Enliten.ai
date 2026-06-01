import { useAuth } from '@/contexts/AuthContext';
import { useExam } from '@/contexts/ExamContext';
import { AdaptiveQuestion, DifficultyDistribution, fetchAdaptiveQuestions, getExamDifficultyDistribution, getUserAdaptiveProgress, logStudySession, resetAdaptiveProgress, syncUserProgress } from '@/lib/flashcards';
import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_USER_LEVEL = 50;
const MAX_QUESTION_TIER = 10;

export const useAdaptiveEngine = () => {
    const { user } = useAuth();
    const { exam } = useExam();
    const [queue, setQueue] = useState<AdaptiveQuestion[]>([]);
    const [currentLevel, setCurrentLevel] = useState(1);
    const [totalSwiped, setTotalSwiped] = useState(0);
    const [loading, setLoading] = useState(true);

    // Dynamic Engine Configuration
    const [difficultyWeights, setDifficultyWeights] = useState<DifficultyDistribution | null>(null);

    const [hasMore, setHasMore] = useState(true);

    const momentum = useRef(0);
    const logsBuffer = useRef<{ user_id: string, question_id: string, is_correct: boolean }[]>([]);
    const sessionAnsweredIds = useRef<Set<string>>(new Set());
    const isFetchingRef = useRef(false);

    // Helper: Map User Level (1-50) to Question Tier (1-10)
    const getTierForLevel = (level: number) => {
        // Linear mapping: 1-5 -> Tier 1, 45-50 -> Tier 10
        // Formula: ceil( (Level / 50) * 10 )
        let tier = Math.ceil((level / MAX_USER_LEVEL) * MAX_QUESTION_TIER);
        return Math.max(1, Math.min(10, tier));
    };

    // Initial Load & Config
    useEffect(() => {
        if (!user) return;

        const init = async () => {
            setLoading(true);
            setHasMore(true);

            if (exam?.id) {
                // 1. Configure Engine (Get Difficulty Distribution & Weights)
                const distribution = await getExamDifficultyDistribution(exam.id);
                setDifficultyWeights(distribution);

                // 2. Fetch Progress
                const progress = await getUserAdaptiveProgress(user.id, exam.id);
                let level = 1;
                let swiped = 0;
                if (progress) {
                    level = progress.current_level;
                    swiped = progress.total_cards_swiped;
                }
                setCurrentLevel(level);
                setTotalSwiped(swiped);

                // 3. Fetch Initial Cards (Mapped Tier)
                const targetTier = getTierForLevel(level);
                const cards = await fetchAdaptiveQuestions(user.id, targetTier, exam.id, 20);
                setQueue(cards);
                if (cards.length < 5) setHasMore(false);
            }
            setLoading(false);
        };

        init();

        return () => {
            if (user && logsBuffer.current.length > 0) {
                logStudySession([...logsBuffer.current]);
            }
        }
    }, [user, exam]);

    const flushLogs = async () => {
        if (!user) return;
        const logsToSave = [...logsBuffer.current];
        logsBuffer.current = [];
        if (logsToSave.length > 0) {
            await logStudySession(logsToSave);
        }
    }

    const syncProgress = async (lvl: number, swiped: number) => {
        if (!user || !exam?.id) return;
        await syncUserProgress(user.id, exam.id, lvl, swiped);
    }

    // Monitor Queue (using Mapped Tiers)
    useEffect(() => {
        if (queue.length < 10 && hasMore && !isFetchingRef.current && user && !loading && exam?.id) {
            isFetchingRef.current = true;
            const excluded = [...queue.map(q => q.id), ...Array.from(sessionAnsweredIds.current)];

            // Map current User Level to Question Tier
            const targetTier = getTierForLevel(currentLevel);

            fetchAdaptiveQuestions(user.id, targetTier, exam.id, 20, excluded).then(newCards => {
                if (newCards.length === 0) {
                    setHasMore(false);
                } else {
                    setQueue(prev => {
                        const existingIds = new Set(prev.map(p => p.id));
                        const uniqueNew = newCards.filter(c => !existingIds.has(c.id));
                        return [...prev, ...uniqueNew];
                    });
                }
                isFetchingRef.current = false;
            });
        }
    }, [queue.length, currentLevel, user, loading, exam, hasMore]);

    const handleSwipe = useCallback(async (direction: 'left' | 'right', questionId: string) => {
        if (!user) return;

        const currentQ = queue.find(q => q.id === questionId);
        // Default to current TIER if not found
        const currentTier = getTierForLevel(currentLevel);
        const qTier = currentQ?.difficulty_tier || currentTier;

        const isCorrect = direction === 'right';
        let newLevel = currentLevel;

        // Dynamic Weighted Momentum based on Question Difficulty
        // CORRECT: Easy = small reward, Hard = big reward
        // WRONG: Easy = BIG penalty (you should know this!), Hard = small penalty (understandable)
        let change = 0;
        if (difficultyWeights) {
            if (isCorrect) {
                // Normal weights for correct answers
                if (qTier <= 3) change = difficultyWeights.easyWeight;
                else if (qTier <= 7) change = difficultyWeights.mediumWeight;
                else change = difficultyWeights.hardWeight;
            } else {
                // INVERSE weights for wrong answers
                if (qTier <= 3) change = -difficultyWeights.hardWeight;   // Easy wrong = big penalty
                else if (qTier <= 7) change = -difficultyWeights.mediumWeight;
                else change = -difficultyWeights.easyWeight;              // Hard wrong = small penalty
            }
        } else {
            // Fallback
            change = isCorrect ? 1.0 : -1.0;
        }

        momentum.current += change;

        // Level threshold is always 1.0 since weights are pre-scaled
        const threshold = 1.0;

        // Check against threshold (now 1.0 since weights are pre-scaled)
        if (momentum.current >= threshold) {
            const steps = Math.floor(momentum.current / threshold);
            if (steps >= 1) {
                newLevel = Math.min(MAX_USER_LEVEL, currentLevel + steps);
                momentum.current -= (steps * threshold);
                if (momentum.current > threshold) momentum.current = threshold;
            }
        }
        else if (momentum.current <= -threshold) {
            const steps = Math.floor(Math.abs(momentum.current) / threshold);
            if (steps >= 1) {
                newLevel = Math.max(1, currentLevel - steps);
                momentum.current += (steps * threshold);
                if (momentum.current < -threshold) momentum.current = -threshold;
            }
        }

        if (newLevel !== currentLevel) {
            setCurrentLevel(newLevel);
        }

        logsBuffer.current.push({
            user_id: user.id,
            question_id: questionId,
            is_correct: isCorrect
        });

        if (isCorrect) {
            sessionAnsweredIds.current.add(questionId);
        }

        setQueue(prev => {
            const remaining = prev.filter(q => q.id !== questionId);
            if (!isCorrect && currentQ) {
                const retriedQuestion = {
                    ...currentQ,
                    retry_count: (currentQ.retry_count || 0) + 1
                };
                return [...remaining, retriedQuestion];
            }
            return remaining;
        });

        setTotalSwiped(prev => {
            const newVal = prev + 1;
            if (logsBuffer.current.length >= 5) {
                flushLogs();
                syncProgress(newLevel, newVal);
            }
            return newVal;
        });
    }, [user, currentLevel, queue, difficultyWeights]);

    const saveProgress = async () => {
        await flushLogs();
        await syncProgress(currentLevel, totalSwiped);
    }

    const reset = async () => {
        if (!user) return;
        setLoading(true);
        setQueue([]);
        setHasMore(true);
        logsBuffer.current = [];
        sessionAnsweredIds.current.clear();

        try {
            await resetAdaptiveProgress(user.id, exam?.id);
            setCurrentLevel(1);
            setTotalSwiped(0);

            if (exam?.id) {
                const cards = await fetchAdaptiveQuestions(user.id, 1, exam.id, 20); // Tier 1
                setQueue(cards);
                if (cards.length < 5) setHasMore(false);
            }
        } catch (e) {
            console.error("Reset failed", e);
        } finally {
            setLoading(false);
        }
    }

    return {
        queue,
        currentLevel,
        loading,
        handleSwipe,
        saveProgress,
        totalSwiped,
        reset
    };
};
