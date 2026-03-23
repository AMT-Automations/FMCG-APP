import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { api } from '../src/services/api';
import * as Location from 'expo-location';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: '#F59E0B20', text: '#F59E0B' },
  confirmed: { bg: '#10B98120', text: '#10B981' },
  adjusted: { bg: '#3B82F620', text: '#3B82F6' },
  packed: { bg: '#6366F120', text: '#6366F1' },
  out_for_delivery: { bg: '#F9731620', text: '#F97316' },
  delivered: { bg: '#05966920', text: '#059669' },
  cancelled: { bg: '#EF444420', text: '#EF4444' },
};

export default function RouteDeliveriesScreen() {
  const { dailyRouteId } = useLocalSearchParams<{ dailyRouteId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<Record<string, boolean>>({});
  const [trackingLocation, setTrackingLocation] = useState(false);
  const locationIntervalRef = useRef<any>(null);

  const loadDeliveries = useCallback(async () => {
    if (!dailyRouteId) return;
    try {
      const result = await api.getRouteDeliveries(dailyRouteId);
      setData(result);
    } catch (error: any) {
      console.error('Failed to load deliveries:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dailyRouteId]);

  useEffect(() => {
    loadDeliveries();
  }, [loadDeliveries]);

  // GPS tracking
  const startLocationTracking = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (Platform.OS === 'web') {
          window.alert('Location permission is required for delivery tracking');
        } else {
          Alert.alert('Permission Required', 'Location permission is required for delivery tracking');
        }
        return;
      }

      setTrackingLocation(true);
      
      // Send location immediately
      sendCurrentLocation();
      
      // Then every 60 seconds
      locationIntervalRef.current = setInterval(sendCurrentLocation, 60000);
    } catch (error) {
      console.error('Location tracking error:', error);
    }
  };

  const sendCurrentLocation = async () => {
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (dailyRouteId) {
        await api.updateDriverLocation(dailyRouteId, {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          accuracy: loc.coords.accuracy ?? undefined,
          speed: loc.coords.speed ?? undefined,
          heading: loc.coords.heading ?? undefined,
        });
      }
    } catch (err) {
      console.error('Failed to send location:', err);
    }
  };

  const stopLocationTracking = () => {
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
    setTrackingLocation(false);
  };

  useEffect(() => {
    return () => {
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
      }
    };
  }, []);

  const handleMarkDelivered = async (orderId: string) => {
    const doMark = async () => {
      setUpdatingStatus((prev) => ({ ...prev, [orderId]: true }));
      try {
        await api.batchUpdateOrderStatus([orderId], 'delivered');
        loadDeliveries();
      } catch (error: any) {
        const msg = error?.response?.data?.detail || 'Failed to update status';
        if (Platform.OS === 'web') window.alert(msg);
        else Alert.alert('Error', msg);
      } finally {
        setUpdatingStatus((prev) => ({ ...prev, [orderId]: false }));
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Mark this order as delivered?')) doMark();
    } else {
      Alert.alert('Confirm Delivery', 'Mark this order as delivered?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delivered', onPress: doMark },
      ]);
    }
  };

  const handleMarkAllOutForDelivery = async () => {
    if (!data?.orders) return;
    const eligibleOrders = data.orders.filter((o: any) =>
      ['confirmed', 'packed', 'pending'].includes(o.status)
    );
    if (eligibleOrders.length === 0) return;

    const doUpdate = async () => {
      try {
        const orderIds = eligibleOrders.map((o: any) => o.id);
        await api.batchUpdateOrderStatus(orderIds, 'out_for_delivery');
        loadDeliveries();
      } catch (error: any) {
        const msg = error?.response?.data?.detail || 'Failed to update';
        if (Platform.OS === 'web') window.alert(msg);
        else Alert.alert('Error', msg);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Mark ${eligibleOrders.length} orders as Out for Delivery?`)) doUpdate();
    } else {
      Alert.alert('Confirm', `Mark ${eligibleOrders.length} orders as Out for Delivery?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: doUpdate },
      ]);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading deliveries...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Deliveries</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.emptyText}>No delivery data available</Text>
        </View>
      </SafeAreaView>
    );
  }

  const orders = data.orders || [];
  const summary = data.summary || {};

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{data.route_name}</Text>
          <Text style={styles.headerSub}>{data.date} • {data.driver_name}</Text>
        </View>
      </View>

      {/* Summary Bar */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNum}>{summary.total || 0}</Text>
          <Text style={styles.summaryLabel}>Total</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryNum, { color: '#F97316' }]}>{summary.out_for_delivery || 0}</Text>
          <Text style={styles.summaryLabel}>En Route</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryNum, { color: '#10B981' }]}>{summary.delivered || 0}</Text>
          <Text style={styles.summaryLabel}>Delivered</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryNum, { color: '#6366F1' }]}>{summary.packed || 0}</Text>
          <Text style={styles.summaryLabel}>Packed</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.actionBtn, trackingLocation && styles.actionBtnActive]}
          onPress={trackingLocation ? stopLocationTracking : startLocationTracking}
        >
          <Ionicons name={trackingLocation ? 'location' : 'location-outline'} size={18} color={trackingLocation ? '#10B981' : '#3B82F6'} />
          <Text style={[styles.actionBtnText, trackingLocation && { color: '#10B981' }]}>
            {trackingLocation ? 'Tracking ON' : 'Start GPS'}
          </Text>
        </TouchableOpacity>

        {(summary.confirmed > 0 || summary.packed > 0 || summary.pending > 0) && (
          <TouchableOpacity style={styles.actionBtn} onPress={handleMarkAllOutForDelivery}>
            <Ionicons name="car-outline" size={18} color="#F97316" />
            <Text style={[styles.actionBtnText, { color: '#F97316' }]}>All Out for Delivery</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Orders List */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadDeliveries(); }} tintColor="#3B82F6" />}
      >
        {orders.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="cube-outline" size={48} color="#475569" />
            <Text style={styles.emptyText}>No orders for this route</Text>
          </View>
        ) : (
          orders.map((order: any) => {
            const sc = STATUS_COLORS[order.status] || STATUS_COLORS['pending'];
            const isDelivered = order.status === 'delivered';
            const isUpdating = updatingStatus[order.id];
            return (
              <View key={order.id} style={[styles.orderCard, isDelivered && styles.orderCardDelivered]}>
                <View style={styles.orderCardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.customerName}>{order.customer_name}</Text>
                    <Text style={styles.orderNum}>#{order.order_number}</Text>
                  </View>
                  <View style={[styles.statusChip, { backgroundColor: sc.bg }]}>
                    <Text style={[styles.statusChipText, { color: sc.text }]}>
                      {order.status.replace(/_/g, ' ').toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={styles.itemsList}>
                  {order.items?.slice(0, 4).map((item: any, idx: number) => (
                    <Text key={idx} style={styles.itemText}>
                      {item.quantity}× {item.product_name}
                    </Text>
                  ))}
                  {order.items?.length > 4 && (
                    <Text style={styles.moreText}>+{order.items.length - 4} more items</Text>
                  )}
                </View>

                <View style={styles.orderCardFooter}>
                  <Text style={styles.orderAmount}>R {(order.total_amount || 0).toFixed(2)}</Text>
                  {!isDelivered && order.status !== 'cancelled' && (
                    <TouchableOpacity
                      style={styles.deliverBtn}
                      onPress={() => handleMarkDelivered(order.id)}
                      disabled={isUpdating}
                    >
                      {isUpdating ? (
                        <ActivityIndicator size="small" color="#10B981" />
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle-outline" size={18} color="#10B981" />
                          <Text style={styles.deliverBtnText}>Mark Delivered</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                  {isDelivered && (
                    <View style={styles.deliveredBadge}>
                      <Ionicons name="checkmark-done-circle" size={18} color="#10B981" />
                      <Text style={styles.deliveredBadgeText}>Delivered</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { color: '#94A3B8', marginTop: 12, fontSize: 14 },
  emptyText: { color: '#94A3B8', fontSize: 16, marginTop: 12 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#1E293B', borderBottomWidth: 1, borderBottomColor: '#334155' },
  backBtn: { padding: 8, marginRight: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  summaryBar: { flexDirection: 'row', backgroundColor: '#1E293B', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#334155' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryNum: { fontSize: 22, fontWeight: '800', color: '#fff' },
  summaryLabel: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  actionsRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1E293B', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#334155' },
  actionBtnActive: { borderColor: '#10B981', backgroundColor: '#064E3B' },
  actionBtnText: { color: '#3B82F6', fontSize: 13, fontWeight: '700' },
  orderCard: { backgroundColor: '#1E293B', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#334155' },
  orderCardDelivered: { borderColor: '#059669', opacity: 0.7 },
  orderCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  customerName: { fontSize: 16, fontWeight: '700', color: '#fff' },
  orderNum: { fontSize: 12, color: '#64748B', marginTop: 2 },
  statusChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusChipText: { fontSize: 11, fontWeight: '700' },
  itemsList: { marginBottom: 10 },
  itemText: { fontSize: 13, color: '#CBD5E1', marginBottom: 2 },
  moreText: { fontSize: 12, color: '#64748B', fontStyle: 'italic' },
  orderCardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#334155' },
  orderAmount: { fontSize: 17, fontWeight: '800', color: '#10B981' },
  deliverBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#064E3B', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#10B981' },
  deliverBtnText: { color: '#10B981', fontSize: 13, fontWeight: '700' },
  deliveredBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  deliveredBadgeText: { color: '#10B981', fontSize: 13, fontWeight: '600' },
});
