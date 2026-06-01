import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

export default function AuthCallback() {
    const { session } = useAuth();
    const router = useRouter();

    const [status, setStatus] = React.useState('Verifying authentication...');
    const [debugInfo, setDebugInfo] = React.useState('');
    const [isRecovery, setIsRecovery] = React.useState(false);

    useEffect(() => {
        // If session exists, navigate to main app, UNLESS we are in recovery flow
        if (session && !isRecovery) {
            router.replace('/exam-selection');
            return;
        }

        // Helper to extract tokens from URL
        const handleUrl = async (url: string | null) => {
            if (!url) {
                setDebugInfo('No URL received');
                return;
            }
            setDebugInfo(`Received URL: ${url.substring(0, 50)}...`); // Truncate for privacy/space

            // Check for tokens involved in implicit grant (hash fragment)
            if (url.includes('access_token') || url.includes('refresh_token')) {
                setStatus('Tokens found, logging in...');
                const AccessTokenMatch = url.match(/access_token=([^&]+)/);
                const RefreshTokenMatch = url.match(/refresh_token=([^&]+)/);
                const TypeMatch = url.match(/type=([^&]+)/);

                const access_token = AccessTokenMatch ? AccessTokenMatch[1] : null;
                const refresh_token = RefreshTokenMatch ? RefreshTokenMatch[1] : null;
                const type = TypeMatch ? TypeMatch[1] : null;

                if (type === 'recovery') {
                    setIsRecovery(true);
                }

                if (access_token && refresh_token) {
                    try {
                        console.log('[AuthCallback] Found tokens in URL, setting session manually.');
                        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
                        if (error) {
                            setDebugInfo(`Session Error: ${error.message}`);
                        } else {
                            if (type === 'recovery') {
                                setStatus('Recovery successful! Redirecting to reset password...');
                                router.replace('/auth/update-password');
                            } else {
                                setStatus('Session set! Redirecting...');
                            }
                        }
                    } catch (e: any) {
                        console.error('[AuthCallback] Manual session set error:', e);
                        setDebugInfo(`Exception: ${e.message}`);
                    }
                } else {
                    setDebugInfo('Tokens missing in URL parse');
                }
            } else {
                setDebugInfo('No tokens in URL');
            }
        };

        // Check initial URL (if app opened from cold state via deep link)
        Linking.getInitialURL().then((url) => {
            console.log('Initial URL:', url);
            if (url) handleUrl(url);
            else setDebugInfo('Initial URL is null');
        });

        // Listen for new URLs (if app was already running)
        const sub = Linking.addEventListener('url', (e) => {
            console.log('Event URL:', e.url);
            handleUrl(e.url);
        });

        // Fallback timeout
        const timeout = setTimeout(() => {
            if (!session) {
                console.log('[AuthCallback] Session check timeout, redirecting to login.');
                // router.replace('/auth'); // Comment out redirect for debugging
                setStatus('Timeout: Auth failed. Check debug info.');
            }
        }, 10000);

        return () => {
            sub.remove();
            clearTimeout(timeout);
        };
    }, [session]);

    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A', padding: 20 }}>
            <ActivityIndicator size="large" color="#8A2BE2" />
            <Text style={{ marginTop: 20, color: '#F8FAFC', fontSize: 16 }}>{status}</Text>
            <Text style={{ marginTop: 20, color: '#94A3B8', fontSize: 12, textAlign: 'center' }}>{debugInfo}</Text>
            <Text style={{ marginTop: 10, color: '#64748B', fontSize: 10, textAlign: 'center' }}>
                If stuck, verify Supabase Redirect URL matches: the-cyber-cruciora://auth/callback
            </Text>
        </View>
    );
}
