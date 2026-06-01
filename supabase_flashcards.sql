-- 1. Table: adaptive_questions
CREATE TABLE IF NOT EXISTS public.adaptive_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  question_text text NOT NULL,
  answer_text text NOT NULL,
  difficulty_tier integer NOT NULL CHECK (difficulty_tier >= 1 AND difficulty_tier <= 10),
  domain text NOT NULL,
  status text NOT NULL DEFAULT 'experimental' CHECK (status IN ('active', 'experimental', 'retired')),
  exposure_count integer DEFAULT 0,
  correct_count integer DEFAULT 0,
  p_value_realized float DEFAULT 0.0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT adaptive_questions_pkey PRIMARY KEY (id)
);

-- 2. Table: user_adaptive_progress
CREATE TABLE IF NOT EXISTS public.user_adaptive_progress (
  user_id uuid NOT NULL,
  current_level integer DEFAULT 1 CHECK (current_level >= 1 AND current_level <= 10),
  total_cards_swiped integer DEFAULT 0,
  last_synced_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_adaptive_progress_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_adaptive_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- 3. Table: user_study_logs
CREATE TABLE IF NOT EXISTS public.user_study_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  question_id uuid NOT NULL,
  is_correct boolean NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_study_logs_pkey PRIMARY KEY (id),
  CONSTRAINT user_study_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT user_study_logs_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.adaptive_questions(id)
);

-- Phase 2: Backend Logic (Auto-Calibration)
-- Function to handle the math automatically
CREATE OR REPLACE FUNCTION handle_adaptive_calibration()
RETURNS TRIGGER AS $$
DECLARE
  q_row record;
  new_exposure_count int;
  new_correct_count int;
  new_p_value float;
  new_difficulty int;
  new_status text;
BEGIN
  -- Step 1: Find the related question
  SELECT * FROM public.adaptive_questions WHERE id = NEW.question_id INTO q_row;
  
  IF q_row IS NULL THEN
    RETURN NEW;
  END IF;

  -- Step 2: Increment exposure_count
  new_exposure_count := q_row.exposure_count + 1;

  -- Step 3: Increment correct_count if correct
  IF NEW.is_correct THEN
    new_correct_count := q_row.correct_count + 1;
  ELSE
    new_correct_count := q_row.correct_count;
  END IF;

  -- Step 4: Recalculate p_value_realized
  new_p_value := new_correct_count::float / new_exposure_count::float;

  new_difficulty := q_row.difficulty_tier;
  new_status := q_row.status;

  -- Step 5: Auto-update difficulty_tier based on p_value_realized (only after 50 exposures)
  IF new_exposure_count > 50 THEN
    IF new_p_value > 0.85 THEN
      -- Too Easy -> Lower the Difficulty Tier by 1 (Min 1)
      new_difficulty := GREATEST(1, q_row.difficulty_tier - 1);
    ELSIF new_p_value < 0.30 THEN
      -- Too Hard -> Increase the Difficulty Tier by 1 (Max 10)
      new_difficulty := LEAST(10, q_row.difficulty_tier + 1);
    END IF;
  END IF;

  -- Step 6: If exposure_count > 2000, set status to 'retired'
  IF new_exposure_count > 2000 THEN
    new_status := 'retired';
  END IF;

  -- Update the question
  UPDATE public.adaptive_questions
  SET 
    exposure_count = new_exposure_count,
    correct_count = new_correct_count,
    p_value_realized = new_p_value,
    difficulty_tier = new_difficulty,
    status = new_status
  WHERE id = NEW.question_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger
DROP TRIGGER IF EXISTS trigger_adaptive_calibration ON public.user_study_logs;
CREATE TRIGGER trigger_adaptive_calibration
AFTER INSERT ON public.user_study_logs
FOR EACH ROW
EXECUTE FUNCTION handle_adaptive_calibration();
