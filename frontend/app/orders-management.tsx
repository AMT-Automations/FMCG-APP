import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { api } from '../src/services/api';

interface Order {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  items: { product_name: string; quantity: number; unit_price: number }[];
  customer_name: string;
  customer_phone: string;
  route_name: string;
  delivery_day: string;
  delivery_date: string;
  created_at: string;
}

interface DashboardSummary {
  total_orders: number;
  pending: number;
  confirmed: number;
  adjusted: number;
  packed: number;
  out_for_delivery: number;
  delivered: number;
  cancelled: number;
  total_value: number;
  by_route: Record<string, { count: number; value: number }>;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: '#FEF3C7', text: '#92400E' },
  confirmed: { bg: '#D1FAE5', text: '#065F46' },
  adjusted: { bg: '#DBEAFE', text: '#1E40AF' },
  packed: { bg: '#E0E7FF', text: '#3730A3' },
  out_for_delivery: { bg: '#FDE68A', text: '#78350F' },
  delivered: { bg: '#A7F3D0', text: '#064E3B' },
  cancelled: { bg: '#FEE2E2', text: '#991B1B' },
};

export default function OrdersManagementScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [ordersData, summaryData] = await Promise.all([
        api.getOrders(filter ? { status: filter } : undefined),
        api.getOrderDashboard(),
      ]);
      setOrders(ordersData);
      setSummary(summaryData);
    } catch (error) {
      console.error('Failed to load orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    setUpdatingId(orderId);
    try {
      await api.updateOrderStatus(orderId, newStatus);
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update order status');
    } finally {
      setUpdatingId(null);
    }
  };

  const getNextStatus = (currentStatus: string): { label: string; value: string } | null => {
    const flow: Record<string, { label: string; value: string }> = {
      pending: { label: 'Confirm', value: 'confirmed' },
      confirmed: { label: 'Mark Packed', value: 'packed' },
      adjusted: { label: 'Mark Packed', value: 'packed' },
      packed: { label: 'Out for Delivery', value: 'out_for_delivery' },
      out_for_delivery: { label: 'Mark Delivered', value: 'delivered' },
    };
    return flow[currentStatus] || null;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
  };

  const formatTime = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
  };

  const filterOptions = [
    { label: 'All', value: null },
    { label: 'Pending', value: 'pending' },
    { label: 'Confirmed', value: 'confirmed' },
    { label: 'Packed', value: 'packed' },
    { label: 'Delivering', value: 'out_for_delivery' },
    { label: 'Delivered', value: 'delivered' },
  ];

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading orders...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Customer Orders</Text>
        <TouchableOpacity onPress={onRefresh} style={{ padding: 8 }}>
          <Ionicons name="refresh" size={24} color="#3B82F6" />
        </TouchableOpacity>
      </View>

      {/* Summary Cards */}
      {summary && (
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { borderLeftColor: '#F59E0B' }]}>
            <Text style={styles.summaryNumber}>{summary.pending}</Text>
            <Text style={styles.summaryLabel}>Pending</Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: '#10B981' }]}>
            <Text style={styles.summaryNumber}>{summary.confirmed + summary.packed}</Text>
            <Text style={styles.summaryLabel}>Confirmed</Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: '#3B82F6' }]}>
            <Text style={styles.summaryNumber}>{summary.total_orders}</Text>
            <Text style={styles.summaryLabel}>Total</Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: '#10B981' }]}>
            <Text style={[styles.summaryNumber, { fontSize: 14 }]}>R{summary.total_value.toFixed(0)}</Text>
            <Text style={styles.summaryLabel}>Value</Text>
          </View>
        </View>
      )}

      {/* Filter */}
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

      {/* Orders List */}
      <ScrollView
        style={styles.ordersList}
        contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />
        }
      >
        {orders.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={64} color="#475569" />
            <Text style={styles.emptyText}>No orders found</Text>
          </View>
        ) : (
          orders.map((order) => {
            const statusColor = STATUS_COLORS[order.status] || STATUS_COLORS['pending'];
            const nextAction = getNextStatus(order.status);
            const isUpdating = updatingId === order.id;

            return (
              <View key={order.id} style={styles.orderCard}>
                <View style={styles.orderCardHeader}>
                  <View>
                    <Text style={styles.orderNumber}>#{order.order_number}</Text>
                    <Text style={styles.customerName}>{order.customer_name}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
                    <Text style={[styles.statusText, { color: statusColor.text }]}>
                      {order.status.replace('_', ' ').toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={styles.orderMeta}>
                  <View style={styles.metaItem}>
                    <Ionicons name="map-outline" size={14} color="#64748B" />
                    <Text style={styles.metaText}>{order.route_name || 'N/A'}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Ionicons name="time-outline" size={14} color="#64748B" />
                    <Text style={styles.metaText}>{formatDate(order.created_at)} {formatTime(order.created_at)}</Text>
                  </View>
                </View>

                <View style={styles.itemsList}>
                  {order.items.map((item, idx) => (
                    <Text key={idx} style={styles.itemText}>
                      {item.quantity}× {item.product_name}
                    </Text>
                  ))}
                </View>

                <View style={styles.orderCardFooter}>
                  <Text style={styles.orderTotal}>R{order.total_amount.toFixed(2)}</Text>
                  <View style={styles.actionButtons}>
                    {nextAction && (
                      <TouchableOpacity
                        style={[styles.actionBtn, isUpdating && { opacity: 0.5 }]}
                        onPress={() => handleUpdateStatus(order.id, nextAction.value)}
                        disabled={isUpdating}
                      >
                        {isUpdating ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.actionBtnText}>{nextAction.label}</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
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
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#94A3B8', marginTop: 12 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  summaryRow: {
    flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 12,
  },
  summaryCard: {
    flex: 1, backgroundColor: '#1E293B', borderRadius: 10, padding: 12,
    borderLeftWidth: 3, alignItems: 'center',
  },
  summaryNumber: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  summaryLabel: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  filterRow: { maxHeight: 48, marginBottom: 8 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155',
  },
  filterChipActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  filterChipText: { fontSize: 13, fontWeight: '600', color: '#94A3B8' },
  filterChipTextActive: { color: '#FFFFFF' },
  ordersList: { flex: 1 },
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 16, color: '#94A3B8', marginTop: 12 },
  orderCard: {
    backgroundColor: '#1E293B', borderRadius: 14, padding: 16, marginBottom: 12,
  },
  orderCardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10,
  },
  orderNumber: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  customerName: { fontSize: 14, color: '#94A3B8', marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  orderMeta: { flexDirection: 'row', gap: 16, marginBottom: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: '#64748B' },
  itemsList: { marginBottom: 12 },
  itemText: { fontSize: 14, color: '#CBD5E1', marginBottom: 2 },
  orderCardFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 12,
  },
  orderTotal: { fontSize: 18, fontWeight: '800', color: '#10B981' },
  actionButtons: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    backgroundColor: '#3B82F6', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
  },
  actionBtnText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
});
