import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { User } from '@/types';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  loading: boolean;
  error?: Error | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Timeout fallback: if loading is still true after 10s, force it to false and log
  useEffect(() => {
    if (!loading) return;
    const timeout = setTimeout(() => {
      if (loading) {
        console.error('[AuthProvider] Timeout: loading still true after 10s, forcing false');
        setLoading(false);
        setError(new Error('Timeout: Auth loading took too long'));
      }
    }, 10000);
    return () => clearTimeout(timeout);
  }, [loading]);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      console.log('[AuthProvider] Initial session:', session);
      if (session?.user) {
        fetchUserProfile(session.user);
      }
      setLoading(false);
    }).catch((err) => {
      console.error('[AuthProvider] Error getting initial session:', err);
      setLoading(false);
      setError(err);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      console.log('[AuthProvider] Auth state changed:', event, session);
      if (session?.user) {
        await fetchUserProfile(session.user);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (supabaseUser: SupabaseUser) => {
    console.log('[AuthProvider] fetchUserProfile called', supabaseUser?.id);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', supabaseUser.id)
        .single();

      if (error && error.code === 'PGRST116') {
        // Create initial user profile if not exists
        const newUser = {
          id: supabaseUser.id,
          email: supabaseUser.email!,
          full_name: supabaseUser.user_metadata?.full_name || '',
          subscription_status: 'free' as const,
        };

        const { data: createdUser, error: createError } = await supabase
          .from('users')
          .upsert(newUser)
          .select()
          .single();

        if (createError) throw createError;
        setUser(createdUser);
        console.log('[AuthProvider] Created new user profile', createdUser);
      } else if (error) {
        console.error('[AuthProvider] Error fetching user:', error);
        setUser(null);
        setError(error);
      } else {
        setUser(data);
        console.log('[AuthProvider] Loaded user profile', data);
      }
    } catch (error) {
      console.error('[AuthProvider] Error in fetchUserProfile:', error);
      setUser(null);
      setError(error as Error);
    } finally {
      setLoading(false);
    }
  };


  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  console.log('[AuthProvider] Rendering provider', { session, user, loading, error });
  return (
    <AuthContext.Provider value={{
      session,
      user,
      signUp,
      signIn,
      signOut,
      loading,
      error,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}