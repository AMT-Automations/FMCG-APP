import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/services/api';

interface Order {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  items: { product_name: string; quantity: number; unit_price: number }[];
  original_items?: { product_name: string; quantity: number; unit_price: number }[];
  adjustment_reason?: string;
  delivery_day: string;
  delivery_date: string;
  created_at: string;
  company_name?: string;
  route_name?: string;
  customer_name?: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  pending: { bg: '#FEF3C7', text: '#92400E', icon: 'time' },
  confirmed: { bg: '#D1FAE5', text: '#065F46', icon: 'checkmark-circle' },
  adjusted: { bg: '#DBEAFE', text: '#1E40AF', icon: 'create' },
  packed: { bg: '#E0E7FF', text: '#3730A3', icon: 'cube' },
  out_for_delivery: { bg: '#FDE68A', text: '#78350F', icon: 'car' },
  delivered: { bg: '#A7F3D0', text: '#064E3B', icon: 'checkmark-done-circle' },
  cancelled: { bg: '#FEE2E2', text: '#991B1B', icon: 'close-circle' },
};

export default function OrdersScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    try {
      const data = await api.getOrders(filter ? { status: filter } : undefined);
      setOrders(data);
    } catch (error) {
      console.error('Failed to load orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const onRefresh = () => {
    setRefreshing(true);
    loadOrders();
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatTime = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusInfo = (status: string) => {
    return STATUS_COLORS[status] || STATUS_COLORS['pending'];
  };

  const filterOptions = [
    { label: 'All', value: null },
    { label: 'Pending', value: 'pending' },
    { label: 'Confirmed', value: 'confirmed' },
    { label: 'Adjusted', value: 'adjusted' },
    { label: 'Delivered', value: 'delivered' },
    { label: 'Cancelled', value: 'cancelled' },
  ];

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>Loading orders...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Orders</Text>
        <Text style={styles.headerSub}>{orders.length} order{orders.length !== 1 ? 's' : ''}</Text>
      </View>

      {/* Filter Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {filterOptions.map((opt) => (
          <TouchableOpacity
            key={opt.label}
            style={[styles.filterChip, filter === opt.value && styles.filterChipActive]}
            onPress={() => setFilter(opt.value)}
          >
            <Text style={[styles.filterChipText, filter === opt.value && styles.filterChipTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.ordersList}
        contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />
        }
      >
        {orders.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={64} color="#475569" />
            <Text style={styles.emptyStateText}>No orders yet</Text>
            <Text style={styles.emptyStateSub}>Place your first order from the Shop tab!</Text>
          </View>
        ) : (
          orders.map((order) => {
            const statusInfo = getStatusInfo(order.status);
            return (
              <TouchableOpacity
                key={order.id}
                style={styles.orderCard}
                onPress={() => router.push({ pathname: '/order-confirmation', params: { orderId: order.id } })}
              >
                <View style={styles.orderCardHeader}>
                  <View>
                    <Text style={styles.orderNumber}>#{order.order_number}</Text>
                    <Text style={styles.orderDate}>
                      {formatDate(order.created_at)} at {formatTime(order.created_at)}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
                    <Ionicons name={statusInfo.icon as any} size={14} color={statusInfo.text} />
                    <Text style={[styles.statusText, { color: statusInfo.text }]}>
                      {order.status.replace('_', ' ').toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={styles.orderItems}>
                  {order.items.slice(0, 3).map((item, idx) => (
                    <Text key={idx} style={styles.orderItemText}>
                      {item.quantity}× {item.product_name}
                    </Text>
                  ))}
                  {order.items.length > 3 && (
                    <Text style={styles.moreItems}>+{order.items.length - 3} more items</Text>
                  )}
                </View>

                {/* Adjustment Notice */}
                {order.status === 'adjusted' && (
                  <View style={styles.adjustmentBanner}>
                    <Ionicons name="alert-circle" size={16} color="#F59E0B" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.adjustmentTitle}>Order Adjusted</Text>
                      {order.adjustment_reason ? (
                        <Text style={styles.adjustmentReason}>{order.adjustment_reason}</Text>
                      ) : null}
                      {order.original_items && order.original_items.length > 0 && (
                        <View style={styles.adjustmentDetails}>
                          {order.original_items.map((origItem, idx) => {
                            const currentItem = order.items.find(i => i.product_name === origItem.product_name);
                            const currentQty = currentItem ? currentItem.quantity : 0;
                            if (origItem.quantity !== currentQty) {
                              return (
                                <Text key={idx} style={styles.adjustmentItem}>
                                  {origItem.product_name}: {origItem.quantity} → {currentQty}
                                </Text>
                              );
                            }
                            return null;
                          })}
                        </View>
                      )}
                    </View>
                  </View>
                )}

                <View style={styles.orderCardFooter}>
                  {order.delivery_day ? (
                    <View style={styles.deliveryTag}>
                      <Ionicons name="calendar-outline" size={14} color="#64748B" />
                      <Text style={styles.deliveryTagText}>
                        {order.delivery_day} {order.delivery_date ? `(${order.delivery_date})` : ''}
                      </Text>
                    </View>
                  ) : null}
                  <Text style={styles.orderTotal}>R{order.total_amount.toFixed(2)}</Text>
                </View>

                {/* Track Order Button */}
                {order.status !== 'cancelled' && order.status !== 'delivered' && (
                  <TouchableOpacity
                    style={styles.trackBtn}
                    onPress={(e) => {
                      e.stopPropagation();
                      router.push({ pathname: '/order-tracking', params: { orderId: order.id } });
                    }}
                  >
                    <Ionicons name="navigate-outline" size={16} color="#3B82F6" />
                    <Text style={styles.trackBtnText}>Track Order</Text>
                  </TouchableOpacity>
                )}
                {order.status === 'delivered' && (
                  <View style={styles.deliveredTag}>
                    <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                    <Text style={styles.deliveredTagText}>Delivered</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#94A3B8', marginTop: 12, fontSize: 16 },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#FFFFFF' },
  headerSub: { fontSize: 14, color: '#64748B', marginTop: 2 },
  filterRow: { maxHeight: 50, marginBottom: 8 },
  filterChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155',
  },
  filterChipActive: { backgroundColor: '#10B981', borderColor: '#10B981' },
  filterChipText: { fontSize: 13, fontWeight: '600', color: '#94A3B8' },
  filterChipTextActive: { color: '#FFFFFF' },
  ordersList: { flex: 1 },
  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyStateText: { fontSize: 18, fontWeight: '600', color: '#94A3B8', marginTop: 16 },
  emptyStateSub: { fontSize: 14, color: '#475569', marginTop: 4 },
  orderCard: {
    backgroundColor: '#1E293B', borderRadius: 14, padding: 16, marginBottom: 12,
  },
  orderCardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12,
  },
  orderNumber: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  orderDate: { fontSize: 13, color: '#64748B', marginTop: 2 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: 8, gap: 4,
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  orderItems: { marginBottom: 12 },
  orderItemText: { fontSize: 14, color: '#CBD5E1', marginBottom: 2 },
  moreItems: { fontSize: 13, color: '#64748B', fontStyle: 'italic', marginTop: 2 },
  orderCardFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 12,
  },
  deliveryTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  deliveryTagText: { fontSize: 13, color: '#64748B' },
  orderTotal: { fontSize: 18, fontWeight: '800', color: '#10B981' },
  trackBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#1E3A5F', borderRadius: 8, paddingVertical: 10, marginTop: 12,
    borderWidth: 1, borderColor: '#3B82F6',
  },
  trackBtnText: { color: '#3B82F6', fontSize: 14, fontWeight: '700' },
  deliveredTag: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#064E3B', borderRadius: 8, paddingVertical: 8, marginTop: 12,
  },
  deliveredTagText: { color: '#10B981', fontSize: 13, fontWeight: '600' },
  adjustmentBanner: {
    flexDirection: 'row', gap: 8, backgroundColor: '#1E3348',
    borderRadius: 10, padding: 12, marginBottom: 12,
    borderLeftWidth: 3, borderLeftColor: '#F59E0B',
  },
  adjustmentTitle: { fontSize: 13, fontWeight: '700', color: '#F59E0B' },
  adjustmentReason: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  adjustmentDetails: { marginTop: 6 },
  adjustmentItem: { fontSize: 12, color: '#CBD5E1', marginBottom: 1 },
});
