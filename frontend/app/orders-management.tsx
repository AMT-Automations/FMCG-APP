import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Platform,
  Modal, TextInput, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { api } from '../src/services/api';

interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  items: OrderItem[];
  original_items?: OrderItem[];
  adjusted_items?: OrderItem[];
  adjustment_reason?: string;
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
  
  // Adjust order state
  const [adjustModalVisible, setAdjustModalVisible] = useState(false);
  const [adjustingOrder, setAdjustingOrder] = useState<Order | null>(null);
  const [adjustedQuantities, setAdjustedQuantities] = useState<Record<string, string>>({});
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustSaving, setAdjustSaving] = useState(false);

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

  const openAdjustModal = (order: Order) => {
    setAdjustingOrder(order);
    const quantities: Record<string, string> = {};
    order.items.forEach((item) => {
      quantities[item.product_id || item.product_name] = String(item.quantity);
    });
    setAdjustedQuantities(quantities);
    setAdjustReason('');
    setAdjustModalVisible(true);
  };

  const handleAdjustOrder = async () => {
    if (!adjustingOrder) return;
    setAdjustSaving(true);
    try {
      const adjustedItems = adjustingOrder.items.map((item) => {
        const key = item.product_id || item.product_name;
        const newQty = parseInt(adjustedQuantities[key] || '0', 10);
        return {
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: Math.max(0, newQty),
          unit_price: item.unit_price,
        };
      });

      await api.adjustOrder(adjustingOrder.id, {
        items: adjustedItems,
        reason: adjustReason || 'Stock adjustment by admin',
      });

      Alert.alert('Success', 'Order adjusted successfully. Customer will see the updated quantities.');
      setAdjustModalVisible(false);
      setAdjustingOrder(null);
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to adjust order');
    } finally {
      setAdjustSaving(false);
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
                    {(order.status === 'pending' || order.status === 'confirmed') && (
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: '#F59E0B' }]}
                        onPress={() => openAdjustModal(order)}
                      >
                        <Text style={styles.actionBtnText}>Adjust</Text>
                      </TouchableOpacity>
                    )}
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

                {/* Show if adjusted */}
                {order.status === 'adjusted' && order.adjustment_reason && (
                  <View style={styles.adjustedBanner}>
                    <Ionicons name="information-circle" size={14} color="#1E40AF" />
                    <Text style={styles.adjustedText}>Adjusted: {order.adjustment_reason}</Text>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Adjust Order Modal */}
      <Modal
        visible={adjustModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAdjustModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Adjust Order #{adjustingOrder?.order_number}
              </Text>
              <TouchableOpacity onPress={() => setAdjustModalVisible(false)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Customer: {adjustingOrder?.customer_name}
            </Text>
            <Text style={styles.modalHint}>
              Reduce quantities for out-of-stock items. Set to 0 to remove an item.
            </Text>

            <ScrollView style={styles.adjustItemsList}>
              {adjustingOrder?.items.map((item, idx) => {
                const key = item.product_id || item.product_name;
                return (
                  <View key={idx} style={styles.adjustItemRow}>
                    <View style={styles.adjustItemInfo}>
                      <Text style={styles.adjustItemName}>{item.product_name}</Text>
                      <Text style={styles.adjustItemOriginal}>
                        Original: {item.quantity} × R{item.unit_price.toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.adjustQtyBox}>
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() => {
                          const current = parseInt(adjustedQuantities[key] || '0', 10);
                          if (current > 0) {
                            setAdjustedQuantities({
                              ...adjustedQuantities,
                              [key]: String(current - 1),
                            });
                          }
                        }}
                      >
                        <Ionicons name="remove" size={18} color="#FFFFFF" />
                      </TouchableOpacity>
                      <TextInput
                        style={styles.qtyInput}
                        value={adjustedQuantities[key] || '0'}
                        onChangeText={(v) =>
                          setAdjustedQuantities({
                            ...adjustedQuantities,
                            [key]: v.replace(/[^0-9]/g, ''),
                          })
                        }
                        keyboardType="number-pad"
                      />
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() => {
                          const current = parseInt(adjustedQuantities[key] || '0', 10);
                          if (current < item.quantity) {
                            setAdjustedQuantities({
                              ...adjustedQuantities,
                              [key]: String(current + 1),
                            });
                          }
                        }}
                      >
                        <Ionicons name="add" size={18} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <TextInput
              style={styles.reasonInput}
              placeholder="Reason for adjustment (e.g. out of stock)"
              placeholderTextColor="#64748B"
              value={adjustReason}
              onChangeText={setAdjustReason}
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setAdjustModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveAdjustBtn, adjustSaving && { opacity: 0.5 }]}
                onPress={handleAdjustOrder}
                disabled={adjustSaving}
              >
                {adjustSaving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveAdjustBtnText}>Save Adjustment</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  adjustedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#1E3A5F', padding: 8, borderRadius: 8, marginTop: 8,
  },
  adjustedText: { fontSize: 12, color: '#93C5FD', flex: 1 },
  // Modal styles
  modalOverlay: {
    flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalContent: {
    backgroundColor: '#1E293B', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  modalSubtitle: { fontSize: 14, color: '#94A3B8', marginBottom: 4 },
  modalHint: { fontSize: 12, color: '#F59E0B', marginBottom: 16 },
  adjustItemsList: { maxHeight: 300 },
  adjustItemRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#0F172A', borderRadius: 10, padding: 12, marginBottom: 8,
  },
  adjustItemInfo: { flex: 1, marginRight: 12 },
  adjustItemName: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  adjustItemOriginal: { fontSize: 12, color: '#64748B', marginTop: 2 },
  adjustQtyBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  qtyBtn: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: '#334155',
    justifyContent: 'center', alignItems: 'center',
  },
  qtyInput: {
    width: 48, height: 36, backgroundColor: '#0F172A', borderRadius: 8,
    borderWidth: 1, borderColor: '#334155', textAlign: 'center',
    color: '#FFFFFF', fontSize: 16, fontWeight: '700',
  },
  reasonInput: {
    backgroundColor: '#0F172A', borderRadius: 10, padding: 12, marginTop: 12,
    color: '#FFFFFF', fontSize: 14, borderWidth: 1, borderColor: '#334155',
    minHeight: 60, textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row', gap: 12, marginTop: 16,
  },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1,
    borderColor: '#334155', alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: '#94A3B8' },
  saveAdjustBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: '#F59E0B',
    alignItems: 'center',
  },
  saveAdjustBtnText: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
});
