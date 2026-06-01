import { LinearGradient } from 'expo-linear-gradient';
import { CircleHelp as HelpCircle } from 'lucide-react-native';
import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function HelpScreen() {
  return (
    <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.title}>Help & FAQ</Text>
            <Text style={styles.subtitle}>Find answers to common questions</Text>
          </View>

          <View style={styles.section}>
            <View style={styles.helpCard}>
              <View style={styles.helpIcon}>
                <HelpCircle size={24} color="#F8FAFC" strokeWidth={2} />
              </View>
              <View style={styles.helpText}>
                <Text style={styles.helpQuestion}>How do I reset my password?</Text>
                <Text style={styles.helpAnswer}>Go to the login screen and tap on "Forgot Password" to receive a reset link via email.</Text>
              </View>
            </View>
            <View style={styles.helpCard}>
              <View style={styles.helpIcon}>
                <HelpCircle size={24} color="#F8FAFC" strokeWidth={2} />
              </View>
              <View style={styles.helpText}>
                <Text style={styles.helpQuestion}>How do I contact support?</Text>
                <Text style={styles.helpAnswer}>You can contact support from the Settings screen or email us at support@thecybercruciora.com.</Text>
              </View>
            </View>
            <View style={styles.helpCard}>
              <View style={styles.helpIcon}>
                <HelpCircle size={24} color="#F8FAFC" strokeWidth={2} />
              </View>
              <View style={styles.helpText}>
                <Text style={styles.helpQuestion}>How do I upgrade to Premium?</Text>
                <Text style={styles.helpAnswer}>Go to Settings and tap on "Upgrade to Premium" to unlock all features.</Text>
              </View>
            </View>
            {/* Add more FAQ items as needed */}
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 30,
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    marginTop: 20,
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#CBD5E1',
  },
  section: {
    marginBottom: 30,
  },
  helpCard: {
    backgroundColor: '#334155',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#475569',
    marginBottom: 16,
  },
  helpIcon: {
    marginRight: 16,
    marginTop: 2,
  },
  helpText: {
    flex: 1,
  },
  helpQuestion: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  helpAnswer: {
    fontSize: 14,
    color: '#94A3B8',
  },
});
