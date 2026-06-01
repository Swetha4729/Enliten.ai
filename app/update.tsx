
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { AlertCircle, Download, Rocket } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;
const hs = (size: number) => (width / guidelineBaseWidth) * size;
const vs = (size: number) => (height / guidelineBaseHeight) * size;
const ms = (size: number, factor = 0.5) => size + (hs(size) - size) * factor;

export default function UpdateScreen() {
  const { colors, isDark } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [latest, setLatest] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';

  useEffect(() => {
    const fetchLatest = async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('app_versions')
        .select('*')
        .eq('platform', platform)
        .order('version_code', { ascending: false })
        .limit(1)
        .single();
      if (error) setError(error.message);
      else setLatest(data || null);
      setLoading(false);
    };
    fetchLatest();
  }, [platform]);

  return (
    <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.contentContainer}>
        {/* Header / Graphic */}
        <View style={styles.graphicContainer}>
          <View style={styles.iconCircle}>
            <Rocket size={48} color={colors.primary} />
          </View>
          {/* <Image source={require('@/assets/images/update.png')} style={styles.logo} contentFit="contain" /> */}
        </View>

        <View style={styles.card}>
          {loading ? (
            <View style={styles.centerContent}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={styles.loadingText}>Checking for updates...</Text>
            </View>
          ) : error ? (
            <View style={styles.centerContent}>
              <AlertCircle size={48} color={colors.error} />
              <Text style={styles.errorText}>Failed to check for updates</Text>
              <Text style={styles.errorSubText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={() => {/* logic to retry */ }}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : latest ? (
            <>
              <View style={styles.headerSection}>
                <Text style={styles.title}>Update Available</Text>
                <View style={styles.versionBadge}>
                  <Text style={styles.versionText}>v{latest.version_name}</Text>
                </View>
              </View>

              <Text style={styles.description}>
                {latest.force_update
                  ? "This is a critical update containing important security fixes and performance improvements. You must update to continue using the app."
                  : "A new version of Enliten AI is available! Update now to access new features and improvements."}
              </Text>

              <View style={styles.notesContainer}>
                <Text style={styles.notesHeader}>What's New:</Text>
                <ScrollView style={styles.notesScroll} showsVerticalScrollIndicator={true}>
                  <Text style={styles.notesText}>
                    {latest.release_notes || '• General bug fixes and performance improvements.'}
                  </Text>
                </ScrollView>
              </View>

              <View style={styles.actionSection}>
                {latest.download_url && (
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={() => Linking.openURL(latest.download_url)}
                  >
                    <Download size={20} color="#FFFFFF" strokeWidth={2.5} style={{ marginRight: 8 }} />
                    <Text style={styles.primaryButtonText}>Update Now</Text>
                  </TouchableOpacity>
                )}

                {!latest.force_update && (
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => {
                      if (router.canGoBack()) {
                        router.back();
                      } else {
                        router.replace('/(tabs)');
                      }
                    }}
                  >
                    <Text style={styles.secondaryButtonText}>Not Now</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          ) : (
            <View style={styles.centerContent}>
              <Text style={styles.noUpdateText}>Your app is up to date!</Text>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => {
                  if (router.canGoBack()) {
                    router.back();
                  } else {
                    router.replace('/(tabs)');
                  }
                }}
              >
                <Text style={styles.secondaryButtonText}>Continue to App</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </LinearGradient>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
  },
  graphicContainer: {
    marginBottom: vs(30),
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logo: {
    width: 200,
    height: 200,
  },
  card: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
    borderWidth: 1,
    borderColor: colors.border,
  },
  centerContent: {
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    color: colors.subText,
    fontSize: 16,
  },
  errorText: {
    marginTop: 16,
    color: colors.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  errorSubText: {
    marginTop: 8,
    color: colors.error,
    textAlign: 'center',
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  versionBadge: {
    backgroundColor: colors.inputBg,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  versionText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  description: {
    color: colors.subText,
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
  },
  notesContainer: {
    backgroundColor: colors.inputBg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    maxHeight: 200,
  },
  notesHeader: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notesScroll: {
    maxHeight: 150,
  },
  notesText: {
    color: colors.subText,
    fontSize: 14,
    lineHeight: 22,
  },
  actionSection: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF', // Always white on primary
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: colors.subText,
    fontSize: 16,
    fontWeight: '600',
  },
  retryButton: {
    marginTop: 16,
    padding: 10,
  },
  retryButtonText: {
    color: colors.primary,
    fontWeight: 'bold',
  },
  noUpdateText: {
    fontSize: 18,
    color: colors.text,
    fontWeight: '600',
    marginBottom: 20,
  },
});