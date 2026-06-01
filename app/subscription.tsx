import PaymentStatusModal, { PaymentStatus } from '@/components/PaymentStatusModal';
import { useAuth } from '@/contexts/AuthContext';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { useTheme } from '@/contexts/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowLeft, Check, Crown } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  // Alert, // Commented out as requested
  Dimensions,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { PACKAGE_TYPE } from 'react-native-purchases';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Responsive utility functions
const { width, height } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;
const hs = (size: number) => (width / guidelineBaseWidth) * size;
const vs = (size: number) => (height / guidelineBaseHeight) * size;
const ms = (size: number, factor = 0.5) => size + (hs(size) - size) * factor;

const SUBSCRIPTION_FEATURES = [
  'Full Access to All 6 Quiz Modes',
  'Unlock "Weakest Domain" & "Missed Questions" Quizzes',
  'Get full access to all questions & practice tests',
  'Detailed Explanations for All Questions',
  'Advanced Performance Analytics',
];
// 'Unlock "Level Up" Progressive Mode',
// 'Priority Support',
// 'Ad-Free Experience',

// Fallback data structure if needed, or to define UI metadata
const PLAN_METADATA: Record<string, { name: string; period: string; savings: string | null; popular: boolean; detail?: string }> = {
  monthly: {
    name: 'Monthly',
    period: 'per month',
    savings: null,
    popular: false,
  },
  quarterly: {
    name: 'Quarterly',
    period: 'every 3 months',
    savings: 'Save 25%',
    popular: false,
  },
  half_yearly: {
    name: 'Half Yearly',
    period: 'every 6 months',
    savings: 'Save 35%',
    popular: true,
  },
  yearly: {
    name: 'Yearly',
    period: 'per year',
    savings: 'Save 45%',
    popular: false,
  },
  lifetime: {
    name: 'Lifetime',
    period: 'one-time',
    savings: 'Best Value',
    popular: false,
  },
};

