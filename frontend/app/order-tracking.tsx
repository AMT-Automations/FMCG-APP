import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { api } from '../src/services/api';

const STATUS_STEPS = [
  { key: 'pending', label: 'Order Placed', icon: 'receipt-outline' },
  { key: 'confirmed', label: 'Confirmed', icon: 'checkmark-circle-outline' },
  { key: 'packed', label: 'Packed', icon: 'cube-outline' },
  { key: 'out_for_delivery', label: 'Out for Delivery', icon: 'car-outline' },
  { key: 'delivered', label: 'Delivered', icon: 'checkmark-done-circle-outline' },
];

const STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B',
  confirmed: '#10B981',
  adjusted: '#3B82F6',
  packed: '#6366F1',
  out_for_delivery: '#F97316',
  delivered: '#059669',
  cancelled: '#EF4444',
};

export default function OrderTrackingScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [tracking, setTracking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTracking = useCallback(async () => {
    if (!orderId) return;
    try {
      const data = await api.getOrderTracking(orderId);
      setTracking(data);
    } catch (error: any) {
      console.error('Failed to load tracking:', error);
      const msg = Platform.OS === 'web' ? window.alert : Alert.alert;
      if (Platform.OS === 'web') {
        window.alert('Failed to load tracking information');
      } else {
        Alert.alert('Error', 'Failed to load tracking information');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadTracking();
    // Auto-refresh every 30 seconds when out_for_delivery
    const interval = setInterval(() => {
      if (tracking?.status === 'out_for_delivery') {
        loadTracking();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [loadTracking]);

  const onRefresh = () => {
    setRefreshing(true);
    loadTracking();
  };

  const getCurrentStepIndex = () => {
    if (!tracking) return -1;
    if (tracking.status === 'cancelled') return -1;
    if (tracking.status === 'adjusted') return 1; // Same as confirmed visually
    return STATUS_STEPS.findIndex(s => s.key === tracking.status);
  };

  const formatDateTime = (ts: string) => {
    if (!ts) return '';
    try {
      const d = new Date(ts);
      return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch { return ts; }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading tracking...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!tracking) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Order Tracking</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#64748B" />
          <Text style={styles.emptyText}>Tracking information not available</Text>
        </View>
      </SafeAreaView>
    );
  }

  const stepIndex = getCurrentStepIndex();
  const isCancelled = tracking.status === 'cancelled';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Tracking</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={22} color="#3B82F6" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />}
      >
        {/* Order Header */}
        <View style={styles.orderHeader}>
          <Text style={styles.orderNumber}>{tracking.order_number}</Text>
          <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[tracking.status] || '#64748B' }]}>
            <Text style={styles.statusText}>{tracking.status.replace(/_/g, ' ').toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.orderMeta}>
          <Text style={styles.metaText}>
            <Ionicons name="business-outline" size={14} color="#94A3B8" /> {tracking.company_name}
          </Text>
          {tracking.delivery_date && (
            <Text style={styles.metaText}>
              <Ionicons name="calendar-outline" size={14} color="#94A3B8" /> Delivery: {tracking.delivery_day}, {tracking.delivery_date}
            </Text>
          )}
          <Text style={styles.metaAmount}>R {(tracking.total_amount || 0).toFixed(2)}</Text>
        </View>

        {/* Status Timeline */}
        {!isCancelled ? (
          <View style={styles.timelineCard}>
            <Text style={styles.sectionTitle}>Delivery Progress</Text>
            {STATUS_STEPS.map((step, idx) => {
              const isComplete = idx <= stepIndex;
              const isCurrent = idx === stepIndex;
              return (
                <View key={step.key} style={styles.timelineStep}>
                  <View style={styles.timelineLeft}>
                    <View style={[
                      styles.timelineDot,
                      isComplete && styles.timelineDotComplete,
                      isCurrent && styles.timelineDotCurrent,
                    ]}>
                      <Ionicons
                        name={isComplete ? 'checkmark' : (step.icon as any)}
                        size={16}
                        color={isComplete ? '#fff' : '#64748B'}
                      />
                    </View>
                    {idx < STATUS_STEPS.length - 1 && (
                      <View style={[styles.timelineLine, isComplete && styles.timelineLineComplete]} />
                    )}
                  </View>
                  <View style={styles.timelineRight}>
                    <Text style={[styles.timelineLabel, isComplete && styles.timelineLabelComplete, isCurrent && styles.timelineLabelCurrent]}>
                      {step.label}
                    </Text>
                    {tracking.status_history?.find((h: any) => h.status === step.key) && (
                      <Text style={styles.timelineTime}>
                        {formatDateTime(tracking.status_history.find((h: any) => h.status === step.key)?.timestamp)}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={[styles.timelineCard, { borderColor: '#EF4444' }]}>
            <View style={styles.cancelledBanner}>
              <Ionicons name="close-circle" size={32} color="#EF4444" />
              <Text style={styles.cancelledText}>Order Cancelled</Text>
            </View>
          </View>
        )}

        {/* Delivery Progress Bar */}
        {tracking.delivery_progress && !isCancelled && (
          <View style={styles.progressCard}>
            <Text style={styles.sectionTitle}>Route Progress</Text>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>
                {tracking.delivery_progress.completed_stops} of {tracking.delivery_progress.total_stops} stops completed
              </Text>
              <Text style={styles.progressRemaining}>
                {tracking.delivery_progress.remaining_stops} remaining
              </Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, {
                width: tracking.delivery_progress.total_stops > 0
                  ? `${(tracking.delivery_progress.completed_stops / tracking.delivery_progress.total_stops) * 100}%`
                  : '0%'
              }]} />
            </View>
          </View>
        )}

        {/* Driver Info */}
        {tracking.driver_info && !isCancelled && (
          <View style={styles.driverCard}>
            <Text style={styles.sectionTitle}>Driver Information</Text>
            <View style={styles.driverRow}>
              <View style={styles.driverAvatar}>
                <Ionicons name="person" size={28} color="#3B82F6" />
              </View>
              <View style={styles.driverInfo}>
                <Text style={styles.driverName}>{tracking.driver_info.name}</Text>
                <Text style={styles.driverVehicle}>
                  {tracking.driver_info.vehicle} • {tracking.driver_info.registration}
                </Text>
                {tracking.location_updated_at && (
                  <Text style={styles.locationTime}>
                    <Ionicons name="location" size={12} color="#10B981" /> Location updated {formatDateTime(tracking.location_updated_at)}
                  </Text>
                )}
              </View>
            </View>
            {tracking.status === 'out_for_delivery' && (
              <View style={styles.liveBanner}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>Driver is on the way</Text>
              </View>
            )}
          </View>
        )}

        {/* Order Items */}
        <View style={styles.itemsCard}>
          <Text style={styles.sectionTitle}>Order Items</Text>
          {tracking.items?.map((item: any, idx: number) => (
            <View key={idx} style={styles.itemRow}>
              <Text style={styles.itemName}>{item.product_name}</Text>
              <Text style={styles.itemQty}>x{item.quantity}</Text>
              <Text style={styles.itemPrice}>R {(item.quantity * item.unit_price).toFixed(2)}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalAmount}>R {(tracking.total_amount || 0).toFixed(2)}</Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#94A3B8', marginTop: 12, fontSize: 14 },
  emptyText: { color: '#94A3B8', marginTop: 12, fontSize: 16 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#1E293B', borderBottomWidth: 1, borderBottomColor: '#334155' },
  backBtn: { padding: 8, marginRight: 8 },
  refreshBtn: { padding: 8, marginLeft: 'auto' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff', flex: 1 },
  content: { flex: 1, paddingHorizontal: 16 },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 4 },
  orderNumber: { fontSize: 20, fontWeight: '800', color: '#fff' },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  orderMeta: { marginBottom: 16 },
  metaText: { color: '#94A3B8', fontSize: 13, marginTop: 4 },
  metaAmount: { color: '#10B981', fontSize: 18, fontWeight: '700', marginTop: 8 },
  timelineCard: { backgroundColor: '#1E293B', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#334155' },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 16 },
  timelineStep: { flexDirection: 'row', minHeight: 56 },
  timelineLeft: { alignItems: 'center', width: 36 },
  timelineDot: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  timelineDotComplete: { backgroundColor: '#10B981' },
  timelineDotCurrent: { backgroundColor: '#3B82F6', borderWidth: 3, borderColor: '#60A5FA' },
  timelineLine: { width: 2, flex: 1, backgroundColor: '#334155', marginVertical: 2 },
  timelineLineComplete: { backgroundColor: '#10B981' },
  timelineRight: { flex: 1, paddingLeft: 12, paddingBottom: 16 },
  timelineLabel: { color: '#64748B', fontSize: 14, fontWeight: '600' },
  timelineLabelComplete: { color: '#CBD5E1' },
  timelineLabelCurrent: { color: '#fff', fontWeight: '700' },
  timelineTime: { color: '#64748B', fontSize: 12, marginTop: 2 },
  cancelledBanner: { alignItems: 'center', paddingVertical: 16 },
  cancelledText: { color: '#EF4444', fontSize: 18, fontWeight: '700', marginTop: 8 },
  progressCard: { backgroundColor: '#1E293B', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#334155' },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { color: '#CBD5E1', fontSize: 13 },
  progressRemaining: { color: '#F59E0B', fontSize: 13, fontWeight: '600' },
  progressBarBg: { height: 8, backgroundColor: '#334155', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#10B981', borderRadius: 4 },
  driverCard: { backgroundColor: '#1E293B', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#334155' },
  driverRow: { flexDirection: 'row', alignItems: 'center' },
  driverAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#1E3A5F', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  driverInfo: { flex: 1 },
  driverName: { color: '#fff', fontSize: 16, fontWeight: '700' },
  driverVehicle: { color: '#94A3B8', fontSize: 13, marginTop: 2 },
  locationTime: { color: '#10B981', fontSize: 12, marginTop: 4 },
  liveBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#064E3B', borderRadius: 8, padding: 10, marginTop: 12 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981', marginRight: 8 },
  liveText: { color: '#A7F3D0', fontSize: 13, fontWeight: '600' },
  itemsCard: { backgroundColor: '#1E293B', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#334155' },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#334155' },
  itemName: { flex: 1, color: '#CBD5E1', fontSize: 14 },
  itemQty: { color: '#94A3B8', fontSize: 13, marginRight: 12 },
  itemPrice: { color: '#fff', fontSize: 14, fontWeight: '600', minWidth: 70, textAlign: 'right' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12 },
  totalLabel: { color: '#fff', fontSize: 16, fontWeight: '700' },
  totalAmount: { color: '#10B981', fontSize: 18, fontWeight: '800' },
});
