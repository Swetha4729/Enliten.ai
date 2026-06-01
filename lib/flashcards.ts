import { supabase } from '@/lib/supabase';

export interface AdaptiveQuestion {
    id: string;
    question_text: string;
    answer_text: string;
    difficulty_tier: number;
    domain: string;
    status: 'active' | 'experimental' | 'retired';
    exposure_count: number;
    correct_count: number;
    p_value_realized: number;
    created_at: string;
    exam_id?: string;
    retry_count?: number; // Local tracking for re-queueing
}

const scanForQuestions = async (
    examId: string,
    targetLvl: number | null, // null means "any level"
    limit: number,
    excludedIds: Set<string>
): Promise<AdaptiveQuestion[]> => {
    let found: AdaptiveQuestion[] = [];
    const useDbFilter = excludedIds.size < 50;

    const PAGE_SIZE = 200;
    let offset = 0;
    const MAX_SCAN_ROWS = 2000;

    while (found.length < limit && offset < MAX_SCAN_ROWS) {
        let query = supabase
            .from('adaptive_questions')
            .select('*')
            .eq('exam_id', examId)
            .in('status', ['active', 'experimental']);

        if (targetLvl !== null) {
            query = query.eq('difficulty_tier', targetLvl);
        }

        if (useDbFilter && excludedIds.size > 0) {
            const filterArray = Array.from(excludedIds);
            const filterString = `(${filterArray.map(id => `"${id}"`).join(',')})`;
            query = query.filter('id', 'not.in', filterString);
            query = query.range(offset, offset + PAGE_SIZE - 1);
        } else {
            query = query.range(offset, offset + PAGE_SIZE - 1);
        }

        const { data, error } = await query;

        if (error) {
            console.error("Scan Error:", error);
            break;
        }

        if (!data || data.length === 0) {
            break;
        }

        const candidates = (data as AdaptiveQuestion[]).filter(q => !excludedIds.has(q.id));

        for (const q of candidates) {
            if (found.length < limit) {
                found.push(q);
            }
        }

        if (useDbFilter && data.length < PAGE_SIZE) {
            break;
        }

        offset += PAGE_SIZE;
    }

    return found;
};

export const fetchAdaptiveQuestions = async (
    userId: string | undefined,
    targetLevel: number,
    examId: string,
    limit: number = 20,
    excludeIds: string[] = []
): Promise<AdaptiveQuestion[]> => {
    // 1. Get IDs of questions already answered correctly by this user
    let answeredIds: Set<string> = new Set();
    if (userId) {
        const { data: logs } = await supabase
            .from('user_study_logs')
            .select('question_id')
            .eq('user_id', userId)
            .eq('is_correct', true);

        if (logs) {
            logs.forEach(l => answeredIds.add(l.question_id));
        }
    }

    // Combine locally excluded IDs (queue) with persistent answered IDs
    const allExcludedIds = new Set([...excludeIds, ...answeredIds]);

    try {
        const easyCount = Math.floor(limit * 0.2);
        const currentCount = Math.floor(limit * 0.4);
        const hardCount = limit - easyCount - currentCount;

        const lowerLvl = Math.max(1, targetLevel - 1);
        const upperLvl = Math.min(10, targetLevel + 1);

        const tasks: Promise<AdaptiveQuestion[]>[] = [];

        if (lowerLvl === targetLevel) {
            tasks.push(scanForQuestions(examId, targetLevel, easyCount + currentCount, allExcludedIds));
        } else {
            tasks.push(scanForQuestions(examId, lowerLvl, easyCount, allExcludedIds));
            tasks.push(scanForQuestions(examId, targetLevel, currentCount, allExcludedIds));
        }
        tasks.push(scanForQuestions(examId, upperLvl, hardCount, allExcludedIds));

        const results = await Promise.all(tasks);
        let combined = results.flat();

        combined.forEach(q => allExcludedIds.add(q.id));

        if (combined.length < limit) {
            const needed = limit - combined.length;
            const fillers = await scanForQuestions(examId, null, needed, allExcludedIds);

            fillers.sort((a, b) => {
                const distA = Math.abs(a.difficulty_tier - targetLevel);
                const distB = Math.abs(b.difficulty_tier - targetLevel);
                return distA - distB;
            });

            combined = [...combined, ...fillers];
        }

        const uniqueMap = new Map<string, AdaptiveQuestion>();
        combined.forEach(q => uniqueMap.set(q.id, q));

        const finalQuestions = Array.from(uniqueMap.values());
        return finalQuestions.sort(() => Math.random() - 0.5);

    } catch (err) {
        console.error("Error in fetchAdaptiveQuestions", err);
        return [];
    }
};

export const syncUserProgress = async (userId: string, examId: string, level: number, totalSwiped: number) => {
    // Use RPC for atomic JSONB update
    const { error } = await supabase.rpc('update_adaptive_progress', {
        p_user_id: userId,
        p_exam_id: examId,
        p_level: level,
        p_swiped: totalSwiped
    });
    if (error) console.error("Sync progress error:", error);
};

export const logStudySession = async (logs: { user_id: string, question_id: string, is_correct: boolean }[]) => {
    if (logs.length === 0) return;
    const { error } = await supabase.from('user_study_logs').insert(logs);
    if (error) console.error("Log study session error:", error);
};

