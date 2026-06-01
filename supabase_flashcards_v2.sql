-- Add exam_id column to adaptive_questions
ALTER TABLE public.adaptive_questions 
ADD COLUMN IF NOT EXISTS exam_id uuid REFERENCES public.exams(id);

-- Check constraints (Optional: If you want to ensure every question belongs to an exam eventually)
-- ALTER TABLE public.adaptive_questions ALTER COLUMN exam_id SET NOT NULL; 
-- (Kept nullable for now to avoid errors with existing data if any)

-- Update the fetch logic to include exam_id filtering in the future
-- (This is handled in the application code, but good to note)
