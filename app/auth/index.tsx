import Icon1 from '@/assets/images/icon.png';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { AntDesign } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowLeft, ArrowRight, Eye, EyeOff } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// Responsive utility functions
const { width, height } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;
const hs = (size: number) => (width / guidelineBaseWidth) * size;
const vs = (size: number) => (height / guidelineBaseHeight) * size;
const ms = (size: number, factor = 0.5) => size + (hs(size) - size) * factor;

const onboardingSlides = [
  {
    title: 'Ace Your TNPSC Exams',
    subtitle: 'Your personalized AI learning companion',
    description: 'Get 24/7 support from our intelligent chatbot. Clear your doubts instantly, receive personalized study plans, and stay on track for Group 1, 2, 2A, 3 and 4 exams.',
  },
  {
    title: 'Track Your Progress',
    subtitle: 'Study smarter, not harder',
    description: 'Monitor your learning journey with detailed analytics, streak tracking, and personalized study recommendations.',
  },
  {
    title: 'Show Up Confident',
    subtitle: 'Be exam ready',
    description: 'Build confidence with realistic practice tests, timed quizzes, and expert explanations for every question.',
  },
];



function getPasswordCriteria(password: string) {
  return {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
}

function getPasswordStrength(criteria: ReturnType<typeof getPasswordCriteria>) {
  const met = Object.values(criteria).filter(Boolean).length;
  if (met <= 2) return 'Weak';
  if (met === 3 || met === 4) return 'Medium';
  return 'Strong';
}

export default function AuthScreen() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showAuth, setShowAuth] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const height = useHeaderHeight()
  const insets = useSafeAreaInsets();


  const { signUp, signIn, signInWithGoogle, resetPassword } = useAuth(); // Add resetPassword
  const [isForgotPassword, setIsForgotPassword] = useState(false); // Add state

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }
    setLoading(true);
    try {
      const { error } = await resetPassword(email);
      if (error) {
        Alert.alert('Error', error.message);
      } else {
        Alert.alert('Success', 'Password reset instructions have been sent to your email.');
        setIsForgotPassword(false);
      }
    } catch (err) {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async () => {
    if (!email || !password || (isSignUp && !fullName)) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (isSignUp) {
      const criteria = getPasswordCriteria(password);
      const unmet: string[] = [];
      if (!criteria.length) unmet.push('At least 8 characters');
      if (!criteria.upper) unmet.push('An uppercase letter');
      if (!criteria.lower) unmet.push('A lowercase letter');
      if (!criteria.number) unmet.push('A number');
      if (!criteria.special) unmet.push('A special character');
      if (unmet.length > 0) {
        Alert.alert(
          'Password requirements not met',
          'Please include:\n' + unmet.map(c => `• ${c}`).join('\n')
        );
        return;
      }
    }

    setLoading(true);
    try {
      if (isSignUp) {
        // Pre-check if user exists using RPC to bypass RLS/Enumeration Protection
        const { data: userExists, error: rpcError } = await supabase.rpc('user_exists', { email_check: email });

        if (rpcError) {
          console.error('Error checking user existence:', rpcError);
          // Fallback to normal flow if RPC fails
        }

        if (userExists) {
          Alert.alert(
            'Account already exists',
            'An account with this email already exists. Would you like to sign in instead?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Sign In',
                onPress: () => {
                  setIsSignUp(false);
                  setPassword('');
                }
              }
            ]
          );
          setLoading(false);
          return;
        }

        const { error } = await signUp(email, password, fullName);
        if (error) {
          // Supabase error: email already registered
          if (
            error.message?.toLowerCase().includes('user already registered') ||
            error.message?.toLowerCase().includes('email') && error.message?.toLowerCase().includes('exists') ||
            error.message?.toLowerCase().includes('already in use')
          ) {
            Alert.alert(
              'Account already exists',
              'An account with this email already exists. Would you like to sign in instead?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Sign In',
                  onPress: () => {
                    setIsSignUp(false);
                    setPassword('');
                  }
                }
              ]
            );
          } else {
            Alert.alert('Signup Error', error.message);
          }
          return;
        }
        // Success: prompt user to verify email
        Alert.alert(
          'Verify your email',
          'A verification link has been sent to your email address. Please check your inbox and verify your account before signing in.'
        );
        // Optionally, you may want to clear the form or switch to sign-in mode here
        setIsSignUp(false);
        setPassword('');
        setFullName('');
        // Do NOT navigate to the app yet
        return;
      }

      // Sign in flow
      const { error } = await signIn(email, password);
      if (error) {
        Alert.alert('Sign In Error', error.message);
      } else {
        router.replace('/exam-selection');
        // router.replace('/update');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        Alert.alert('Google Sign In Error', error.message);
      } else {
        // Success is usually handled by the redirect flow / AuthContext session update, 
        // but if we are here and session is valid, we might redirect.
        // However, pure native implementation usually awaits the browser result.
        // If successful, AuthContext listener will pick up session change (if implemented correctly) 
        // OR we should check session manually.
        // For now, let's assume AuthContext updates.
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to initiate Google Sign In');
    } finally {
      setLoading(false);
    }
  };

  const nextSlide = () => {
    if (currentSlide < onboardingSlides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      setShowAuth(true);
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };


  if (!showAuth) {
    const slide = onboardingSlides[currentSlide];

    return (
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={[styles.container, { paddingTop: insets.top }]}
      >
        <View style={[styles.safeArea, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.onboardingContainer}>
            <View style={styles.logoTopContainer}>
              <View style={styles.logoWrapper}>
                <Image
                  source={Icon1}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.logoText}>Enliten AI</Text>
            </View>

            <View style={styles.slideContent}>
              <Text style={styles.slideTitle}>{slide.title}</Text>
              <Text style={styles.slideSubtitle}>{slide.subtitle}</Text>
              <Text style={styles.slideDescription}>{slide.description}</Text>
            </View>

            <View style={styles.navigationContainer}>
              <View style={styles.dotsContainer}>
                {onboardingSlides.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.dot,
                      {
                        backgroundColor: index === currentSlide ? colors.primary : colors.border,
                        width: index === currentSlide ? hs(24) : hs(8)
                      }
                    ]}
                  />
                ))}
              </View>

              <View style={styles.buttonRow}>
                {currentSlide > 0 ? (
                  <TouchableOpacity style={styles.navButtonIcon} onPress={prevSlide}>
                    <ArrowLeft size={24} color={colors.text} />
                  </TouchableOpacity>
                ) : <View style={{ width: 48 }} />}

                <TouchableOpacity style={styles.nextButton} onPress={nextSlide}>
                  <Text style={styles.nextButtonText}>
                    {currentSlide === onboardingSlides.length - 1 ? 'Get Started' : 'Next'}
                  </Text>
                  <ArrowRight size={20} color="white" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      style={[styles.container, { paddingTop: insets.top }]}
    >
      <View style={[styles.safeArea, { paddingBottom: insets.bottom + 20 }]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        // keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView
            contentContainerStyle={styles.authScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.authHeaderContainer}>
              <TouchableOpacity style={styles.headerBackButton} onPress={() => setShowAuth(false)}>
                <ArrowLeft size={24} color={colors.text} />
              </TouchableOpacity>
              <View style={styles.authLogoWrapper}>
                <Image
                  source={Icon1}
                  style={styles.authLogoImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.logoText}>Enliten AI</Text>
            </View>

            <View style={styles.formContainer}>
              <Text style={styles.authTitle}>
                {isForgotPassword ? 'Reset Password' : (isSignUp ? 'Create Account' : 'Welcome Back')}
              </Text>
              <Text style={styles.authSubtitle}>
                {isForgotPassword
                  ? 'Enter your email to receive reset instructions'
                  : (isSignUp
                    ? 'Start your certification journey today'
                    : 'Sign in to continue your studies')
                }
              </Text>

              {/* Forgot Password View */}
              {isForgotPassword ? (
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Email</Text>
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="name@example.com"
                    placeholderTextColor={colors.subText}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />

                  <TouchableOpacity
                    style={[styles.authButton, loading && styles.authButtonDisabled]}
                    onPress={handleResetPassword}
                    disabled={loading}
                  >
                    <Text style={styles.authButtonText}>
                      {loading ? 'Sending...' : 'Send Reset Link'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.switchButton}
                    onPress={() => setIsForgotPassword(false)}
                  >
                    <Text style={styles.switchButtonText}>Back to Sign In</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  {isSignUp && (
                    <View style={styles.inputContainer}>
                      <Text style={styles.inputLabel}>Full Name</Text>
                      <TextInput
                        style={styles.input}
                        value={fullName}
                        onChangeText={setFullName}
                        placeholder="Enter your full name"
                        placeholderTextColor={colors.subText}
                        autoCapitalize="words"
                      />
                    </View>
                  )}

                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Email</Text>
                    <TextInput
                      style={styles.input}
                      value={email}
                      onChangeText={setEmail}
                      placeholder="name@example.com"
                      placeholderTextColor={colors.subText}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Password</Text>
                    <View style={styles.passwordInputWrapper}>
                      <TextInput
                        style={[styles.input, { paddingRight: 50 }]}
                        value={password}
                        onChangeText={setPassword}
                        placeholder="Enter your password"
                        placeholderTextColor={colors.subText}
                        secureTextEntry={!showPassword}
                      />
                      <TouchableOpacity
                        onPress={() => setShowPassword((prev) => !prev)}
                        style={styles.eyeIcon}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        {showPassword ? (
                          <EyeOff size={20} color={colors.subText} />
                        ) : (
                          <Eye size={20} color={colors.subText} />
                        )}
                      </TouchableOpacity>
                    </View>
                    {/* Password criteria and strength for signup */}
                    {isSignUp && password.length > 0 && (
                      <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center' }}>
                        {(() => {
                          const criteria = getPasswordCriteria(password);
                          const strength = getPasswordStrength(criteria);
                          let barColor = colors.error;
                          let widthPercent = '33%';
                          if (strength === 'Medium') {
                            barColor = '#8A2BE2';
                            widthPercent = '66%';
                          }
                          if (strength === 'Strong') {
                            barColor = '#10B981';
                            widthPercent = '100%';
                          }
                          return (
                            <>
                              <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden', marginRight: 10 }}>
                                <View style={{ width: widthPercent as any, height: '100%', backgroundColor: barColor, borderRadius: 3 }} />
                              </View>
                              <Text style={{ fontWeight: 'bold', fontSize: 12, color: barColor, minWidth: 50, textAlign: 'right' }}>{strength}</Text>
                            </>
                          );
                        })()}
                      </View>
                    )}
                  </View>

                  {!isSignUp && (
                    <TouchableOpacity
                      style={{ alignSelf: 'flex-end', marginBottom: 20 }}
                      onPress={() => setIsForgotPassword(true)}
                    >
                      <Text style={{ color: colors.primary, fontWeight: '600' }}>Forgot Password?</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.authButton, loading && styles.authButtonDisabled]}
                    onPress={handleAuth}
                    disabled={loading}
                  >
                    <Text style={styles.authButtonText}>
                      {loading ? 'Please wait...' : (isSignUp ? 'Create Account' : 'Sign In')}
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.dividerContainer}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>Or continue with</Text>
                    <View style={styles.dividerLine} />
                  </View>

                  <TouchableOpacity
                    style={[styles.googleButton, loading && styles.authButtonDisabled]}
                    onPress={handleGoogleSignIn}
                    disabled={loading}
                  >
                    <AntDesign name="google" size={20} color={colors.text} />
                    <Text style={styles.googleButtonText}>Sign in with Google</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.switchButton}
                    onPress={() => setIsSignUp(!isSignUp)}
                  >
                    <Text style={styles.switchButtonText}>
                      {isSignUp
                        ? 'Already have an account? Sign In'
                        : "Don't have an account? Sign Up"
                      }
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              <View style={styles.policyContainer}>
                <TouchableOpacity onPress={() => Linking.openURL('https://thecybercruciora.com/terms')}>
                  <Text style={styles.policyText}>Terms</Text>
                </TouchableOpacity>
                <Text style={styles.policyDivider}>•</Text>
                <TouchableOpacity onPress={() => Linking.openURL('https://thecybercruciora.com/privacy-policy')}>
                  <Text style={styles.policyText}>Privacy</Text>
                </TouchableOpacity>
                <Text style={styles.policyDivider}>•</Text>
                <TouchableOpacity onPress={() => Linking.openURL('https://thecybercruciora.com/refund-policy')}>
                  <Text style={styles.policyText}>Refund</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </LinearGradient>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  onboardingContainer: {
    flex: 1,
    paddingHorizontal: hs(24),
    justifyContent: 'space-between',
    paddingVertical: vs(40),
  },
  logoTopContainer: {
    alignItems: 'center',
    marginTop: vs(40),
  },
  logoWrapper: {
    width: hs(100),
    height: hs(100),
    borderRadius: ms(20),
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: vs(12),
    // backgroundColor: 'rgba(255,255,255,0.1)', // Optional subtle bg
  },
  logoImage: {
    width: '200%',
    height: '200%',
  },
  logoText: {
    fontSize: ms(22),
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  slideContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slideTitle: {
    fontSize: ms(28),
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginBottom: vs(12),
    lineHeight: ms(36),
  },
  slideSubtitle: {
    fontSize: ms(16),
    fontWeight: '600',
    color: colors.primary,
    textAlign: 'center',
    marginBottom: vs(16),
  },
  slideDescription: {
    fontSize: ms(15),
    color: colors.subText,
    textAlign: 'center',
    lineHeight: ms(24),
    maxWidth: '90%',
  },
  navigationContainer: {
    alignItems: 'center',
    marginBottom: vs(20),
  },
  dotsContainer: {
    flexDirection: 'row',
    marginBottom: vs(32),
    gap: hs(8),
  },
  dot: {
    height: hs(8),
    borderRadius: ms(4),
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  navButtonIcon: {
    padding: 12,
    borderRadius: 50,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  nextButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: hs(24),
    paddingVertical: vs(14),
    borderRadius: ms(30),
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
  },
  nextButtonText: {
    color: 'white',
    fontSize: ms(16),
    fontWeight: '600',
  },
  // Auth Form Styles
  authScrollContent: {
    flexGrow: 1,
    paddingHorizontal: hs(24),
    paddingBottom: vs(20),
  },
  authHeaderContainer: {
    alignItems: 'center',
    marginTop: vs(70),
    marginBottom: vs(20),
    position: 'relative',
  },
  headerBackButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    padding: 8,
    zIndex: 10,
  },
  authLogoWrapper: {
    width: hs(70),
    height: hs(70),
    borderRadius: ms(18),
    overflow: 'hidden',
    marginBottom: vs(12),
  },
  authLogoImage: {
    width: '100%',
    height: '100%',
  },
  formContainer: {
    width: '100%',
  },
  authTitle: {
    fontSize: ms(26),
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginBottom: vs(8),
  },
  authSubtitle: {
    fontSize: ms(15),
    color: colors.subText,
    textAlign: 'center',
    marginBottom: vs(32),
  },
  inputContainer: {
    marginBottom: vs(16),
  },
  inputLabel: {
    fontSize: ms(14),
    fontWeight: '600',
    color: colors.text,
    marginBottom: vs(6),
  },
  input: {
    backgroundColor: colors.inputBg, // ensure this is light enough in light mode 
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: ms(12),
    paddingHorizontal: hs(16),
    paddingVertical: vs(12), // slightly reduced for compact feel
    fontSize: ms(16),
    color: colors.text,
  },
  passwordInputWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  eyeIcon: {
    position: 'absolute',
    right: 12,
    height: '100%',
    justifyContent: 'center',
  },
  authButton: {
    backgroundColor: colors.primary,
    paddingVertical: vs(16),
    borderRadius: ms(12),
    marginTop: vs(12),
    marginBottom: vs(8),
    alignItems: 'center',
  },
  authButtonDisabled: {
    opacity: 0.7,
  },
  authButtonText: {
    color: 'white',
    fontSize: ms(16),
    fontWeight: '700',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: vs(24),
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    color: colors.subText,
    paddingHorizontal: hs(12),
    fontSize: ms(13),
  },
  googleButton: {
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: vs(14),
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: vs(16),
    gap: hs(12),
  },
  googleButtonText: {
    color: colors.text,
    fontSize: ms(15),
    fontWeight: '600',
  },
  switchButton: {
    alignItems: 'center',
    paddingVertical: vs(12),
  },
  switchButtonText: {
    color: colors.primary, // Make this primary for better visibility/CTA
    fontSize: ms(14),
    fontWeight: '500',
  },
  policyContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: vs(24),
    gap: hs(12),
  },
  policyText: {
    color: colors.subText,
    fontSize: ms(12),
  },
  policyDivider: {
    color: colors.subText,
    fontSize: ms(12),
  },
});