export default function SubscriptionScreen() {
  const { user } = useAuth();
  const { currentOffering, purchasePackage, isPro, restorePurchases } = useRevenueCat();
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const [selectedPlanId, setSelectedPlanId] = useState<string>('half_yearly');
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [modalState, setModalState] = useState<{ status: PaymentStatus; message?: string; isVisible: boolean }>({
    status: 'idle',
    isVisible: false
  });

  // If we have packages, verify selection is valid, else default to first
  useEffect(() => {
    if (currentOffering?.availablePackages.length) {
      const hasSelected = currentOffering.availablePackages.some(p => p.identifier === selectedPlanId);
      if (!hasSelected) {
        // Default to a popular one or the first one
        const popular = currentOffering.availablePackages.find(p => p.identifier === 'half_yearly' || p.identifier === 'yearly');
        setSelectedPlanId(popular?.identifier || currentOffering.availablePackages[0].identifier);
      }
    }
  }, [currentOffering]);

  const handleSubscribe = async () => {
    if (!currentOffering) {
      // Alert.alert('Error', 'No offerings available. Please try again later.');
      setModalState({ status: 'error', message: 'No offerings available. Please try again later.', isVisible: true });
      return;
    }

    const packageToBuy = currentOffering.availablePackages.find(p => p.identifier === selectedPlanId);
    if (!packageToBuy) {
      // Alert.alert('Error', 'Selected plan not available.');
      setModalState({ status: 'error', message: 'Selected plan not available.', isVisible: true });
      return;
    }

    try {
      setIsPurchasing(true);
      setModalState({ status: 'loading', isVisible: true });

      await purchasePackage(packageToBuy);

      setModalState({ status: 'success', isVisible: true });
      // Navigation will be handled by the modal close or a timeout if prefered, 
      // but user likely wants to see the success animation.
    } catch (e: any) {
      if (!e.userCancelled) {
        // Alert.alert('Purchase Error', e.message);
        setModalState({ status: 'error', message: e.message, isVisible: true });
      } else {
        // User cancelled, just close modal
        setModalState(prev => ({ ...prev, isVisible: false }));
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async () => {
    try {
      setIsPurchasing(true);
      setModalState({ status: 'loading', isVisible: true });

      const customerInfo = await restorePurchases();

      // Check if they actually have active entitlements
      // Note: customerInfo.entitlements.active is an object like { "pro": { ... } }
      const hasActive = Object.keys(customerInfo.entitlements.active).length > 0;

      if (hasActive) {
        // Alert.alert('Restored', 'Your purchases have been restored.');
        setModalState({ status: 'restore_success', isVisible: true });
      } else {
        setModalState({ status: 'restore_empty', isVisible: true });
      }
    } catch (e: any) {
      // Alert.alert('Error', 'Failed to restore purchases: ' + e.message);
      setModalState({ status: 'restore_error', message: e.message, isVisible: true });
    } finally {
      setIsPurchasing(false);
    }
  }

  const handleCloseModal = () => {
    setModalState(prev => ({ ...prev, isVisible: false }));
    // If success, navigate away after closing
    if (modalState.status === 'success' || modalState.status === 'restore_success') {
      router.replace('/(tabs)');
    }
  };

  // Effect to redirect when Pro is detected
  useEffect(() => {
    if (isPro && !modalState.isVisible) {
      // Optional: Auto redirect if they land here while already pro
      // But purely relying on this might flash screen if we are showing success modal.
      // So checking !modalState.isVisible prevents premature redirect while showing confetti.
      // router.replace('/(tabs)');
    }
  }, [isPro, modalState.isVisible]);

  // Define your dynamic titles here
  const PACKAGE_TITLES: Partial<Record<PACKAGE_TYPE, string>> = {
    [PACKAGE_TYPE.MONTHLY]: "Cyber Starter (Monthly)",
    [PACKAGE_TYPE.THREE_MONTH]: "Cyber Shield (Quarterly)",
    [PACKAGE_TYPE.SIX_MONTH]: "Cyber Sentinel (Semi-Annual)",
    [PACKAGE_TYPE.ANNUAL]: "Cyber Guardian (Annual)",
    [PACKAGE_TYPE.LIFETIME]: "Cyber Elite (Lifetime)",
  };



  const availablePlans = currentOffering?.availablePackages.map(pkg => {
    // 1. Determine the dynamic title based on packageType
    // Fallback to the store title if the type isn't in our mapping
    const dynamicName = PACKAGE_TITLES[pkg.packageType] || pkg.product.title;

    const meta = PLAN_METADATA[pkg.identifier] || {
      name: dynamicName, // Use our dynamic name
      period: pkg.packageType === 'MONTHLY' ? 'per month' : pkg.packageType === 'ANNUAL' ? 'per year' : pkg.packageType === 'THREE_MONTH' ? 'per three months' : pkg.packageType === 'SIX_MONTH' ? 'per six months' : pkg.packageType === 'LIFETIME' ? 'per lifetime' : 'per period',
      savings: null,
      popular: pkg.packageType === 'ANNUAL' // Example: make Annual popular by default
    };

    // 2. Calculate price per month details
    // Note: RevenueCat actually provides pricePerMonthString in your logs!
    const detail = pkg.packageType !== 'MONTHLY'
      ? `${pkg.product.pricePerMonthString} / mo`
      : undefined;

    return {
      id: pkg.identifier,
      rcPackage: pkg,
      price: pkg.product.priceString,
      ...meta,
      name: meta.name || dynamicName, // Ensure meta doesn't overwrite if it's empty
      detail: meta.detail || detail
    };
  }) || [];

  // Sort plans: Monthly -> Quarterly -> Half-Yearly -> Yearly -> Lifetime
  // Or just trust RC order, but here we enforce logic
  const sortOrder = ['monthly', 'quarterly', 'half_yearly', 'yearly', 'lifetime'];
  availablePlans.sort((a, b) => sortOrder.indexOf(a.id) - sortOrder.indexOf(b.id));


  return (
    <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={[styles.container, { paddingTop: insets.top }]}>
      <View style={[styles.safeArea, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={colors.text} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.title}>Upgrade to Premium</Text>
          {/* <TouchableOpacity onPress={handleRestore} style={{ marginLeft: 'auto' }}>
            <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>Restore</Text>
          </TouchableOpacity> */}
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Hero Section */}
          <View style={styles.heroSection}>
            <View style={styles.crownContainer}>
              <LinearGradient
                colors={["#F59E0B", '#D97706']}
                style={styles.crownGradient}
              >
                <Crown size={32} color="#FFF" strokeWidth={2.5} />
              </LinearGradient>
            </View>
            <Text style={styles.heroTitle}>Unlock Your Full Potential</Text>
            <Text style={styles.heroSubtitle}>
              Get unlimited access to all features and accelerate your certification journey
            </Text>
          </View>

          {/* Features List */}
          <View style={styles.featuresContainer}>
            {SUBSCRIPTION_FEATURES.map((feature, index) => (
              <View key={index} style={styles.featureItem}>
                <View style={styles.checkIcon}>
                  <Check size={14} color="#FFF" strokeWidth={3} />
                </View>
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>

          {/* Subscription Plans */}
          <View style={styles.plansContainer}>
            {(!currentOffering && !availablePlans.length) ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 20 }} />
            ) : (
              availablePlans.map((plan) => {
                const isSelected = selectedPlanId === plan.id;
                return (
                  <TouchableOpacity
                    key={plan.id}
                    activeOpacity={0.9}
                    style={[
                      styles.planCard,
                      isSelected && styles.selectedPlan,
                    ]}
                    onPress={() => setSelectedPlanId(plan.id)}
                  >
                    {/* Selection Indicator */}
                    <View style={[styles.radioButton, isSelected && styles.radioButtonSelected]}>
                      {isSelected && <View style={styles.radioButtonInner} />}
                    </View>

                    <View style={{ flex: 1 }}>
                      <View style={styles.planHeaderRow}>
                        <Text style={[styles.planName, isSelected && styles.textHighlights]}>{plan.name}</Text>
                        {plan.popular && (
                          <View style={styles.popularBadge}>
                            <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.priceContainer}>
                        <Text style={styles.planPrice}>{plan.price}</Text>
                        <Text style={styles.planPeriod}>/ {plan.period.replace('per ', '').replace('every ', '')}</Text>
                      </View>

                      {plan.detail && (
                        <Text style={styles.planDetail}>{plan.detail}</Text>
                      )}

                      {plan.savings && (
                        <View style={styles.savingsContainer}>
                          <Text style={styles.savingsText}>{plan.savings}</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          {/* Subscribe Button */}
          <TouchableOpacity
            style={[styles.subscribeButton, isPurchasing && { opacity: 0.7 }]}
            onPress={handleSubscribe}
            disabled={isPurchasing}
          >
            {isPurchasing && modalState.status === 'loading' ? (
              // Optional: show spinner here too, or just blank. 
              // Since modal covers screen, we might not see this.
              <ActivityIndicator color="#0F172A" />
            ) : (
              <Text style={styles.subscribeButtonText}>
                Subscribe Now
              </Text>
            )}
          </TouchableOpacity>

          <Text style={styles.termsText}>
            By subscribing, you agree to our{' '}
            <Text style={styles.linkText} onPress={() => Linking.openURL('https://thecybercruciora.com/terms')}>Terms</Text>
            ,{' '}
            <Text style={styles.linkText} onPress={() => Linking.openURL('https://thecybercruciora.com/privacy-policy')}>Privacy Policy</Text>
            {' '}and{' '}
            <Text style={styles.linkText} onPress={() => Linking.openURL('https://thecybercruciora.com/refund-policy')}>Refund Policy</Text>
          </Text>
        </ScrollView>

        <PaymentStatusModal
          isVisible={modalState.isVisible}
          status={modalState.status}
          message={modalState.message}
          onClose={handleCloseModal}
        />
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
    // paddingTop: 30, // Removed hardcoded padding
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  scrollView: {
    flex: 1,
  },
  heroSection: {
    alignItems: 'center',
    padding: 32,
  },
  crownContainer: {
    width: 80,
    height: 80,
    backgroundColor: 'transparent',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 16,
    color: colors.subText,
    textAlign: 'center',
    lineHeight: 24,
  },
  featuresContainer: {
    padding: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureText: {
    fontSize: 16,
    color: colors.text,
  },
  popularPlanBorder: {
    borderColor: colors.primary,  // Purple border for popular plan
  },
  crownGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  checkIcon: {
    width: 22,
    height: 22,
    backgroundColor: '#10B981', // Keeping success color for checks
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  plansContainer: {
    padding: 20,
    gap: 12,
  },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: colors.border,
  },
  selectedPlan: {
    borderColor: colors.primary,
    backgroundColor: colors.card,
    transform: [{ scale: 1.02 }],
  },
  textHighlights: {
    color: colors.primary,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.subText,
    marginRight: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    borderColor: colors.primary,
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  planHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  popularBadge: {
    backgroundColor: "#F59E0B",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  popularBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  planName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 2,
  },
  planPrice: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  planPeriod: {
    fontSize: 13,
    color: colors.subText,
    marginLeft: 4,
  },
  planDetail: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
    marginBottom: 4,
  },
  savingsContainer: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  savingsText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '700',
  },
  subscribeButton: {
    backgroundColor: colors.primary,
    margin: 20,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  subscribeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF', // White text on primary button
    letterSpacing: 0.5,
  },
  termsText: {
    fontSize: 12,
    color: colors.subText,
    textAlign: 'center',
    marginBottom: 40,
    paddingHorizontal: 40,
    lineHeight: 18,
  },
  linkText: {
    color: colors.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});