export const getUserAdaptiveProgress = async (userId: string, examId: string) => {
    const { data, error } = await supabase
        .from('user_adaptive_progress')
        .select('exam_progress')
        .eq('user_id', userId)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error("Get progress error:", error);
    }

    if (data?.exam_progress && data.exam_progress[examId]) {
        return data.exam_progress[examId] as { current_level: number, total_cards_swiped: number };
    }

    return null;
}

export const resetAdaptiveProgress = async (userId: string, examId?: string) => {
    if (examId) {
        // Exam-specific reset
        console.log('[Flashcards] Step 1: Starting reset for:', { userId, examId });

        // 1. Reset progress via RPC
        console.log('[Flashcards] Step 2: Calling RPC...');
        const { error: progressError } = await supabase.rpc('reset_adaptive_progress_v2', {
            p_user_id: userId,
            p_exam_id: examId,
            p_level: 1,
            p_swiped: 0
        });

        if (progressError) {
            console.error('[Flashcards] Step 2 FAILED - RPC Error:', progressError);
            throw progressError;
        }
        console.log('[Flashcards] Step 2: RPC successful');

        // 2. Fetch question IDs for this exam
        console.log('[Flashcards] Step 3: Fetching adaptive_questions...');
        const { data: questions, error: qError } = await supabase
            .from('adaptive_questions')
            .select('id')
            .eq('exam_id', examId);

        if (qError) {
            console.error('[Flashcards] Step 3 FAILED - Query Error:', qError);
            throw qError;
        }
        console.log('[Flashcards] Step 3: Found', questions?.length || 0, 'questions');

        // 3. Delete study logs for these questions (in batches to avoid URL length limits)
        if (questions && questions.length > 0) {
            const qIds = questions.map(q => q.id);
            const BATCH_SIZE = 50;
            const totalBatches = Math.ceil(qIds.length / BATCH_SIZE);

            console.log('[Flashcards] Step 4: Deleting user_study_logs in', totalBatches, 'batches...');

            for (let i = 0; i < qIds.length; i += BATCH_SIZE) {
                const batch = qIds.slice(i, i + BATCH_SIZE);
                const batchNum = Math.floor(i / BATCH_SIZE) + 1;

                const { error: logsError } = await supabase
                    .from('user_study_logs')
                    .delete()
                    .eq('user_id', userId)
                    .in('question_id', batch);

                if (logsError) {
                    console.error(`[Flashcards] Step 4 FAILED - Batch ${batchNum} Error:`, logsError);
                    throw logsError;
                }
            }
            console.log('[Flashcards] Step 4: All logs deleted successfully');
        } else {
            console.log('[Flashcards] Step 4: Skipped (no questions to delete logs for)');
        }

        console.log('[Flashcards] Reset complete!');
    } else {
        // Global Reset: Wipe everything
        // 1. Reset progress (empty JSON)
        const { error: progressError } = await supabase
            .from('user_adaptive_progress')
            .upsert({ user_id: userId, exam_progress: {} });

        if (progressError) throw progressError;

        // 2. Delete ALL logs
        const { error: logsError } = await supabase
            .from('user_study_logs')
            .delete()
            .eq('user_id', userId);

        if (logsError) throw logsError;
    }

    return true;
};
export interface DifficultyDistribution {
    total: number;
    easyCount: number;   // Tier 1-3
    mediumCount: number; // Tier 4-7
    hardCount: number;   // Tier 8-10
    // Dynamic weights scaled so all correct = 50 levels
    easyWeight: number;
    mediumWeight: number;
    hardWeight: number;
}

export const getExamDifficultyDistribution = async (examId: string): Promise<DifficultyDistribution> => {
    // Fetch all questions with their tiers
    const { data, error } = await supabase
        .from('adaptive_questions')
        .select('difficulty_tier')
        .eq('exam_id', examId)
        .in('status', ['active', 'experimental']);

    if (error || !data) {
        console.error("Error fetching distribution:", error);
        // Fallback: assume flat distribution
        return {
            total: 50,
            easyCount: 17, mediumCount: 17, hardCount: 16,
            easyWeight: 1, mediumWeight: 1, hardWeight: 1
        };
    }

    let easyCount = 0, mediumCount = 0, hardCount = 0;

    data.forEach(q => {
        const tier = q.difficulty_tier;
        if (tier <= 3) easyCount++;
        else if (tier <= 7) mediumCount++;
        else hardCount++;
    });

    const total = data.length;

    // Base ratios: Easy = 0.5, Medium = 1.0, Hard = 2.0
    const BASE_EASY = 0.5;
    const BASE_MEDIUM = 1.0;
    const BASE_HARD = 2.0;
    const TARGET_LEVELS = 50;

    // Raw total points if using base ratios
    const rawTotal = (easyCount * BASE_EASY) + (mediumCount * BASE_MEDIUM) + (hardCount * BASE_HARD);

    // Scale factor to make total = 50 levels worth of points
    const scaleFactor = rawTotal > 0 ? TARGET_LEVELS / rawTotal : 1;

    return {
        total,
        easyCount,
        mediumCount,
        hardCount,
        easyWeight: BASE_EASY * scaleFactor,
        mediumWeight: BASE_MEDIUM * scaleFactor,
        hardWeight: BASE_HARD * scaleFactor
    };
};

// Backward compat helper
export const getExamQuestionCount = async (examId: string): Promise<number> => {
    const dist = await getExamDifficultyDistribution(examId);
    return dist.total;
};
