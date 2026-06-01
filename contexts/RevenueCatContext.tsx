import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import Purchases, {
    CustomerInfo,
    LOG_LEVEL,
    PurchasesOffering,
    PurchasesPackage,
} from 'react-native-purchases';

// Use the provided test API key
const API_KEYS = {
    android: 'test_hOiHkWLVlcqaZIrnuvDecYCfFUJ',
    ios: 'appl_iEKbDWxFFLHSnVlplnJiGmyDSYd', // Using the same key for now as requested
};

// test_hOiHkWLVlcqaZIrnuvDecYCfFUJ
// goog_rQzMXrctdTWRTmrPAeDdTPULvOM
const ENTITLEMENT_ID = 'pro_access';

interface RevenueCatContextType {
    currentOffering: PurchasesOffering | null;
    customerInfo: CustomerInfo | null;
    isPro: boolean;
    purchasePackage: (pack: PurchasesPackage) => Promise<void>;
    restorePurchases: () => Promise<CustomerInfo>;
    loading: boolean;
}

const RevenueCatContext = createContext<RevenueCatContextType | undefined>(undefined);

export function RevenueCatProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [currentOffering, setCurrentOffering] = useState<PurchasesOffering | null>(null);
    const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
    const [isPro, setIsPro] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isIdentified, setIsIdentified] = useState(false);

    const [isConfigured, setIsConfigured] = useState(false);

    // Initialize RevenueCat
    useEffect(() => {
        const init = async () => {
            try {
                if (Platform.OS === 'android') {
                    await Purchases.configure({ apiKey: API_KEYS.android });
                } else {
                    await Purchases.configure({ apiKey: API_KEYS.ios });
                }

                // Mark as configured so other effects can run
                setIsConfigured(true);

                if (__DEV__) {
                    await Purchases.setLogLevel(LOG_LEVEL.DEBUG);
                }

                // If we have a user, don't fetch info as anonymous yet, wait for identify
                // logic handled in identifyAndSync
                if (!user?.id) {
                    const info = await Purchases.getCustomerInfo();
                    console.log('[RevenueCat] Initial Customer Info (Anon):', info);
                    setCustomerInfo(info);
                    await checkEntitlements(info);
                }

                const offerings = await Purchases.getOfferings();
                if (offerings.current) {
                    setCurrentOffering(offerings.current);
                }
            } catch (e) {
                console.error('[RevenueCat] Init Error:', e);
            } finally {
                // If no user, we are done loading. If user, waiting for identify.
                if (!user?.id) setLoading(false);
            }
        };
        init();
    }, []);

    // Identify User and Sync logic
    useEffect(() => {
        const identifyAndSync = async () => {
            if (!isConfigured) {
                console.log('[RevenueCat] Waiting for configuration before identifying...');
                return;
            }

            if (!user?.id) {
                setIsIdentified(false);
                return;
            }

            try {
                console.log('[RevenueCat] Identifying user:', user.id);
                // Log in the user to RevenueCat to ensure transactions are linked to this ID
                const { customerInfo: info } = await Purchases.logIn(user.id);
                console.log('[RevenueCat] Login Successful.', info.originalAppUserId);
                setCustomerInfo(info);
                setIsIdentified(true);

                // Check entitlements and sync with Supabase
                await checkEntitlementsAndSync(info, user.id);
            } catch (e) {
                console.error('[RevenueCat] Login/Sync Error:', e);
                // Even if login fails, try to fetch info and sync if possible? 
                // Probably better to retry or leave as error.
            } finally {
                setLoading(false);
            }
        };

        identifyAndSync();
    }, [user?.id, isConfigured]);

    // Listener for external updates (e.g. restores, subscriptions expiries)
    useEffect(() => {
        const listener = async (info: CustomerInfo) => {
            console.log('[RevenueCat] Customer Info Updated:', info);
            setCustomerInfo(info);
            // We pass user?.id here. If user is null, we just update local state.
            await checkEntitlementsAndSync(info, user?.id);
        };

        Purchases.addCustomerInfoUpdateListener(listener);

        // EXTRA SAFETY: Interval check every 30s to catch expirations instantly
        const interval = setInterval(() => {
            if (customerInfo) {
                // Determine expiration date
                const activeEntKeys = Object.keys(customerInfo.entitlements.active);
                const firstActiveEnt = activeEntKeys.length > 0 ? customerInfo.entitlements.active[activeEntKeys[0]] : null;
                const expirationDate = firstActiveEnt?.expirationDate || customerInfo.latestExpirationDate || null;

                if (expirationDate) {
                    const expTime = new Date(expirationDate).getTime();
                    const now = new Date().getTime();
                    // If expired just now
                    if (expTime < now && isPro) {
                        console.log('[RevenueCat] ⏰ Detected expiration via interval check. Syncing...');
                        checkEntitlementsAndSync(customerInfo, user?.id);
                    }
                }
            }
        }, 30000); // Check every 30s

        return () => {
            Purchases.removeCustomerInfoUpdateListener(listener);
            clearInterval(interval);
        };
    }, [user?.id, customerInfo, isPro]);

    const checkEntitlements = async (info: CustomerInfo) => {
        // Log all available entitlements for debugging
        console.log('[RevenueCat] All Active Entitlements:', Object.keys(info.entitlements.active));
        console.log('[RevenueCat] All Entitlements:', Object.keys(info.entitlements.all));
        console.log('[RevenueCat] Looking for ENTITLEMENT_ID:', ENTITLEMENT_ID);

        const isActive = typeof info.entitlements.active[ENTITLEMENT_ID] !== 'undefined';
        console.log(`[RevenueCat] Entitlement found?`, isActive);

        // Fallback: if specific entitlement not found, check if ANY entitlement is active
        const hasAnyActiveEntitlement = Object.keys(info.entitlements.active).length > 0;
        console.log('[RevenueCat] Has any active entitlement?', hasAnyActiveEntitlement);

        // Use the specific entitlement OR fallback to any active entitlement
        const shouldBePro = isActive || hasAnyActiveEntitlement;
        setIsPro(shouldBePro);
    }

    const checkEntitlementsAndSync = async (info: CustomerInfo, userId?: string) => {
        // Log all available entitlements for debugging
        console.log('[RevenueCat] === SYNC DEBUG ===');
        console.log('[RevenueCat] Customer ID:', info.originalAppUserId);
        console.log('[RevenueCat] All Active Entitlements:', JSON.stringify(info.entitlements.active, null, 2));
        console.log('[RevenueCat] Latest Expiration Date:', info.latestExpirationDate);
        console.log('[RevenueCat] Looking for ENTITLEMENT_ID:', ENTITLEMENT_ID);

        const isActive = typeof info.entitlements.active[ENTITLEMENT_ID] !== 'undefined';
        console.log(`[RevenueCat] Specific entitlement '${ENTITLEMENT_ID}' active?`, isActive);

        // Fallback: if specific entitlement not found, check if ANY entitlement is active
        const hasAnyActiveEntitlement = Object.keys(info.entitlements.active).length > 0;
        console.log('[RevenueCat] Has any active entitlement?', hasAnyActiveEntitlement);

        // Use the specific entitlement OR fallback to any active entitlement
        const shouldBePro = isActive || hasAnyActiveEntitlement;
        setIsPro(shouldBePro);

        if (userId) {
            // Get expiration date from any active entitlement or fall back to latest
            const activeEntKeys = Object.keys(info.entitlements.active);
            const firstActiveEnt = activeEntKeys.length > 0 ? info.entitlements.active[activeEntKeys[0]] : null;
            const expirationDate = firstActiveEnt?.expirationDate || info.latestExpirationDate || null;

            // STRICT CHECK: If expiration date is in the past, force status to free
            let finalStatus = shouldBePro ? 'premium' : 'free';
            if (expirationDate) {
                const expTime = new Date(expirationDate).getTime();
                const now = new Date().getTime();
                console.log(`[RevenueCat] Expiration Check - Exp: ${expTime}, Now: ${now}, Diff: ${expTime - now}`);

                if (expTime < now) {
                    console.log('[RevenueCat] ⚠️ Subscription EXPIRED based on date check. Revoking access.');
                    finalStatus = 'free';
                    setIsPro(false); // Immediate local revocation
                }
            }

            console.log(`[RevenueCat] Syncing status '${finalStatus}' (Expires: ${expirationDate}) to Supabase for user ${userId}`);

            let retries = 3;
            while (retries > 0) {
                try {
                    const updates: any = {
                        subscription_status: finalStatus,
                        updated_at: new Date().toISOString()
                    };

                    // Always update expiration if it exists, so Supabase knows when it ended
                    if (expirationDate) {
                        updates.subscription_expires_at = expirationDate;
                    }

                    const { error } = await supabase
                        .from('users')
                        .update(updates)
                        .eq('id', userId);

                    if (error) {
                        console.error(`[RevenueCat] Supabase Sync Error (Attempt ${4 - retries}):`, error);
                        throw error;
                    } else {
                        console.log('[RevenueCat] Supabase Sync Success');
                        return; // Success
                    }
                } catch (dbError) {
                    console.error('[RevenueCat] Sync Attempt Failed:', dbError);
                    retries--;
                    if (retries === 0) {
                        console.error('[RevenueCat] Supabase Sync Failed after retries.');
                    } else {
                        await new Promise(res => setTimeout(res, 1000)); // Wait 1s
                    }
                }
            }
        } else {
            console.log('[RevenueCat] No User ID provided for sync. Skipping Supabase update.');
        }
    };

    const purchasePackage = async (pack: PurchasesPackage) => {
        try {
            console.log('[RevenueCat] Purchasing package:', pack.identifier);
            const { customerInfo } = await Purchases.purchasePackage(pack);
            setCustomerInfo(customerInfo);
            await checkEntitlementsAndSync(customerInfo, user?.id);
        } catch (e: any) {
            if (!e.userCancelled) {
                console.error('[RevenueCat] Purchase Error:', e);
            } else {
                console.log('[RevenueCat] User cancelled purchase');
            }
            // Always throw so the UI knows it failed (cancelled or error)
            throw e;
        }
    };

    const restorePurchases = async () => {
        try {
            console.log('[RevenueCat] Restoring purchases...');
            const info = await Purchases.restorePurchases();
            setCustomerInfo(info);
            await checkEntitlementsAndSync(info, user?.id);
            return info;
        } catch (e) {
            console.error('[RevenueCat] Restore Error:', e);
            throw e;
        }
    };

    return (
        <RevenueCatContext.Provider
            value={{
                currentOffering,
                customerInfo,
                isPro,
                purchasePackage,
                restorePurchases,
                loading,
            }}
        >
            {children}
        </RevenueCatContext.Provider>
    );
}

export function useRevenueCat() {
    const context = useContext(RevenueCatContext);
    if (!context) {
        throw new Error('useRevenueCat must be used within a RevenueCatProvider');
    }
    return context;
}
