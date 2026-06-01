import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { useURL } from 'expo-linking';
import { router } from 'expo-router';
import { ArrowLeft, Eye, EyeOff, Lock } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Dimensions,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;
const hs = (size: number) => (width / guidelineBaseWidth) * size;
const vs = (size: number) => (height / guidelineBaseHeight) * size;
const ms = (size: number, factor = 0.5) => size + (hs(size) - size) * factor;

export default function UpdatePasswordScreen() {
    const { colors } = useTheme();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const insets = useSafeAreaInsets();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [isRecoveringSession, setIsRecoveringSession] = useState(false);
    const url = useURL();

    useEffect(() => {
        const handleSessionRecovery = async () => {
            if (!url) return;
            // Check if we already have a session? 
            // Better to just try parsing the URL if it looks like a recovery link
            if (url.includes('access_token') && url.includes('type=recovery')) {
                console.log('[UpdatePassword] Detected recovery URL:', url);
                setIsRecoveringSession(true);
                try {
                    const getParam = (paramName: string) => {
                        const regex = new RegExp(`[#?&]${paramName}=([^&]+)`);
                        const match = url.match(regex);
                        return match ? decodeURIComponent(match[1]) : null;
                    };

                    const accessToken = getParam('access_token');
                    const refreshToken = getParam('refresh_token');

                    if (accessToken && refreshToken) {
                        const { error } = await supabase.auth.setSession({
                            access_token: accessToken,
                            refresh_token: refreshToken,
                        });
                        if (error) throw error;
                        console.log('[UpdatePassword] Session recovered successfully');
                    }
                } catch (err) {
                    console.error('[UpdatePassword] Failed to recover session:', err);
                    Alert.alert('Error', 'Invalid or expired password reset link.');
                } finally {
                    setIsRecoveringSession(false);
                }
            }
        };

        handleSessionRecovery();
    }, [url]);
    const handleUpdatePassword = async () => {
        if (!password || !confirmPassword) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert('Error', 'Passwords do not match');
            return;
        }

        if (password.length < 6) {
            Alert.alert('Error', 'Password should be at least 6 characters');
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({
                password: password
            });

            if (error) {
                throw error;
            }

            Alert.alert('Success', 'Your password has been updated.', [
                {
                    text: 'OK',
                    onPress: () => router.replace('/exam-selection')
                }
            ]);
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to update password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <LinearGradient
            colors={[colors.gradientStart, colors.gradientEnd]}
            style={[styles.container, { paddingTop: insets.top }]}
        >
            <View style={[styles.safeArea, { paddingBottom: insets.bottom + 20 }]}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                >
                    <ScrollView contentContainerStyle={styles.content}>
                        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                            <ArrowLeft size={24} color={colors.text} />
                        </TouchableOpacity>

                        <View style={styles.header}>
                            <View style={styles.iconContainer}>
                                <Lock size={40} color={colors.primary} />
                            </View>
                            <Text style={styles.title}>New Password</Text>
                            <Text style={styles.subtitle}>Enter your new password below to update your account.</Text>
                        </View>

                        <View style={styles.form}>
                            <View style={styles.inputContainer}>
                                <Text style={styles.inputLabel}>New Password</Text>
                                <View style={styles.passwordContainer}>
                                    <TextInput
                                        style={[styles.input, { paddingRight: 50 }]}
                                        value={password}
                                        onChangeText={setPassword}
                                        placeholder="Enter new password"
                                        placeholderTextColor={colors.subText}
                                        secureTextEntry={!showPassword}
                                    />
                                    <TouchableOpacity
                                        onPress={() => setShowPassword(!showPassword)}
                                        style={styles.eyeIcon}
                                    >
                                        {showPassword ? (
                                            <EyeOff size={20} color={colors.subText} />
                                        ) : (
                                            <Eye size={20} color={colors.subText} />
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={styles.inputContainer}>
                                <Text style={styles.inputLabel}>Confirm Password</Text>
                                <TextInput
                                    style={styles.input}
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    placeholder="Confirm new password"
                                    placeholderTextColor={colors.subText}
                                    secureTextEntry={!showPassword}
                                />
                            </View>

                            <TouchableOpacity
                                style={[styles.button, loading && styles.buttonDisabled]}
                                onPress={handleUpdatePassword}
                                disabled={loading}
                            >
                                <Text style={styles.buttonText}>
                                    {isRecoveringSession ? 'Verifying Link...' : (loading ? 'Updating...' : 'Update Password')}
                                </Text>
                            </TouchableOpacity>
                        </View>
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
    content: {
        padding: hs(24),
    },
    backButton: {
        marginBottom: vs(30),
        marginTop: vs(10),
    },
    header: {
        marginBottom: vs(40),
    },
    iconContainer: {
        alignItems: 'center',
        marginBottom: vs(16),
    },
    title: {
        fontSize: ms(28),
        fontWeight: '800',
        color: colors.text,
        marginBottom: vs(12),
    },
    subtitle: {
        fontSize: ms(16),
        color: colors.subText,
        lineHeight: ms(24),
    },
    form: {
        gap: vs(20),
    },
    inputContainer: {
        gap: vs(8),
    },
    inputLabel: {
        fontSize: ms(14),
        fontWeight: '600',
        color: colors.text,
    },
    passwordContainer: {
        position: 'relative',
        justifyContent: 'center',
    },
    input: {
        backgroundColor: colors.inputBg,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: ms(12),
        paddingHorizontal: hs(16),
        paddingVertical: vs(14),
        fontSize: ms(16),
        color: colors.text,
    },
    eyeIcon: {
        position: 'absolute',
        right: 12,
        height: '100%',
        justifyContent: 'center',
    },
    button: {
        backgroundColor: colors.primary,
        paddingVertical: vs(16),
        borderRadius: ms(12),
        alignItems: 'center',
        marginTop: vs(20),
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonText: {
        color: '#0F172A',
        fontSize: ms(16),
        fontWeight: '700',
    },
});
