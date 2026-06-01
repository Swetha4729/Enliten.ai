import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeColors {
    background: string;
    card: string;
    text: string;
    subText: string;
    border: string;
    primary: string;
    secondary: string;
    tint: string;
    success: string;
    error: string;
    warning: string;
    inputBg: string;
    overlay: string;
    gradientStart: string;
    gradientEnd: string;
    // Semantic surface tokens — very light, accent-safe
    primaryMuted: string;   // subtle background behind primary icons
    primarySoft: string;    // near-invisible tint for surfaces
}

// ─── DESIGN PHILOSOPHY ──────────────────────────────────────────────────────
// Primary:   #8A2BE2  (BlueViolet) — used ONLY for interactive accents,
//            active states, and key CTAs. NOT for backgrounds.
// Secondary: #6D28D9  (Deep Purple) — used sparingly for gradients/CTAs.
// Gold:      #F59E0B  — kept as a warm accent for premium/subscription UI, 
//            streak indicators, and warnings. A complementary secondary accent.
// Backgrounds: CLEAN neutrals with only the faintest hue tint.
// Gradients: Invisible — so subtle the eye barely registers them.

// ── LIGHT MODE ──────────────────────────────────────────────────────────────
// Backgrounds feel crisp and clean (near-white), not purple-washed.
// Text is deep charcoal, not purple.
// Borders are light grey. Purple appears only in active/interactive elements.
const lightColors: ThemeColors = {
    background: '#F9F9FB',   // Near-white, barely-there cool tint
    card: '#FFFFFF',
    inputBg: '#F3F4F6',   // Neutral light grey input field

    text: '#111118',   // Deep charcoal — professional, neutral
    subText: '#6B7280',   // Mid-grey — standard, not purple

    border: '#E5E7EB',   // Neutral light grey border

    primary: '#8A2BE2',   // BlueViolet — accent only
    secondary: '#6D28D9',   // Deep purple companion
    tint: '#8A2BE2',

    success: '#10B981',
    error: '#EF4444',
    warning: '#F59E0B',   // Gold — premium, streak, warning

    overlay: 'rgba(0, 0, 0, 0.45)',

    // Gradient: barely perceptible — white top fading to faintest cool grey
    gradientStart: '#FFFFFF',
    gradientEnd: '#F4F4F8',   // Almost white, just a whisper of cool tone

    primaryMuted: 'rgba(138, 43, 226, 0.08)',  // Very light for icon bubbles
    primarySoft: 'rgba(138, 43, 226, 0.04)',  // Near-invisible surface tint
};

// ── DARK MODE ───────────────────────────────────────────────────────────────
// True dark with a very subtle blue-black undertone — not purple.
// Cards/surfaces are dark charcoals. Purple is bright on dark only for accents.
const darkColors: ThemeColors = {
    background: '#0B0B0F',   // True near-black with barely-there cool base
    card: '#17171D',   // Dark charcoal card — NOT purple
    inputBg: '#1F1F27',   // Slightly lighter charcoal for inputs

    text: '#F0F0F5',   // Off-white — softer than pure #FFFFFF
    subText: '#9CA3AF',   // Mid-grey — neutral, readable

    border: '#2A2A35',   // Dark neutral border — subtle separation

    primary: '#A855F7',   // Lighter, brighter purple for dark backgrounds
    secondary: '#7C3AED',   // Violet companion
    tint: '#A855F7',

    success: '#10B981',
    error: '#EF4444',
    warning: '#F59E0B',   // Gold stays warm — used for pro/streak UI

    overlay: 'rgba(0, 0, 0, 0.72)',

    // Gradient: seamless dark — same near-black family, just slightly varied
    gradientStart: '#17171D',
    gradientEnd: '#0B0B0F',

    primaryMuted: 'rgba(168, 85, 247, 0.10)',  // Dark-appropriate subtle tint
    primarySoft: 'rgba(168, 85, 247, 0.05)',
};

interface ThemeContextType {
    themeMode: ThemeMode;
    setThemeMode: (mode: ThemeMode) => void;
    toggleTheme: () => void;
    colors: ThemeColors;
    isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
    themeMode: 'system',
    setThemeMode: () => { },
    toggleTheme: () => { },
    colors: lightColors,
    isDark: false,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const systemColorScheme = useColorScheme();
    const [themeMode, setThemeMode] = useState<ThemeMode>('system');

    useEffect(() => {
        loadTheme();
    }, []);

    const loadTheme = async () => {
        try {
            const storedTheme = await AsyncStorage.getItem('themeMode');
            if (storedTheme) {
                setThemeMode(storedTheme as ThemeMode);
            }
        } catch (e) {
            console.log('Failed to load theme', e);
        }
    };

    const saveTheme = async (mode: ThemeMode) => {
        try {
            await AsyncStorage.setItem('themeMode', mode);
            setThemeMode(mode);
        } catch (e) {
            console.log('Failed to save theme', e);
        }
    };

    const isDark = themeMode === 'dark' || (themeMode === 'system' && systemColorScheme === 'dark');
    const colors = isDark ? darkColors : lightColors;

    const toggleTheme = () => {
        const nextMode = isDark ? 'light' : 'dark';
        saveTheme(nextMode);
    };

    return (
        <ThemeContext.Provider value={{ themeMode, setThemeMode: saveTheme, toggleTheme, colors, isDark }}>
            {children}
        </ThemeContext.Provider>
    );
};


export const useTheme = () => useContext(ThemeContext);
