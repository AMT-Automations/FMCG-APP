import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/services/api';

interface Customer {
  id: string;
  name: string;
  contact: string | null;
  location: string | null;
  payment_terms: string;
  route_id: string | null;
}

interface Route {
  id: string;
  name: string;
  description: string | null;
  customer_count: number;
}

export default function RouteScreen() {
  const router = useRouter();
  const [activeRoute, setActiveRoute] = useState<any>(null);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addCustomerVisible, setAddCustomerVisible] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', contact: '', location: '' });
  const [savingCustomer, setSavingCustomer] = useState(false);

  const loadData = async () => {
    try {
      const [activeRouteData, routesData] = await Promise.all([
        api.getActiveDailyRoute(),
        api.getRoutes(),
      ]);
      setActiveRoute(activeRouteData);
      setRoutes(routesData);

      if (activeRouteData) {
        const [customersData, salesData] = await Promise.all([
          api.getRouteCustomers(activeRouteData.route_id),
          api.getSales(activeRouteData.route_id),
        ]);
        setCustomers(customersData);
        setSales(salesData);
      } else {
        setCustomers([]);
        setSales([]);
      }
    } catch (error) {
      console.error('Error loading route data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const getCustomerStatus = (customerId: string) => {
    const customerSales = sales.filter((s) => s.customer_id === customerId);
    if (customerSales.length > 0) {
      return 'delivered';
    }
    return 'pending';
  };

  const handleAddCustomer = async () => {
    if (!newCustomer.name.trim()) {
      Alert.alert('Error', 'Customer name is required');
      return;
    }

    setSavingCustomer(true);
    try {
      await api.createCustomer({
        name: newCustomer.name,
        contact: newCustomer.contact || undefined,
        location: newCustomer.location || undefined,
        route_id: activeRoute?.route_id,
      });
      setAddCustomerVisible(false);
      setNewCustomer({ name: '', contact: '', location: '' });
      loadData();
    } catch (error) {
      Alert.alert('Error', 'Failed to add customer');
    } finally {
      setSavingCustomer(false);
    }
  };

  const renderCustomer = ({ item }: { item: Customer }) => {
    const status = getCustomerStatus(item.id);
    const customerSales = sales.filter((s) => s.customer_id === item.id);
    const totalCollected = customerSales.reduce((sum, s) => sum + s.cash_collected, 0);

    return (
      <TouchableOpacity
        style={[
          styles.customerCard,
          status === 'delivered' && styles.customerCardDelivered,
        ]}
        onPress={() => router.push(`/sales/${item.id}?name=${encodeURIComponent(item.name)}`)}
      >
        <View style={styles.customerHeader}>
          <View style={styles.customerInfo}>
            <Text style={styles.customerName}>{item.name}</Text>
            {item.location && (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={14} color="#64748B" />
                <Text style={styles.customerLocation}>{item.location}</Text>
              </View>
            )}
          </View>
          <View
            style={[
              styles.statusBadge,
              status === 'delivered' ? styles.statusDelivered : styles.statusPending,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                status === 'delivered' ? styles.statusTextDelivered : styles.statusTextPending,
              ]}
            >
              {status === 'delivered' ? 'Delivered' : 'Pending'}
            </Text>
          </View>
        </View>

        <View style={styles.customerFooter}>
          <View style={styles.paymentTag}>
            <Ionicons
              name={item.payment_terms === 'cash' ? 'cash-outline' : 'card-outline'}
              size={14}
              color="#64748B"
            />
            <Text style={styles.paymentText}>{item.payment_terms}</Text>
          </View>
          {status === 'delivered' && (
            <Text style={styles.collectedAmount}>R {totalCollected.toFixed(2)}</Text>
          )}
          <Ionicons name="chevron-forward" size={20} color="#64748B" />
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </SafeAreaView>
    );
  }

  if (!activeRoute) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.noRouteContainer}>
          <View style={styles.noRouteIcon}>
            <Ionicons name="map-outline" size={64} color="#64748B" />
          </View>
          <Text style={styles.noRouteTitle}>No Active Route</Text>
          <Text style={styles.noRouteSubtitle}>
            Start a route from the home screen to see customers
          </Text>
          <TouchableOpacity
            style={styles.startButton}
            onPress={() => router.push('/start-route')}
          >
            <Ionicons name="play" size={20} color="#FFFFFF" />
            <Text style={styles.startButtonText}>Start a Route</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{activeRoute.route_name}</Text>
          <Text style={styles.headerSubtitle}>
            {customers.length} customers • {sales.length} delivered
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setAddCustomerVisible(true)}
        >
          <Ionicons name="person-add" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Progress */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${customers.length > 0 ? (sales.length / customers.length) * 100 : 0}%`,
              },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {customers.length > 0
            ? `${Math.round((sales.length / customers.length) * 100)}% Complete`
            : '0% Complete'}
        </Text>
      </View>

      {/* Customer List */}
      <FlatList
        data={customers}
        keyExtractor={(item) => item.id}
        renderItem={renderCustomer}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color="#64748B" />
            <Text style={styles.emptyText}>No customers on this route</Text>
            <TouchableOpacity
              style={styles.addCustomerButton}
              onPress={() => setAddCustomerVisible(true)}
            >
              <Text style={styles.addCustomerButtonText}>Add Customer</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Add Customer Modal */}
      <Modal
        visible={addCustomerVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAddCustomerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Customer</Text>
              <TouchableOpacity onPress={() => setAddCustomerVisible(false)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Customer Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter customer name"
                placeholderTextColor="#64748B"
                value={newCustomer.name}
                onChangeText={(text) => setNewCustomer({ ...newCustomer, name: text })}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Contact Number</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter phone number"
                placeholderTextColor="#64748B"
                value={newCustomer.contact}
                onChangeText={(text) => setNewCustomer({ ...newCustomer, contact: text })}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Location</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter location/address"
                placeholderTextColor="#64748B"
                value={newCustomer.location}
                onChangeText={(text) => setNewCustomer({ ...newCustomer, location: text })}
              />
            </View>

            <TouchableOpacity
              style={[styles.saveButton, savingCustomer && styles.saveButtonDisabled]}
              onPress={handleAddCustomer}
              disabled={savingCustomer}
            >
              {savingCustomer ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>Add Customer</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 2,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressContainer: {
    padding: 16,
    backgroundColor: '#1E293B',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#334155',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 8,
    textAlign: 'right',
  },
  listContent: {
    padding: 16,
  },
  customerCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  customerCardDelivered: {
    borderLeftColor: '#10B981',
  },
  customerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  customerLocation: {
    fontSize: 12,
    color: '#64748B',
    marginLeft: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPending: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  statusDelivered: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusTextPending: {
    color: '#F59E0B',
  },
  statusTextDelivered: {
    color: '#10B981',
  },
  customerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 'auto',
  },
  paymentText: {
    fontSize: 12,
    color: '#64748B',
    marginLeft: 4,
    textTransform: 'capitalize',
  },
  collectedAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
    marginRight: 8,
  },
  noRouteContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  noRouteIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  noRouteTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  noRouteSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 24,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#94A3B8',
    marginTop: 16,
    marginBottom: 16,
  },
  addCustomerButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addCustomerButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
  },
  saveButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
