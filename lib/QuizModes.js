import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

export const useQuizModes = () => {
  return useQuery({
    queryKey: ['quiz_modes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quiz_modes')
        .select('*')
        .eq('is_active', true)
        .in('id', [
          'flashcard',
          'daily',
          'quick_10',
          'timed',
          'level_up',
          'missed',
          'weakest_subject',
          'full_test',
          'custom',
          'pyq'
        ])
        .order('order_index', { ascending: true });
      if (error) {
        throw new Error(error.message);
      }
      return data;
    },
    staleTime: 1000 * 60 * 5, // cache is fresh for 5 mins
    gcTime: 1000 * 60 * 30, // keep in cache for 30 mins
    refetchOnWindowFocus: false,
    retry: 1,
  });
};
