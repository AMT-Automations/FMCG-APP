import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Platform, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { api } from '../src/services/api';

interface OrderDetail {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  items: { product_name: string; quantity: number; unit_price: number }[];
  delivery_day: string;
  delivery_date: string;
  customer_name: string;
  customer_phone: string;
  route_name: string;
  notes?: string;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; icon: string; label: string }> = {
  pending: { bg: '#FEF3C7', text: '#92400E', icon: 'time', label: 'Pending' },
  confirmed: { bg: '#D1FAE5', text: '#065F46', icon: 'checkmark-circle', label: 'Confirmed' },
  adjusted: { bg: '#DBEAFE', text: '#1E40AF', icon: 'create', label: 'Adjusted' },
  packed: { bg: '#E0E7FF', text: '#3730A3', icon: 'cube', label: 'Packed' },
  out_for_delivery: { bg: '#FDE68A', text: '#78350F', icon: 'car', label: 'Out for Delivery' },
  delivered: { bg: '#A7F3D0', text: '#064E3B', icon: 'checkmark-done-circle', label: 'Delivered' },
  cancelled: { bg: '#FEE2E2', text: '#991B1B', icon: 'close-circle', label: 'Cancelled' },
};

export default function OrderConfirmationScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (orderId) loadOrder();
  }, [orderId]);

  const loadOrder = async () => {
    try {
      const data = await api.getOrder(orderId as string);
      setOrder(data);
    } catch (error) {
      console.error('Failed to load order:', error);
      Alert.alert('Error', 'Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!order) return;

    const itemsList = order.items
      .map((item) => `  • ${item.quantity}× ${item.product_name} @ R${item.unit_price.toFixed(2)}`)
      .join('\n');

    const message = [
      `🧾 *Order Confirmation*`,
      ``,
      `Order: *#${order.order_number}*`,
      `Status: ${STATUS_CONFIG[order.status]?.label || order.status}`,
      ``,
      `📦 *Items:*`,
      itemsList,
      ``,
      `💰 *Total: R${order.total_amount.toFixed(2)}*`,
      order.delivery_day ? `\n🚚 *Delivery:* ${order.delivery_day} (${order.delivery_date})` : '',
      ``,
      `Customer: ${order.customer_name}`,
      order.notes ? `Notes: ${order.notes}` : '',
      ``,
      `— Mzansi FMCG Tracker`,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await Share.share({
        message,
        title: `Order #${order.order_number}`,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleCancelOrder = () => {
    if (!order || order.status !== 'pending') return;

    Alert.alert('Cancel Order', 'Are you sure you want to cancel this order?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.updateOrderStatus(order.id, 'cancelled');
            loadOrder();
            Alert.alert('Cancelled', 'Your order has been cancelled.');
          } catch (error: any) {
            Alert.alert('Error', error.response?.data?.detail || 'Failed to cancel order');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>Loading order...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Ionicons name="alert-circle" size={48} color="#EF4444" />
          <Text style={styles.loadingText}>Order not found</Text>
          <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
            <Text style={styles.backLinkText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const statusInfo = STATUS_CONFIG[order.status] || STATUS_CONFIG['pending'];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBackBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Details</Text>
        <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
          <Ionicons name="share-outline" size={24} color="#10B981" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Success Banner (for new orders) */}
        {order.status === 'pending' && (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={32} color="#10B981" />
            <View style={{ marginLeft: 12 }}>
              <Text style={styles.successTitle}>Order Placed!</Text>
              <Text style={styles.successSub}>Your order has been submitted</Text>
            </View>
          </View>
        )}

        {/* Order Number Card */}
        <View style={styles.orderNumberCard}>
          <Text style={styles.orderNumberLabel}>ORDER NUMBER</Text>
          <Text style={styles.orderNumberValue}>#{order.order_number}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
            <Ionicons name={statusInfo.icon as any} size={16} color={statusInfo.text} />
            <Text style={[styles.statusText, { color: statusInfo.text }]}>{statusInfo.label}</Text>
          </View>
        </View>

        {/* Delivery Info */}
        {order.delivery_day && (
          <View style={styles.deliveryCard}>
            <Ionicons name="car-outline" size={22} color="#10B981" />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={styles.deliveryTitle}>Delivery</Text>
              <Text style={styles.deliveryValue}>
                {order.delivery_day}{order.delivery_date ? ` (${order.delivery_date})` : ''}
              </Text>
              {order.route_name && <Text style={styles.deliveryRoute}>Route: {order.route_name}</Text>}
            </View>
          </View>
        )}

        {/* Items */}
        <View style={styles.itemsCard}>
          <Text style={styles.sectionTitle}>Order Items</Text>
          {order.items.map((item, idx) => (
            <View key={idx} style={styles.itemRow}>
              <View style={styles.itemRowLeft}>
                <Text style={styles.itemQty}>{item.quantity}×</Text>
                <Text style={styles.itemName}>{item.product_name}</Text>
              </View>
              <Text style={styles.itemTotal}>R{(item.quantity * item.unit_price).toFixed(2)}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>R{order.total_amount.toFixed(2)}</Text>
          </View>
        </View>

        {/* Notes */}
        {order.notes && (
          <View style={styles.notesCard}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notesText}>{order.notes}</Text>
          </View>
        )}

        {/* Customer Info */}
        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Order Info</Text>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Customer</Text>
            <Text style={styles.infoValue}>{order.customer_name}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Placed</Text>
            <Text style={styles.infoValue}>
              {new Date(order.created_at).toLocaleString('en-ZA')}
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
            <Ionicons name="share-social" size={20} color="#FFFFFF" />
            <Text style={styles.shareButtonText}>Share via WhatsApp</Text>
          </TouchableOpacity>

          {order.status === 'pending' && (
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancelOrder}>
              <Ionicons name="close-circle" size={20} color="#EF4444" />
              <Text style={styles.cancelButtonText}>Cancel Order</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#94A3B8', marginTop: 12, fontSize: 16 },
  backLink: { marginTop: 20, padding: 12 },
  backLinkText: { color: '#3B82F6', fontSize: 16, fontWeight: '600' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  headerBackBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  shareBtn: { padding: 8 },
  content: { padding: 16, paddingBottom: 40 },
  successBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#064E3B',
    borderRadius: 14, padding: 16, marginBottom: 16,
  },
  successTitle: { fontSize: 18, fontWeight: '700', color: '#10B981' },
  successSub: { fontSize: 14, color: '#94A3B8', marginTop: 2 },
  orderNumberCard: {
    backgroundColor: '#1E293B', borderRadius: 14, padding: 20, alignItems: 'center', marginBottom: 16,
  },
  orderNumberLabel: { fontSize: 12, color: '#64748B', letterSpacing: 1, fontWeight: '600' },
  orderNumberValue: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', marginTop: 6, marginBottom: 12 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14,
    paddingVertical: 6, borderRadius: 10, gap: 6,
  },
  statusText: { fontSize: 13, fontWeight: '700' },
  deliveryCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B',
    borderRadius: 14, padding: 16, marginBottom: 16,
  },
  deliveryTitle: { fontSize: 12, color: '#64748B' },
  deliveryValue: { fontSize: 16, fontWeight: '600', color: '#FFFFFF', marginTop: 2 },
  deliveryRoute: { fontSize: 13, color: '#94A3B8', marginTop: 2 },
  itemsCard: { backgroundColor: '#1E293B', borderRadius: 14, padding: 18, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginBottom: 14 },
  itemRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#334155',
  },
  itemRowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 },
  itemQty: { fontSize: 15, fontWeight: '700', color: '#10B981', width: 35 },
  itemName: { fontSize: 15, color: '#E2E8F0', flex: 1 },
  itemTotal: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 14, marginTop: 8,
  },
  totalLabel: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  totalValue: { fontSize: 22, fontWeight: '800', color: '#10B981' },
  notesCard: { backgroundColor: '#1E293B', borderRadius: 14, padding: 18, marginBottom: 16 },
  notesText: { fontSize: 15, color: '#CBD5E1', lineHeight: 22 },
  infoCard: { backgroundColor: '#1E293B', borderRadius: 14, padding: 18, marginBottom: 16 },
  infoItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#334155',
  },
  infoLabel: { fontSize: 14, color: '#64748B' },
  infoValue: { fontSize: 14, color: '#E2E8F0', fontWeight: '500' },
  actionsRow: { gap: 12, marginTop: 8 },
  shareButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#10B981', borderRadius: 14, paddingVertical: 16, gap: 8,
  },
  shareButtonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  cancelButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1E293B', borderRadius: 14, paddingVertical: 16, gap: 8,
    borderWidth: 1, borderColor: '#EF4444',
  },
  cancelButtonText: { fontSize: 16, fontWeight: '600', color: '#EF4444' },
});
