import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, TextInput,
  Modal, Platform, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { api } from '../src/services/api';

interface DailyRoute {
  id: string;
  route_name: string;
  driver_name: string;
  vehicle_name: string;
  date: string;
  status: string;
}

interface StockItem {
  id: string;
  product_id: string;
  product_name: string;
  current_quantity: number;
  category?: string;
  unit_type?: string;
}

interface VehicleStockItem {
  id: string;
  product_name: string;
  quantity_loaded: number;
  quantity_sold: number;
  quantity_remaining: number;
  quantity_returned: number;
}

interface DispatchItem {
  product_id: string;
  product_name: string;
  quantity: number;
  available: number;
}

export default function VehicleDispatchScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dailyRoutes, setDailyRoutes] = useState<DailyRoute[]>([]);
  const [stockLevels, setStockLevels] = useState<StockItem[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<DailyRoute | null>(null);
  const [vehicleStock, setVehicleStock] = useState<any>(null);

  // Dispatch modal
  const [dispatchModalVisible, setDispatchModalVisible] = useState(false);
  const [dispatchItems, setDispatchItems] = useState<DispatchItem[]>([]);
  const [dispatching, setDispatching] = useState(false);

  // Return modal
  const [returnModalVisible, setReturnModalVisible] = useState(false);
  const [returnItems, setReturnItems] = useState<{ product_id: string; product_name: string; quantity: string; max: number }[]>([]);
  const [returning, setReturning] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [routesData, stockData] = await Promise.all([
        api.getActiveDailyRoutes().catch(() => []),
        api.getStockLevels().catch(() => []),
      ]);
      setDailyRoutes(routesData);
      setStockLevels(stockData);
    } catch (error) {
      console.error('Failed to load dispatch data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const loadVehicleStock = async (route: DailyRoute) => {
    setSelectedRoute(route);
    try {
      const data = await api.getVehicleStock(route.id);
      setVehicleStock(data);
    } catch (error) {
      setVehicleStock(null);
    }
  };

  const openDispatchModal = () => {
    if (!selectedRoute) {
      Alert.alert('Select Route', 'Please select a daily route first');
      return;
    }
    const items: DispatchItem[] = stockLevels
      .filter((s) => (s.current_quantity || 0) > 0)
      .map((s) => ({
        product_id: s.product_id || s.id,
        product_name: s.product_name,
        quantity: 0,
        available: s.current_quantity || 0,
      }));
    if (items.length === 0) {
      Alert.alert('No Stock', 'No warehouse stock available to dispatch. Receive stock from suppliers first.');
      return;
    }
    setDispatchItems(items);
    setDispatchModalVisible(true);
  };

  const handleDispatch = async () => {
    if (!selectedRoute) return;
    const itemsToDispatch = dispatchItems.filter((i) => i.quantity > 0);
    if (itemsToDispatch.length === 0) {
      Alert.alert('No Items', 'Please set quantities for at least one product.');
      return;
    }

    setDispatching(true);
    try {
      await api.dispatchVehicleStock({
        daily_route_id: selectedRoute.id,
        items: itemsToDispatch.map((i) => ({
          product_id: i.product_id,
          product_name: i.product_name,
          quantity: i.quantity,
        })),
      });
      Alert.alert('Success', `Stock dispatched to ${selectedRoute.vehicle_name}`);
      setDispatchModalVisible(false);
      loadVehicleStock(selectedRoute);
      loadData(); // Refresh stock levels
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to dispatch stock');
    } finally {
      setDispatching(false);
    }
  };

  const openReturnModal = () => {
    if (!vehicleStock || !vehicleStock.items || vehicleStock.items.length === 0) {
      Alert.alert('No Stock', 'No stock loaded on this vehicle.');
      return;
    }
    const items = vehicleStock.items
      .filter((i: VehicleStockItem) => i.quantity_remaining > 0)
      .map((i: VehicleStockItem) => ({
        product_id: (i as any).product_id || i.id,
        product_name: i.product_name,
        quantity: String(i.quantity_remaining),
        max: i.quantity_remaining,
      }));
    setReturnItems(items);
    setReturnModalVisible(true);
  };

  const handleReturn = async () => {
    if (!selectedRoute) return;
    const itemsToReturn = returnItems
      .filter((i) => parseInt(i.quantity, 10) > 0)
      .map((i) => ({
        product_id: i.product_id,
        product_name: i.product_name,
        quantity: parseInt(i.quantity, 10),
      }));

    if (itemsToReturn.length === 0) {
      Alert.alert('No Items', 'No stock to return.');
      return;
    }

    setReturning(true);
    try {
      await api.returnVehicleStock({
        daily_route_id: selectedRoute.id,
        items: itemsToReturn,
      });
      Alert.alert('Success', 'Returned stock received back to warehouse.');
      setReturnModalVisible(false);
      loadVehicleStock(selectedRoute);
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to return stock');
    } finally {
      setReturning(false);
    }
  };

  const updateDispatchQty = (index: number, value: string) => {
    const updated = [...dispatchItems];
    const numVal = parseInt(value.replace(/[^0-9]/g, '') || '0', 10);
    updated[index].quantity = Math.min(numVal, updated[index].available);
    setDispatchItems(updated);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading dispatch data...</Text>
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
        <Text style={styles.headerTitle}>Vehicle Stock Dispatch</Text>
        <TouchableOpacity onPress={onRefresh} style={{ padding: 8 }}>
          <Ionicons name="refresh" size={24} color="#3B82F6" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />
        }
      >
        {/* Daily Routes Selection */}
        <Text style={styles.sectionTitle}>Select Daily Route</Text>
        {dailyRoutes.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="car-outline" size={32} color="#475569" />
            <Text style={styles.emptyText}>No active daily routes. Start a route first.</Text>
          </View>
        ) : (
          dailyRoutes.map((route) => (
            <TouchableOpacity
              key={route.id}
              style={[
                styles.routeCard,
                selectedRoute?.id === route.id && styles.routeCardSelected,
              ]}
              onPress={() => loadVehicleStock(route)}
            >
              <View style={styles.routeCardHeader}>
                <View style={[styles.routeIcon, { backgroundColor: route.status === 'active' ? '#1E3B35' : '#1E293B' }]}>
                  <Ionicons name="car" size={20} color={route.status === 'active' ? '#10B981' : '#64748B'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.routeName}>{route.route_name}</Text>
                  <Text style={styles.routeInfo}>
                    {route.driver_name} • {route.vehicle_name}
                  </Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: route.status === 'active' ? '#064E3B' : '#334155' }]}>
                  <Text style={[styles.statusPillText, { color: route.status === 'active' ? '#10B981' : '#94A3B8' }]}>
                    {route.status}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}

        {/* Vehicle Stock */}
        {selectedRoute && (
          <View style={styles.vehicleStockSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Stock on {selectedRoute.vehicle_name}
              </Text>
            </View>

            {vehicleStock && vehicleStock.items && vehicleStock.items.length > 0 ? (
              <>
                <View style={styles.stockSummary}>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryValue}>{vehicleStock.total_loaded}</Text>
                    <Text style={styles.summaryLabel}>Loaded</Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={[styles.summaryValue, { color: '#10B981' }]}>{vehicleStock.total_sold}</Text>
                    <Text style={styles.summaryLabel}>Sold</Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={[styles.summaryValue, { color: '#F59E0B' }]}>{vehicleStock.total_remaining}</Text>
                    <Text style={styles.summaryLabel}>Remaining</Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={[styles.summaryValue, { color: '#3B82F6' }]}>{vehicleStock.total_returned}</Text>
                    <Text style={styles.summaryLabel}>Returned</Text>
                  </View>
                </View>

                {vehicleStock.items.map((item: VehicleStockItem, idx: number) => (
                  <View key={idx} style={styles.stockItemCard}>
                    <Text style={styles.stockItemName}>{item.product_name}</Text>
                    <View style={styles.stockItemDetails}>
                      <View style={styles.stockDetail}>
                        <Text style={styles.stockDetailLabel}>Loaded</Text>
                        <Text style={styles.stockDetailValue}>{item.quantity_loaded}</Text>
                      </View>
                      <View style={styles.stockDetail}>
                        <Text style={styles.stockDetailLabel}>Sold</Text>
                        <Text style={[styles.stockDetailValue, { color: '#10B981' }]}>{item.quantity_sold}</Text>
                      </View>
                      <View style={styles.stockDetail}>
                        <Text style={styles.stockDetailLabel}>Left</Text>
                        <Text style={[styles.stockDetailValue, { color: '#F59E0B' }]}>{item.quantity_remaining}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </>
            ) : (
              <View style={styles.emptyCard}>
                <Ionicons name="cube-outline" size={32} color="#475569" />
                <Text style={styles.emptyText}>No stock loaded on this vehicle yet.</Text>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.dispatchBtn} onPress={openDispatchModal}>
                <Ionicons name="arrow-up-circle" size={20} color="#FFFFFF" />
                <Text style={styles.dispatchBtnText}>Load Stock</Text>
              </TouchableOpacity>
              {vehicleStock && vehicleStock.items && vehicleStock.items.length > 0 && (
                <TouchableOpacity style={styles.returnBtn} onPress={openReturnModal}>
                  <Ionicons name="arrow-down-circle" size={20} color="#FFFFFF" />
                  <Text style={styles.returnBtnText}>Receive Returns</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Dispatch Modal */}
      <Modal visible={dispatchModalVisible} animationType="slide" transparent={true} onRequestClose={() => setDispatchModalVisible(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Load Stock onto Vehicle</Text>
              <TouchableOpacity onPress={() => setDispatchModalVisible(false)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              {selectedRoute?.vehicle_name} • {selectedRoute?.driver_name}
            </Text>

            <ScrollView style={styles.dispatchList}>
              {dispatchItems.map((item, idx) => (
                <View key={idx} style={styles.dispatchItemRow}>
                  <View style={styles.dispatchItemInfo}>
                    <Text style={styles.dispatchItemName} numberOfLines={1}>{item.product_name}</Text>
                    <Text style={styles.dispatchItemAvail}>
                      Warehouse: {item.available} available
                    </Text>
                  </View>
                  <View style={styles.qtyControls}>
                    <TouchableOpacity
                      style={[styles.qtyBtn, item.quantity === 0 && styles.qtyBtnDisabled]}
                      onPress={() => {
                        if (item.quantity > 0) {
                          const updated = [...dispatchItems];
                          updated[idx].quantity = item.quantity - 1;
                          setDispatchItems(updated);
                        }
                      }}
                    >
                      <Ionicons name="remove" size={18} color={item.quantity === 0 ? '#475569' : '#FFFFFF'} />
                    </TouchableOpacity>
                    <TextInput
                      style={styles.qtyInput}
                      value={String(item.quantity)}
                      onChangeText={(v) => updateDispatchQty(idx, v)}
                      keyboardType="number-pad"
                    />
                    <TouchableOpacity
                      style={[styles.qtyBtn, item.quantity >= item.available && styles.qtyBtnDisabled]}
                      onPress={() => {
                        if (item.quantity < item.available) {
                          const updated = [...dispatchItems];
                          updated[idx].quantity = item.quantity + 1;
                          setDispatchItems(updated);
                        }
                      }}
                    >
                      <Ionicons name="add" size={18} color={item.quantity >= item.available ? '#475569' : '#FFFFFF'} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>

            {/* Dispatch summary */}
            <View style={styles.dispatchSummaryRow}>
              <Text style={styles.dispatchSummaryLabel}>
                Total items to load: 
              </Text>
              <Text style={styles.dispatchSummaryValue}>
                {dispatchItems.reduce((sum, i) => sum + i.quantity, 0)} units ({dispatchItems.filter(i => i.quantity > 0).length} products)
              </Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setDispatchModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, dispatching && { opacity: 0.5 }]}
                onPress={handleDispatch}
                disabled={dispatching}
              >
                {dispatching ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmBtnText}>Dispatch Stock</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Return Modal */}
      <Modal visible={returnModalVisible} animationType="slide" transparent={true} onRequestClose={() => setReturnModalVisible(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Receive Returned Stock</Text>
              <TouchableOpacity onPress={() => setReturnModalVisible(false)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              Unsold stock returning from {selectedRoute?.vehicle_name}
            </Text>

            <ScrollView style={styles.dispatchList}>
              {returnItems.map((item, idx) => (
                <View key={idx} style={styles.dispatchItemRow}>
                  <View style={styles.dispatchItemInfo}>
                    <Text style={styles.dispatchItemName} numberOfLines={1}>{item.product_name}</Text>
                    <Text style={styles.dispatchItemAvail}>On vehicle: {item.max} remaining</Text>
                  </View>
                  <View style={styles.qtyControls}>
                    <TouchableOpacity
                      style={[styles.qtyBtn, parseInt(item.quantity, 10) === 0 && styles.qtyBtnDisabled]}
                      onPress={() => {
                        const curr = parseInt(item.quantity, 10);
                        if (curr > 0) {
                          const updated = [...returnItems];
                          updated[idx].quantity = String(curr - 1);
                          setReturnItems(updated);
                        }
                      }}
                    >
                      <Ionicons name="remove" size={18} color={parseInt(item.quantity, 10) === 0 ? '#475569' : '#FFFFFF'} />
                    </TouchableOpacity>
                    <TextInput
                      style={styles.qtyInput}
                      value={item.quantity}
                      onChangeText={(v) => {
                        const updated = [...returnItems];
                        const num = parseInt(v.replace(/[^0-9]/g, '') || '0', 10);
                        updated[idx].quantity = String(Math.min(num, item.max));
                        setReturnItems(updated);
                      }}
                      keyboardType="number-pad"
                    />
                    <TouchableOpacity
                      style={[styles.qtyBtn, parseInt(item.quantity, 10) >= item.max && styles.qtyBtnDisabled]}
                      onPress={() => {
                        const curr = parseInt(item.quantity, 10);
                        if (curr < item.max) {
                          const updated = [...returnItems];
                          updated[idx].quantity = String(curr + 1);
                          setReturnItems(updated);
                        }
                      }}
                    >
                      <Ionicons name="add" size={18} color={parseInt(item.quantity, 10) >= item.max ? '#475569' : '#FFFFFF'} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>

            {/* Return summary */}
            <View style={styles.dispatchSummaryRow}>
              <Text style={styles.dispatchSummaryLabel}>Total to receive back: </Text>
              <Text style={styles.dispatchSummaryValue}>
                {returnItems.reduce((sum, i) => sum + parseInt(i.quantity, 10), 0)} units
              </Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setReturnModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: '#10B981' }, returning && { opacity: 0.5 }]}
                onPress={handleReturn}
                disabled={returning}
              >
                {returning ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmBtnText}>Confirm Return</Text>
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
  scrollView: { flex: 1 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginTop: 16, marginBottom: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  emptyCard: {
    backgroundColor: '#1E293B', borderRadius: 14, padding: 24, alignItems: 'center', gap: 8,
  },
  emptyText: { color: '#64748B', fontSize: 14, textAlign: 'center' },
  routeCard: {
    backgroundColor: '#1E293B', borderRadius: 14, padding: 16, marginBottom: 8,
    borderWidth: 2, borderColor: 'transparent',
  },
  routeCardSelected: { borderColor: '#3B82F6' },
  routeCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  routeIcon: {
    width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center',
  },
  routeName: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  routeInfo: { fontSize: 13, color: '#94A3B8', marginTop: 2 },
  statusPill: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  statusPillText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  vehicleStockSection: { marginTop: 8 },
  stockSummary: {
    flexDirection: 'row', backgroundColor: '#1E293B', borderRadius: 14, padding: 16, gap: 8, marginBottom: 12,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  summaryLabel: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  stockItemCard: {
    backgroundColor: '#1E293B', borderRadius: 12, padding: 14, marginBottom: 8,
  },
  stockItemName: { fontSize: 14, fontWeight: '600', color: '#FFFFFF', marginBottom: 8 },
  stockItemDetails: { flexDirection: 'row', gap: 12 },
  stockDetail: { flex: 1, alignItems: 'center', backgroundColor: '#0F172A', borderRadius: 8, padding: 8 },
  stockDetailLabel: { fontSize: 11, color: '#64748B' },
  stockDetailValue: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  dispatchBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#3B82F6', borderRadius: 12, paddingVertical: 14,
  },
  dispatchBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  returnBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#10B981', borderRadius: 12, paddingVertical: 14,
  },
  returnBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalContent: {
    backgroundColor: '#1E293B', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  modalSubtitle: { fontSize: 14, color: '#94A3B8', marginBottom: 16 },
  dispatchList: { maxHeight: 350 },
  dispatchItemRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#0F172A', borderRadius: 10, padding: 12, marginBottom: 8,
  },
  dispatchItemInfo: { flex: 1, marginRight: 12 },
  dispatchItemName: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  dispatchItemAvail: { fontSize: 12, color: '#64748B', marginTop: 2 },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: {
    width: 36, height: 36, borderRadius: 8, backgroundColor: '#334155',
    justifyContent: 'center', alignItems: 'center',
  },
  qtyBtnDisabled: {
    backgroundColor: '#1E293B',
    opacity: 0.5,
  },
  qtyInput: {
    width: 52, height: 40, backgroundColor: '#0F172A', borderRadius: 8,
    borderWidth: 1, borderColor: '#334155', textAlign: 'center',
    color: '#FFFFFF', fontSize: 17, fontWeight: '700',
  },
  dispatchSummaryRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, marginTop: 8,
    borderTopWidth: 1, borderTopColor: '#334155',
  },
  dispatchSummaryLabel: { fontSize: 13, color: '#94A3B8' },
  dispatchSummaryValue: { fontSize: 14, fontWeight: '700', color: '#3B82F6' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1,
    borderColor: '#334155', alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: '#94A3B8' },
  confirmBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: '#3B82F6',
    alignItems: 'center',
  },
  confirmBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
