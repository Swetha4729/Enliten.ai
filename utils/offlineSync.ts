import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

export const OFFLINE_DB_KEY = 'offline_question_bank';
export const OFFLINE_SYNC_QUEUE_SESSIONS = 'offline_sync_queue_sessions';
export const OFFLINE_SYNC_QUEUE_ANSWERS = 'offline_sync_queue_answers';

export async function checkNetwork(): Promise<boolean> {
    const net = await NetInfo.fetch();
    // Assume true if we can't determine (some platforms return null)
    return net.isConnected ?? true;
}

export async function prefetchOfflineBank(examId: string, userId: string | undefined, isPro: boolean) {
    const isConnected = await checkNetwork();
    if (!isConnected || !examId) return;

    try {
        const { data, error } = await supabase
            .rpc('fetch_mode_questions', {
                p_exam_id: examId,
                p_limit_count: 50, // Cache up to 50 questions for offline use
                p_user_id: userId || null,
                p_quiz_mode: 'quick_10',
                p_is_premium: isPro
            })
            .select(`
        id,
        question_text,
        explanation,
        difficulty,
        domain,
        question_options (
          id,
          option_text,
          option_letter,
          is_correct
        ),
        is_premium
      `);

        if (error) {
            console.warn('Silent offline prefetch warning:', error);
            return;
        }

        if (data && Array.isArray(data) && data.length > 0) {
            const formatted = (data as any[]).map(q => ({
                id: q.id,
                question_text: q.question_text,
                explanation: q.explanation,
                difficulty: q.difficulty,
                domain: q.domain,
                is_premium: q.is_premium,
                options: q.question_options?.sort((a: any, b: any) =>
                    (a.option_letter || '').localeCompare(b.option_letter || '')
                ) || []
            }));
            await AsyncStorage.setItem(OFFLINE_DB_KEY, JSON.stringify(formatted));
        }
    } catch (e) {
        console.warn("Offline bank prefetch failed:", e);
    }
}

export async function getOfflineQuestions(count: number = 10) {
    try {
        const cached = await AsyncStorage.getItem(OFFLINE_DB_KEY);
        if (!cached) return [];
        const questions = JSON.parse(cached);
        // Shuffle and pick
        const shuffled = questions.sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    } catch (e) {
        console.warn("Error reading offline questions", e);
        return [];
    }
}

export async function queueOfflineSession(sessionData: any, answersData: any[]) {
    try {
        // Session 
        const cachedSessionsStr = await AsyncStorage.getItem(OFFLINE_SYNC_QUEUE_SESSIONS);
        const cachedSessions = cachedSessionsStr ? JSON.parse(cachedSessionsStr) : [];

        // We mock an ID for the session so answers can link to it, 
        // but in reality we'll assign the real DB ID upon sync
        const sessionIdTemp = 'offline-' + Date.now() + Math.random();

        cachedSessions.push({ ...sessionData, _temp_id: sessionIdTemp });
        await AsyncStorage.setItem(OFFLINE_SYNC_QUEUE_SESSIONS, JSON.stringify(cachedSessions));

        // Answers
        const savedAnswersStr = await AsyncStorage.getItem(OFFLINE_SYNC_QUEUE_ANSWERS);
        const savedAnswers = savedAnswersStr ? JSON.parse(savedAnswersStr) : [];

        const mappedAnswers = answersData.map(a => ({ ...a, _temp_session_id: sessionIdTemp }));
        savedAnswers.push(...mappedAnswers);
        await AsyncStorage.setItem(OFFLINE_SYNC_QUEUE_ANSWERS, JSON.stringify(savedAnswers));

    } catch (e) {
        console.error("Failed to queue offline session", e);
    }
}

export async function syncOfflineQueues() {
    const isConnected = await checkNetwork();
    if (!isConnected) return;

    try {
        const sessionsStr = await AsyncStorage.getItem(OFFLINE_SYNC_QUEUE_SESSIONS);
        const answersStr = await AsyncStorage.getItem(OFFLINE_SYNC_QUEUE_ANSWERS);

        if (!sessionsStr) return; // nothing to sync

        const sessions = JSON.parse(sessionsStr);
        const answers = answersStr ? JSON.parse(answersStr) : [];

        if (sessions.length === 0) return;

        for (const session of sessions) {
            const tempId = session._temp_id;
            // remove temp ID before insert
            const { _temp_id, ...insertSessionData } = session;

            const { data: realSession, error: sessionError } = await supabase
                .from('quiz_sessions')
                .insert(insertSessionData)
                .select('id')
                .single();

            if (sessionError) {
                console.warn('Offline session sync error', sessionError);
                continue; // skip answers if session failed
            }

            const realSessionId = realSession.id;

            // Find matched answers
            const matchedAnswers = answers.filter((a: any) => a._temp_session_id === tempId);
            if (matchedAnswers.length > 0) {
                const insertAnswersData = matchedAnswers.map((a: any) => {
                    const { _temp_session_id, ...cleanAnswer } = a;
                    // IMPORTANT: Update quiz_session_id with the REAL generated ID
                    return { ...cleanAnswer, quiz_session_id: realSessionId };
                });

                const { error: answersError } = await supabase
                    .from('user_answers')
                    .insert(insertAnswersData);

                if (answersError) {
                    console.warn('Offline answers sync error', answersError);
                }
            }
        }

        // Clear queues upon success
        await AsyncStorage.removeItem(OFFLINE_SYNC_QUEUE_SESSIONS);
        await AsyncStorage.removeItem(OFFLINE_SYNC_QUEUE_ANSWERS);

    } catch (e) {
        console.error("Error syncing offline queues", e);
    }
}
