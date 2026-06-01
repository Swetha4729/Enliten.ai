import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Crown, User } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, Alert, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function ProfileScreen() {
  const { user } = useAuth();
  const [fullName, setFullName] = React.useState(user?.full_name || '');
  const [email, setEmail] = React.useState(user?.email || '');
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    setFullName(user?.full_name || '');
    setEmail(user?.email || '');
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase
      .from('users')
      .update({ full_name: fullName, email })
      .eq('id', user.id);
    setLoading(false);
    if (error) {
      Alert.alert('Error', error.message || 'Failed to update profile');
    } else {
      Alert.alert('Success', 'Profile updated successfully!');
    }
  };

  return (
    <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.title}>Profile</Text>
            <Text style={styles.subtitle}>Manage your profile information</Text>
          </View>

          <View style={styles.profileCard}>
            <View style={styles.profileInfo}>
              <View style={styles.avatar}>
                {user?.avatar_url ? (
                  <ExpoImage
                    source={{ uri: user.avatar_url }}
                    style={{ width: '100%', height: '100%', borderRadius: 16 }}
                    contentFit="cover"
                    transition={1000}
                  />
                ) : (
                  <User size={24} color="#F8FAFC" strokeWidth={2} />
                )}
              </View>
              <View style={styles.profileText}>
                <Text style={styles.profileLabel}>Full Name</Text>
                <TextInput
                  style={styles.profileInput}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Full Name"
                  placeholderTextColor="#64748B"
                  editable={!loading}
                />
                <Text style={styles.profileLabel}>Email</Text>
                <TextInput
                  style={styles.profileInput}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email"
                  placeholderTextColor="#64748B"
                  editable={!loading}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <View style={styles.subscriptionBadge}>
                  <Crown size={14} color={user?.subscription_status === 'premium' ? '#8A2BE2' : '#64748B'} strokeWidth={2} />
                  <Text style={[
                    styles.subscriptionText,
                    { color: user?.subscription_status === 'premium' ? '#8A2BE2' : '#64748B' }
                  ]}>
                    {user?.subscription_status === 'premium' ? 'Premium' : 'Free'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
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
  profileLabel: {
    color: '#CBD5E1',
    fontSize: 14,
    marginTop: 8,
    marginBottom: 2,
    fontWeight: '600',
  },
  profileInput: {
    backgroundColor: '#1E293B',
    color: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#475569',
  },
  saveButton: {
    marginTop: 24,
    backgroundColor: '#8A2BE2',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 16,
  },
  profileCard: {
    backgroundColor: '#334155',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#475569',
  },
  profileInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    backgroundColor: '#1E40AF',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  profileText: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 8,
  },
  subscriptionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subscriptionText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
