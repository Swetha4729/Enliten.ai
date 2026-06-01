import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://nufmkzmukwplugqvtiie.supabase.co";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51Zm1rem11a3dwbHVncXZ0aWllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3Nzk3NzgsImV4cCI6MjA5MDM1NTc3OH0.-rYm-UnMSbEJQCowxU2RpvsNT3k27O2zH93D9ohZpz0";
if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
  console.warn('[supabase.ts] Using fallback Supabase URL or anon key! Check your production environment variables.');
}
export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      // debug: __DEV__,
      debug: false
    },
  })
