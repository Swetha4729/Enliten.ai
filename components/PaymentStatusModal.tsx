import { useTheme } from '@/contexts/ThemeContext';
import { BlurView } from 'expo-blur';
import { AlertCircle, Check, Loader2, X } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { Dimensions, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withSpring,
    withTiming
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');

export type PaymentStatus =
    | 'idle'
    | 'loading'
    | 'success'
    | 'error'
    | 'restore_success'
    | 'restore_error'
    | 'restore_empty';

interface PaymentStatusModalProps {
    status: PaymentStatus;
    onClose: () => void;
    message?: string;
    isVisible: boolean;
}

const AnimatedIcon = Animated.createAnimatedComponent(View);

export default function PaymentStatusModal({ status, onClose, message, isVisible }: PaymentStatusModalProps) {
    const { colors, isDark } = useTheme();

    const scale = useSharedValue(0);
    const rotation = useSharedValue(0);
    const opacity = useSharedValue(0);

    useEffect(() => {
        if (isVisible) {
            if (status === 'loading') {
                opacity.value = withTiming(1, { duration: 200 });
                scale.value = withSpring(1);
                rotation.value = withRepeat(withTiming(360, { duration: 1000, easing: Easing.linear }), -1);
            } else if (status !== 'idle') {
                opacity.value = withTiming(1, { duration: 200 });
                scale.value = withSequence(
                    withTiming(0, { duration: 0 }),
                    withSpring(1, { damping: 12, stiffness: 100 })
                );
                rotation.value = 0; // Stop rotation
            }
        } else {
            opacity.value = withTiming(0, { duration: 200 });
            scale.value = withTiming(0, { duration: 200 });
        }
    }, [status, isVisible]);

    const animatedIconStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }, { rotate: `${rotation.value}deg` }],
        opacity: opacity.value
    }));

    const containerStyle = useAnimatedStyle(() => ({
        opacity: opacity.value
    }));

    if (!isVisible && status === 'idle') return null;

    const getStatusConfig = () => {
        switch (status) {
            case 'loading':
                return {
                    icon: <Loader2 size={48} color={colors.primary} />,
                    title: 'Processing...',
                    subtitle: 'Please wait while we secure your upgrade.',
                    color: colors.primary,
                    showConfetti: false
                };
            case 'success':
                return {
                    icon: <Check size={48} color="#ffff" strokeWidth={3} />,
                    title: 'Purchase Successful!',
                    subtitle: 'Welcome to Premium. You now have full access.',
                    color: '#10B981', // Success Green
                    showConfetti: true
                };
            case 'error':
                return {
                    icon: <X size={48} color="#ffff" strokeWidth={3} />,
                    title: 'Purchase Failed',
                    subtitle: message || 'Something went wrong. Please try again.',
                    color: '#EF4444', // Error Red
                    showConfetti: false
                };
            case 'restore_success':
                return {
                    icon: <Check size={48} color="#ffff" strokeWidth={3} />,
                    title: 'Purchases Restored',
                    subtitle: 'Welcome back! Your premium benefits are active.',
                    color: '#10B981',
                    showConfetti: true
                };
            case 'restore_empty':
                return {
                    icon: <AlertCircle size={48} color="#ffff" strokeWidth={3} />,
                    title: 'No Subscription Found',
                    subtitle: 'We couldn\'t find any active subscriptions to restore.',
                    color: '#8A2BE2', // Warning Amber
                    showConfetti: false
                };
            case 'restore_error':
                return {
                    icon: <X size={48} color="#ffff" strokeWidth={3} />,
                    title: 'Restore Failed',
                    subtitle: message || 'We could not restore your purchase at this time.',
                    color: '#EF4444',
                    showConfetti: false
                };
            default:
                return {
                    icon: null,
                    title: '',
                    subtitle: '',
                    color: 'transparent',
                    showConfetti: false
                };
        }
    };

    const config = getStatusConfig();
    const isTerminal = status !== 'loading' && status !== 'idle';

    return (
        <Modal visible={isVisible} transparent animationType="fade">
            <BlurView intensity={isDark ? 80 : 95} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill}>
                <View style={styles.centeredView}>
                    <Animated.View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }, containerStyle]}>

                        <View style={[styles.iconContainer, { backgroundColor: config.color }]}>
                            <AnimatedIcon style={animatedIconStyle}>
                                {config.icon}
                            </AnimatedIcon>
                        </View>

                        <Text style={[styles.title, { color: colors.text }]}>{config.title}</Text>
                        <Text style={[styles.subtitle, { color: colors.subText }]}>{config.subtitle}</Text>

                        {isTerminal && (
                            <TouchableOpacity
                                style={[styles.button, { backgroundColor: config.color }]}
                                onPress={onClose}
                            >
                                <Text style={[styles.buttonText, { color: '#fff' }]}>Continue</Text>
                            </TouchableOpacity>
                        )}

                        {config.showConfetti && (
                            <ConfettiCannon
                                count={200}
                                origin={{ x: width / 2 - 40, y: -100 }}
                                fadeOut={true}
                                fallSpeed={3000}
                                autoStart={true}
                            />
                        )}
                    </Animated.View>
                </View>
            </BlurView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    modalCard: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 24,
        padding: 32,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 10,
        },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 10,
        borderWidth: 1,
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.2,
        shadowRadius: 5,
        elevation: 6,
    },
    title: {
        fontSize: 22,
        fontWeight: '800',
        marginBottom: 12,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 15,
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 22,
    },
    button: {
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 12,
        minWidth: 140,
        alignItems: 'center',
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '700',
    }
});
