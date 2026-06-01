// Adaptive Learning Rank Names
// Each rank covers 5 levels (1-5, 6-10, 11-15, ... 46-50)
export const ADAPTIVE_RANKS = [
    "Script Kiddie",      // Level 1-5
    "Novice",             // Level 6-10
    "Scout",              // Level 11-15
    "Code Breaker",       // Level 16-20
    "Infiltrator",        // Level 21-25
    "Operator",           // Level 26-30
    "Phantom",            // Level 31-35
    "Architect",          // Level 36-40
    "Elite",              // Level 41-45
    "Mastermind"          // Level 46-50
] as const;

export const MAX_USER_LEVEL = 50;

/**
 * Get rank name for a given level (1-50)
 * Each of the 10 ranks covers 5 levels
 */
export const getRankForLevel = (level: number): string => {
    // Clamp level to valid range
    const clampedLevel = Math.max(1, Math.min(MAX_USER_LEVEL, level));
    // Calculate rank index: (level - 1) / 5, clamped to 0-9
    const rankIndex = Math.min(9, Math.floor((clampedLevel - 1) / 5));
    return ADAPTIVE_RANKS[rankIndex];
};

/**
 * Get progress within current rank (0-100%)
 * Shows how far through the current 5-level block the user is
 */
export const getRankProgress = (level: number): number => {
    const clampedLevel = Math.max(1, Math.min(MAX_USER_LEVEL, level));
    // Position within current rank block (0-4)
    const positionInRank = (clampedLevel - 1) % 5;
    // Convert to percentage (0, 20, 40, 60, 80 for positions 0-4)
    return (positionInRank / 5) * 100;
};

/**
 * Get overall progress percentage
 * Level 1 = 0%, Level 50 = 100%
 */
export const getOverallProgress = (level: number): number => {
    const clampedLevel = Math.max(1, Math.min(MAX_USER_LEVEL, level));
    // (level - 1) / 49 so that Level 1 = 0% and Level 50 = 100%
    return ((clampedLevel - 1) / (MAX_USER_LEVEL - 1)) * 100;
};

/**
 * Check if user is at max level
 */
export const isMaxLevel = (level: number): boolean => {
    return level >= MAX_USER_LEVEL;
};
