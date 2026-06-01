import NetInfo from '@react-native-community/netinfo';
import { Wifi, WifiOff } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSequence,
    withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function NetworkBanner() {
    const insets = useSafeAreaInsets();
    const [isConnected, setIsConnected] = useState<boolean | null>(true);
    const translateY = useSharedValue(-200);

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            const connected = state.isConnected && state.isInternetReachable !== false;
            setIsConnected(prev => {
                if (prev === null) return connected; // Initial boot

                if (prev !== connected) {
                    if (connected) {
                        // Back online!
                        translateY.value = withSequence(
                            withTiming(0, { duration: 400, easing: Easing.out(Easing.exp) }),
                            withDelay(2500, withTiming(-200, { duration: 400, easing: Easing.in(Easing.exp) }))
                        );
                    } else {
                        // Offline
                        translateY.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.exp) });
                    }
                }
                return connected;
            });
        });

        return () => {
            unsubscribe();
        };
    }, []);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateY: translateY.value }],
        };
    });

    if (isConnected === null) return null;

    return (
        <Animated.View style={[styles.container, { paddingTop: insets.top }, animatedStyle, { backgroundColor: isConnected ? '#10B981' : '#333333' }]}>
            <View style={styles.content}>
                {isConnected ? (
                    <Wifi size={16} color="white" strokeWidth={2.5} style={{ marginRight: 8 }} />
                ) : (
                    <WifiOff size={16} color="white" strokeWidth={2.5} style={{ marginRight: 8 }} />
                )}
                <Text style={styles.text}>
                    {isConnected ? 'Back online' : 'No connection. Minimal offline mode active.'}
                </Text>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        paddingBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
        paddingTop: 8,
    },
    text: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
    },
});
