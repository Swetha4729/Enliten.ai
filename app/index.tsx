import Icon1 from '@/assets/images/icon.png';
import { useAuth } from '@/contexts/AuthContext';
import { useExam } from '@/contexts/ExamContext';
import { useTheme } from '@/contexts/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, router } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Responsive utility functions
const { width, height } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;
const hs = (size: number) => (width / guidelineBaseWidth) * size;
const vs = (size: number) => (height / guidelineBaseHeight) * size;
const ms = (size: number, factor = 0.5) => size + (hs(size) - size) * factor;

export default function Index() {
  const { session, loading, error } = useAuth();
  const { exam } = useExam();
  const { colors } = useTheme();
  const [timeoutError, setTimeoutError] = React.useState<string | null>(null);

  useEffect(() => {
    // If loading for more than 10s, show error
    const timeout = setTimeout(() => {
      setTimeoutError('App is taking too long to load. Please check your internet connection or try reinstalling.');
      console.error('[Index] Loading timeout: stuck on splash screen.');
    }, 10000);
    return () => clearTimeout(timeout);
  }, []);

  if (!loading) {
    if (session) {
      if (!exam) {
        console.log('[Index] Authenticated, no exam, navigating to /exam-selection');
        return <Redirect href="/exam-selection" />;
      } else {
        console.log('[Index] Authenticated, exam selected, navigating to /(tabs)');
        return <Redirect href="/(tabs)" />;
      }
    } else {
      console.log('[Index] Not authenticated, navigating to /auth');
      return <Redirect href="/auth" />;
    }
  }

  if (error || timeoutError) {
    return (
      <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.container}>
        <View style={styles.logoContainer}>
          <Image source={Icon1} style={styles.logo} resizeMode="contain" />
          <Text style={[styles.title, { color: colors.text }]}>Enliten AI</Text>
        </View>
        <View style={styles.statusContainer}>
          <Text style={{ color: colors.error, fontSize: 16, textAlign: 'center', marginTop: 16, paddingHorizontal: 20, marginBottom: 20 }}>
            {timeoutError || error?.message || 'Unknown error occurred.'}
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
            onPress={async () => {
              try {
                // Try to forcefully clear the auth state to unblock the user
                const { supabase } = await import('@/lib/supabase');
                await supabase.auth.signOut();
                router.replace('/auth');
              } catch (e) {
                console.error('Force signout failed', e);
              }
            }}
          >
            <Text style={{ color: '#0F172A', fontWeight: 'bold' }}>Reset App & Go to Login</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.container}>
      <View style={styles.logoContainer}>
        <Image source={Icon1} style={styles.logo} resizeMode="contain" />
        <Text style={[styles.title, { color: colors.text }]}>Enliten AI</Text>
      </View>
      <View style={styles.statusContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: vs(40),
  },
  logo: {
    width: hs(120),
    height: hs(120),
    borderRadius: ms(24),
    marginBottom: vs(24),
  },
  title: {
    fontSize: ms(24),
    fontWeight: '800',
    textAlign: 'center',
  },
  statusContainer: {
    position: 'absolute',
    bottom: vs(50),
    alignItems: 'center',
    width: '100%',
  },
});