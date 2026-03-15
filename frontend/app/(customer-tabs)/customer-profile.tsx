import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';

export default function CustomerProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const profile = user?.customer_profile || {} as any;

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.pageTitle}>My Profile</Text>

        {/* Avatar & Name */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={40} color="#10B981" />
          </View>
          <Text style={styles.profileName}>{user?.name}</Text>
          <Text style={styles.profilePhone}>{user?.phone}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>Customer</Text>
          </View>
        </View>

        {/* Business Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Business Information</Text>
          <View style={styles.infoRow}>
            <Ionicons name="storefront-outline" size={20} color="#64748B" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Business Name</Text>
              <Text style={styles.infoValue}>{profile.business_name || 'Not set'}</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={20} color="#64748B" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Delivery Address</Text>
              <Text style={styles.infoValue}>{profile.delivery_address || 'Not set'}</Text>
            </View>
          </View>
        </View>

        {/* Location Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Location</Text>
          <View style={styles.infoRow}>
            <Ionicons name="navigate-outline" size={20} color="#64748B" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Province</Text>
              <Text style={styles.infoValue}>{profile.province || 'Not set'}</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="map-outline" size={20} color="#64748B" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>District</Text>
              <Text style={styles.infoValue}>{profile.district || 'Not set'}</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="home-outline" size={20} color="#64748B" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>City / Area</Text>
              <Text style={styles.infoValue}>{profile.city || 'Not set'}</Text>
            </View>
          </View>
        </View>

        {/* Marketplace Info */}
        <View style={styles.marketplaceBanner}>
          <Ionicons name="globe-outline" size={24} color="#3B82F6" />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.marketplaceTitle}>Marketplace</Text>
            <Text style={styles.marketplaceSub}>
              You can order from any supplier that delivers to your area. Browse suppliers in the Shop tab.
            </Text>
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color="#EF4444" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Mzansi FMCG Tracker v1.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  content: { padding: 20, paddingBottom: 40 },
  pageTitle: { fontSize: 24, fontWeight: '700', color: '#FFFFFF', marginBottom: 20 },
  profileCard: {
    backgroundColor: '#1E293B', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 20,
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#064E3B',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  profileName: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  profilePhone: { fontSize: 15, color: '#94A3B8', marginTop: 4 },
  roleBadge: {
    backgroundColor: '#10B981', paddingHorizontal: 14, paddingVertical: 4, borderRadius: 12, marginTop: 10,
  },
  roleBadgeText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  section: {
    backgroundColor: '#1E293B', borderRadius: 14, padding: 18, marginBottom: 16,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginBottom: 14 },
  infoRow: {
    flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14, gap: 12,
  },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 12, color: '#64748B', marginBottom: 2 },
  infoValue: { fontSize: 15, color: '#E2E8F0' },
  marketplaceBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E3A5F',
    borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#3B82F6',
  },
  marketplaceTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  marketplaceSub: { fontSize: 13, color: '#94A3B8', marginTop: 4 },
  logoutButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1E293B', borderRadius: 14, padding: 16, marginTop: 8, gap: 8,
    borderWidth: 1, borderColor: '#EF4444',
  },
  logoutText: { fontSize: 16, fontWeight: '600', color: '#EF4444' },
  version: { textAlign: 'center', color: '#475569', fontSize: 12, marginTop: 20 },
});
