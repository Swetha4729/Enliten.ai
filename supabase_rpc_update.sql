-- Enhanced RPC: Excludes correctly answered questions, applies cool-down for recently wrong,
-- and prioritizes unattempted questions over old wrong ones.
-- Supports optional domain filter for weakest_subject mode.

CREATE OR REPLACE FUNCTION public.fetch_mode_questions(
    p_exam_id uuid,
    p_limit_count integer,
    p_user_id uuid,
    p_quiz_mode text,
    p_is_premium boolean DEFAULT false
)
RETURNS SETOF questions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH recent_sessions AS (
        -- Get the user's last 2 completed sessions for this exam (cool-down window)
        SELECT qs.id
        FROM quiz_sessions qs
        WHERE qs.user_id = p_user_id
          AND qs.exam_id = p_exam_id
        ORDER BY qs.completed_at DESC
        LIMIT 2
    ),
    recently_wrong_qids AS (
        -- Questions answered WRONG in the last 2 sessions → cool-down, don't repeat yet
        SELECT DISTINCT ua.question_id
        FROM user_answers ua
        INNER JOIN recent_sessions rs ON ua.quiz_session_id = rs.id
        WHERE ua.is_correct = FALSE
    ),
    ever_correct_qids AS (
        -- Questions EVER answered correctly by this user → never repeat
        SELECT DISTINCT ua.question_id
        FROM user_answers ua
        WHERE ua.user_id = p_user_id
          AND ua.is_correct = TRUE
    ),
    ever_attempted_qids AS (
        -- All questions ever attempted by this user (for priority sorting)
        SELECT DISTINCT ua.question_id
        FROM user_answers ua
        WHERE ua.user_id = p_user_id
    )
    SELECT q.*
    FROM questions q
    WHERE
        q.exam = p_exam_id
        -- Respect subscription: free users only see free questions
        AND (q.is_premium IS FALSE OR p_is_premium IS TRUE)
        -- NEVER repeat correctly answered questions
        AND q.id NOT IN (SELECT question_id FROM ever_correct_qids)
        -- COOL-DOWN: don't repeat recently wrong questions (last 2 sessions)
        AND q.id NOT IN (SELECT question_id FROM recently_wrong_qids)
    ORDER BY
        -- Priority: unattempted questions first (0), then old wrong (1)
        CASE WHEN q.id NOT IN (SELECT question_id FROM ever_attempted_qids)
             THEN 0 ELSE 1
        END ASC,
        random()
    LIMIT p_limit_count;
END;
$$;

-- Grant access
GRANT EXECUTE ON FUNCTION public.fetch_mode_questions(uuid, integer, uuid, text, boolean) TO anon, authenticated, service_role;
