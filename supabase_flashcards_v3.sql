-- Migration to support tracking adaptive progress per Exam ID via JSONB

-- 1. Modify the table schema
ALTER TABLE public.user_adaptive_progress 
ADD COLUMN IF NOT EXISTS exam_progress JSONB DEFAULT '{}'::jsonb;

-- (Optional) If you want to migrate existing global data to a specific exam or default logic:
-- UPDATE public.user_adaptive_progress SET exam_progress = jsonb_build_object('legacy', jsonb_build_object('current_level', current_level, 'total_cards_swiped', total_cards_swiped));

-- Remove old columns (run this ONLY if you are sure you don't need them or have migrated)
-- ALTER TABLE public.user_adaptive_progress DROP COLUMN current_level;
-- ALTER TABLE public.user_adaptive_progress DROP COLUMN total_cards_swiped;


-- 2. Create RPC for atomic JSONB updates
CREATE OR REPLACE FUNCTION update_adaptive_progress(
  p_user_id uuid,
  p_exam_id text,
  p_level int,
  p_swiped int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_progress jsonb;
  v_new_data jsonb;
BEGIN
  -- Get current progress, or empty object if row doesn't exist
  SELECT exam_progress INTO v_current_progress 
  FROM user_adaptive_progress 
  WHERE user_id = p_user_id;
  
  IF v_current_progress IS NULL THEN
    v_current_progress := '{}'::jsonb;
  END IF;

  -- Build the new data object for this specific exam
  v_new_data := json_build_object(
    'current_level', p_level, 
    'total_cards_swiped', p_swiped,
    'updated_at', now()
  )::jsonb;

  -- Update the JSON object at the key p_exam_id
  -- jsonb_set(target, path, new_value, create_if_missing)
  -- We cast p_exam_id to text just to be safe, though it is input as text
  v_current_progress := jsonb_set(
    v_current_progress, 
    ARRAY[p_exam_id], 
    v_new_data, 
    true
  );

  -- Perform the UPSERT
  INSERT INTO user_adaptive_progress (user_id, exam_progress, last_synced_at)
  VALUES (p_user_id, v_current_progress, now())
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    exam_progress = EXCLUDED.exam_progress,
    last_synced_at = now();
END;
$$;
