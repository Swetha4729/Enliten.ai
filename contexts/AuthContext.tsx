import { supabase } from '@/lib/supabase';
import { User } from '@/types';
import { syncOfflineQueues } from '@/utils/offlineSync';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert, AppState } from 'react-native';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null; data?: any }>;
  loading: boolean;
  error?: Error | null;
  /**
   * True if the user must login (not loading, and either session or user is missing).
   * Use this in your navigation/layout to redirect to login screen if true.
   */
  loginRequired: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Ensure WebBrowser result is handled (required for Android)
WebBrowser.maybeCompleteAuthSession();

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Phase 1: AppState Handler
  // Explicitly tell Supabase to start/stop refreshing tokens based on app state
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Phase 2: Initialization Fix
  // Fetch session immediately, don't rely solely on the listener for initial load
  useEffect(() => {
    let mounted = true;

    const initSession = async () => {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (mounted) {
          setSession(initialSession);
          if (!initialSession) {
            setLoading(false);
          }
        }
      } catch (err: any) {
        console.error('[AuthProvider] Init session error:', err);
        if (mounted) {
          setError(err);
          setLoading(false);
        }
      }
    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (mounted) {
        console.log('[AuthContext] Auth State Change:', event);
        setSession(newSession);

        if (event === 'PASSWORD_RECOVERY') {
          // User clicked the reset link and is now implicitly signed in.
          // Redirect them to the update password screen.
          router.replace('/auth/update-password');
        }

        // If session is wiped, clear user and stop loading immediately
        if (!newSession) {
          setUser(null);
          setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Phase 3: Deep Link Handling for Password Reset & Auth Callbacks
  const processedCodes = React.useRef<Set<string>>(new Set());

  useEffect(() => {
    const handleDeepLink = async (url: string | null) => {
      if (!url) return;

      console.log('[AuthProvider] Received deep link:', url);

      try {
        // Helper to extract params from hash or query
        const getParam = (paramName: string) => {
          // Handle both ?param=val and #param=val and &param=val
          const regex = new RegExp(`[?&#]${paramName}=([^&]+)`);
          const match = url.match(regex);
          return match ? decodeURIComponent(match[1]) : null;
        };

        const code = getParam('code');
        const accessToken = getParam('access_token');
        const refreshToken = getParam('refresh_token');
        const type = getParam('type');
        const errorDesc = getParam('error_description');

        if (errorDesc) {
          console.error('[AuthProvider] Deep link contains error:', errorDesc);
          Alert.alert('Auth Error', errorDesc);
          return;
        }

        if (code) {
          if (processedCodes.current.has(code)) {
            console.log('[AuthProvider] Code already processed, ignoring:', code);
            return;
          }
          processedCodes.current.add(code);

          console.log('[AuthProvider] Found PKCE code. Exchanging for session...');
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error('[AuthProvider] Exchange code error:', error);
            // Only alert if it's a genuine error, not a race condition we missed
            // Alert.alert('Link Expired', 'This link is invalid or has expired.');
          } else {
            console.log('[AuthProvider] Successfully exchanged code for session.', data.session?.user?.id);
          }
          return;
        }

        if (accessToken && refreshToken) {
          console.log('[AuthProvider] Found tokens. AccessLen:', accessToken.length, 'RefreshLen:', refreshToken.length, 'Type:', type);

          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            console.error('[AuthProvider] setSession failed:', error);
            console.log('[AuthProvider] Error details:', JSON.stringify(error, null, 2));
          } else {
            console.log('[AuthProvider] Session set successfully from tokens.');
          }
          return;
        }

        console.log('[AuthProvider] No auth params found in link.');

      } catch (err) {
        console.error('[AuthProvider] Error processing deep link:', err);
      }
    };

    // Handle app opening from closed state
    Linking.getInitialURL().then(handleDeepLink);

    // Handle incoming links while app is open
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Phase 4: Deadlock Prevention & Decoupled Data Fetching
  // Respond to session changes instead of blocking auth listener
  useEffect(() => {
    let mounted = true;

    const handleSessionUser = async () => {
      if (!session?.user) return;

      try {
        await fetchUserProfile(session.user);
      } catch (err: any) {
        console.error('[AuthProvider] Profile fetch error:', err);
        if (mounted) setError(err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    handleSessionUser();

    return () => {
      mounted = false;
    };
  }, [session]);

  const fetchUserProfile = async (supabaseUser: SupabaseUser) => {
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
          // Use provider metadata if available (for Google sign in)
          full_name: supabaseUser.user_metadata?.full_name || '',
          avatar_url: supabaseUser.user_metadata?.avatar_url || supabaseUser.user_metadata?.picture || null,
          subscription_status: 'free' as const,
        };

        const { data: createdUser, error: createError } = await supabase
          .from('users')
          .upsert(newUser)
          .select()
          .single();

        if (createError) throw createError;
        setUser(createdUser);
        AsyncStorage.setItem('cached_user_profile', JSON.stringify(createdUser)).catch(() => { });
        console.log('[AuthProvider] Created new user profile', createdUser);
      } else if (error) {
        throw error;
      } else {
        // Sync avatar if missing in DB but present in auth metadata (e.g. from Google)
        if (!data.avatar_url && (supabaseUser.user_metadata?.avatar_url || supabaseUser.user_metadata?.picture)) {
          const newAvatar = supabaseUser.user_metadata.avatar_url || supabaseUser.user_metadata.picture;
          const { data: updatedUser, error: updateError } = await supabase
            .from('users')
            .update({ avatar_url: newAvatar })
            .eq('id', data.id)
            .select()
            .single();

          if (!updateError && updatedUser) {
            setUser(updatedUser);
            AsyncStorage.setItem('cached_user_profile', JSON.stringify(updatedUser)).catch(() => { });
            console.log('[AuthProvider] Loaded and updated user profile', updatedUser);
            return;
          }
        }

        setUser(data);
        AsyncStorage.setItem('cached_user_profile', JSON.stringify(data)).catch(() => { });
        console.log('[AuthProvider] Loaded user profile', data);

        // Trigger generic background sync for any queued offline data!
        syncOfflineQueues().catch((e) => console.log('Offline sync failed on boot', e));
      }
    } catch (error: any) {
      console.error('[AuthProvider] Error in fetchUserProfile:', error);

      // If it's a network issue or timeout, don't force them out. Use a fallback user object.
      // This prevents the app from "crashing" to the login screen just because of poor internet.
      const isNetworkError = error?.message?.includes('Network') || error?.message?.includes('fetch');

      if (isNetworkError) {
        console.warn('[AuthProvider] Network error getting profile. Checking for cached profile...');
        try {
          const cachedProfile = await AsyncStorage.getItem('cached_user_profile');
          if (cachedProfile) {
            console.log('[AuthProvider] Loaded cached profile offline.');
            setUser(JSON.parse(cachedProfile));
            return;
          }
        } catch (e) {
          // ignore cache read error
        }

        console.log('[AuthProvider] No cached profile found. Asking to login again.');
        Alert.alert(
          'Offline Mode',
          'No cached profile found. Please connect to the internet to load your profile.',
          [{ text: 'OK' }]
        );
        setUser(null);
      } else {
        // Genuine non-network failure (e.g., unauthorized)
        setUser(null);
      }

      setError(error as Error);
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

  const signInWithGoogle = async () => {
    try {
      const redirectUrl = Linking.createURL('/auth/callback');
      console.log('[AuthContext] Google Sign In Redirect URL:', redirectUrl);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error('No url returned');

      console.log('[AuthContext] Opening WebBrowser with URL:', data.url);
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
      console.log('[AuthContext] WebBrowser result:', result);

      if (result.type === 'success' && result.url) {
        // Extract access_token and refresh_token from the URL (fragment or query)
        // Linking.parse might not handle the hash fragment fully as we expect if it's not a standard deep link structure.

        // Manual regex parsing is often safer for these redirect URLs
        const AccessTokenMatch = result.url.match(/access_token=([^&]+)/);
        const RefreshTokenMatch = result.url.match(/refresh_token=([^&]+)/);

        const access_token = AccessTokenMatch ? AccessTokenMatch[1] : null;
        const refresh_token = RefreshTokenMatch ? RefreshTokenMatch[1] : null;

        if (access_token && refresh_token) {
          console.log('[AuthContext] Setting session manually from tokens.');
          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (error) throw error;
        } else {
          // Sometimes Supabase returns an error in the query params
          const errorMatch = result.url.match(/error=([^&]+)/);
          const errorDescriptionMatch = result.url.match(/error_description=([^&]+)/);
          if (errorMatch) {
            const errorCode = errorMatch[1];
            const errorDesc = errorDescriptionMatch ? decodeURIComponent(errorDescriptionMatch[1].replace(/\+/g, ' ')) : errorCode;
            throw new Error(errorDesc);
          }
        }
      }

      return { error: null };
    } catch (error) {
      console.error('Google Sign In Error:', error);
      return { error: error as Error };
    }
  };

  const resetPassword = async (email: string) => {
    try {
      // Create a deep link to the specific update password page
      // Note: Supabase will append access_token to this URL fragment
      const redirectUrl = Linking.createURL('/auth/update-password');
      console.log('[AuthContext] Reset Password Redirect URL:', redirectUrl);

      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });
      return { data, error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    try {
      // Race execution to prevent hanging if network is unstable
      await Promise.race([
        supabase.auth.signOut(),
        new Promise(resolve => setTimeout(resolve, 2000))
      ]);
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setUser(null);
      setSession(null);
      try {
        await AsyncStorage.removeItem('supabase.auth.token');
        await AsyncStorage.removeItem('cached_user_profile');
      } catch (e) {
        // Ignore async storage error
      }
    }
  };

  console.log('[AuthProvider] Rendering provider', { session: session?.user?.id, user: user?.id, loading, error });

  const loginRequired = !loading && (!session || !user);

  return (
    <AuthContext.Provider value={{
      session,
      user,
      signUp,
      signIn,
      signInWithGoogle,
      signOut,
      resetPassword,
      loading,
      error,
      loginRequired,
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

