import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/services/api';

export default function CustomerProfileScreen() {
  const { user, logout } = useAuth();
  const [deliveryInfo, setDeliveryInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await api.getCustomerDeliveryInfo();
      setDeliveryInfo(data);
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
        </View>
      </SafeAreaView>
    );
  }

  const profile = deliveryInfo?.profile || {};
  const schedule = deliveryInfo?.schedule || {};
  const nextDelivery = deliveryInfo?.next_delivery;

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

        {/* Distributor Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Distributor</Text>
          <View style={styles.infoRow}>
            <Ionicons name="business-outline" size={20} color="#64748B" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Company</Text>
              <Text style={styles.infoValue}>{deliveryInfo?.company_name || 'Not assigned'}</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="map-outline" size={20} color="#64748B" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Delivery Route</Text>
              <Text style={styles.infoValue}>{profile.route_name || deliveryInfo?.route_name || 'Not assigned'}</Text>
            </View>
          </View>
        </View>

        {/* Delivery Schedule */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Schedule</Text>
          {schedule.delivery_days && schedule.delivery_days.length > 0 ? (
            <>
              <View style={styles.deliveryDaysRow}>
                {schedule.delivery_days.map((day: string) => (
                  <View key={day} style={styles.dayTag}>
                    <Text style={styles.dayTagText}>{day}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.cutoffText}>
                Order cutoff: {schedule.cut_off_time || '16:00'}
              </Text>
              {nextDelivery && (
                <View style={[styles.nextDeliveryCard, nextDelivery.is_open ? styles.deliveryOpen : styles.deliveryClosed]}>
                  <Ionicons
                    name={nextDelivery.is_open ? 'checkmark-circle' : 'close-circle'}
                    size={24}
                    color={nextDelivery.is_open ? '#10B981' : '#EF4444'}
                  />
                  <View style={{ marginLeft: 12 }}>
                    <Text style={styles.nextDeliveryTitle}>
                      Next: {nextDelivery.delivery_day} ({nextDelivery.delivery_date})
                    </Text>
                    <Text style={styles.nextDeliverySub}>
                      {nextDelivery.is_open
                        ? `${Math.round(nextDelivery.hours_until_cutoff)}h until cutoff`
                        : 'Ordering closed'}
                    </Text>
                  </View>
                </View>
              )}
            </>
          ) : (
            <Text style={styles.noSchedule}>No delivery schedule set by your distributor</Text>
          )}
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
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
  deliveryDaysRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  dayTag: { backgroundColor: '#064E3B', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  dayTagText: { fontSize: 13, fontWeight: '600', color: '#10B981' },
  cutoffText: { fontSize: 14, color: '#94A3B8', marginBottom: 12 },
  nextDeliveryCard: {
    flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, marginTop: 4,
  },
  deliveryOpen: { backgroundColor: '#064E3B' },
  deliveryClosed: { backgroundColor: '#7F1D1D' },
  nextDeliveryTitle: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  nextDeliverySub: { fontSize: 13, color: '#94A3B8', marginTop: 2 },
  noSchedule: { fontSize: 14, color: '#64748B', fontStyle: 'italic' },
  logoutButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1E293B', borderRadius: 14, padding: 16, marginTop: 8, gap: 8,
    borderWidth: 1, borderColor: '#EF4444',
  },
  logoutText: { fontSize: 16, fontWeight: '600', color: '#EF4444' },
  version: { textAlign: 'center', color: '#475569', fontSize: 12, marginTop: 20 },
});
