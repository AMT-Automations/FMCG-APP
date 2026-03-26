import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/services/api';
import { LogoHeader } from '../../src/components/LogoHeader';

export default function HomeScreen() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [activeRoutes, setActiveRoutes] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [vehicleStock, setVehicleStock] = useState<any>(null);
  const [showAllStock, setShowAllStock] = useState(false);

  const loadData = async () => {
    try {
      const [activeRoutesData, summaryData] = await Promise.all([
        api.getActiveDailyRoutes(),
        api.getDailySummary(),
      ]);
      setActiveRoutes(activeRoutesData || []);
      setSummary(summaryData);
      
      // Load vehicle stock for drivers
      if (user?.role === 'driver' || user?.role === 'admin' || user?.role === 'manager') {
        try {
          const vs = await api.getMyVehicleStock();
          setVehicleStock(vs);
        } catch (e) {
          setVehicleStock(null);
        }
      }
    } catch (error) {
      console.error('Error loading home data:', error);
      setActiveRoutes([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (!authLoading && user) {
        loadData();
      }
    }, [authLoading, user])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const formatCurrency = (amount: number) => {
    return `R ${amount.toFixed(2)}`;
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const handleSelectRoute = (route: any) => {
    // Navigate to route tab with selected route
    router.push({
      pathname: '/(tabs)/route',
      params: { selectedRouteId: route.id, routeId: route.route_id }
    });
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

  const totalSales = activeRoutes.reduce((sum, r) => sum + (r.sales_count || 0), 0);
  const totalCollected = activeRoutes.reduce((sum, r) => sum + (r.total_collected || 0), 0);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />
        }
      >
        {/* Logo Header */}
        <View style={styles.logoRow}>
          <LogoHeader size="small" />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.userName}>{user?.name || 'Driver'}</Text>
          </View>
          <View style={styles.roleTag}>
            <Text style={styles.roleText}>{user?.role?.toUpperCase()}</Text>
          </View>
        </View>

        {/* Active Routes Section */}
        {activeRoutes.length > 0 ? (
          <View style={styles.activeRoutesSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Active Routes ({activeRoutes.length})</Text>
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            </View>

            {activeRoutes.map((route, index) => (
              <TouchableOpacity
                key={route.id}
                style={styles.activeRouteCard}
                onPress={() => handleSelectRoute(route)}
              >
                <View style={styles.routeHeader}>
                  <View style={styles.routeIndex}>
                    <Text style={styles.routeIndexText}>{index + 1}</Text>
                  </View>
                  <View style={styles.routeInfo}>
                    <Text style={styles.routeName}>{route.route_name}</Text>
                    <Text style={styles.routeDriver}>
                      {route.driver_name}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.endRouteButton}
                    onPress={() => router.push({ pathname: '/end-route', params: { routeId: route.id } })}
                  >
                    <Text style={styles.endRouteText}>End</Text>
                  </TouchableOpacity>
                </View>

                {/* Vehicle Info */}
                {route.vehicle_name && (
                  <View style={styles.vehicleInfo}>
                    <Ionicons name="car" size={16} color="#3B82F6" />
                    <Text style={styles.vehicleInfoText}>
                      {route.vehicle_name} • {route.vehicle_registration}
                    </Text>
                  </View>
                )}

                <View style={styles.routeStats}>
                  <View style={styles.routeStat}>
                    <Ionicons name="speedometer-outline" size={16} color="#94A3B8" />
                    <Text style={styles.routeStatValue}>{route.opening_km} km</Text>
                  </View>
                  <View style={styles.routeStat}>
                    <Ionicons name="cube-outline" size={16} color="#94A3B8" />
                    <Text style={styles.routeStatValue}>{route.crates_out} crates</Text>
                  </View>
                  <View style={styles.routeStat}>
                    <Ionicons name="receipt-outline" size={16} color="#94A3B8" />
                    <Text style={styles.routeStatValue}>{route.sales_count} sales</Text>
                  </View>
                  <View style={styles.routeStat}>
                    <Ionicons name="cash-outline" size={16} color="#10B981" />
                    <Text style={[styles.routeStatValue, { color: '#10B981' }]}>
                      {formatCurrency(route.total_collected)}
                    </Text>
                  </View>
                </View>

                <View style={styles.routeActions}>
                  <TouchableOpacity
                    style={styles.continueButton}
                    onPress={() => handleSelectRoute(route)}
                  >
                    <Ionicons name="navigate" size={18} color="#FFFFFF" />
                    <Text style={styles.continueButtonText}>Continue Route</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.deliveriesButton}
                    onPress={() => router.push({ pathname: '/route-deliveries', params: { dailyRouteId: route.id } })}
                  >
                    <Ionicons name="cube-outline" size={18} color="#F97316" />
                    <Text style={styles.deliveriesButtonText}>Deliveries</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}

            {/* Combined Stats for All Active Routes */}
            {activeRoutes.length > 1 && (
              <View style={styles.combinedStats}>
                <Text style={styles.combinedStatsTitle}>All Routes Combined</Text>
                <View style={styles.combinedStatsRow}>
                  <View style={styles.combinedStat}>
                    <Text style={styles.combinedStatValue}>{totalSales}</Text>
                    <Text style={styles.combinedStatLabel}>Total Sales</Text>
                  </View>
                  <View style={styles.combinedStat}>
                    <Text style={[styles.combinedStatValue, { color: '#10B981' }]}>
                      {formatCurrency(totalCollected)}
                    </Text>
                    <Text style={styles.combinedStatLabel}>Total Collected</Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        ) : (
          <TouchableOpacity
            style={styles.startRouteCard}
            onPress={() => router.push('/start-route')}
          >
            <View style={styles.startRouteIcon}>
              <Ionicons name="play-circle" size={48} color="#3B82F6" />
            </View>
            <Text style={styles.startRouteTitle}>Start Your Route</Text>
            <Text style={styles.startRouteSubtitle}>
              Begin today's deliveries by starting a route
            </Text>
            <View style={styles.startRouteButton}>
              <Ionicons name="add" size={20} color="#FFFFFF" />
              <Text style={styles.startRouteButtonText}>Start Route</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Add Another Route Button */}
        {activeRoutes.length > 0 && (
          <TouchableOpacity
            style={styles.addRouteButton}
            onPress={() => router.push('/start-route')}
          >
            <Ionicons name="add-circle-outline" size={24} color="#3B82F6" />
            <Text style={styles.addRouteText}>Start Another Route</Text>
          </TouchableOpacity>
        )}

        {/* Vehicle Stock Section - Compact: summary + preview + expand */}
        {vehicleStock && vehicleStock.items && vehicleStock.items.length > 0 && (
          <View style={styles.vehicleStockSection}>
            <TouchableOpacity
              style={styles.vsHeaderRow}
              onPress={() => setShowAllStock(!showAllStock)}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <Ionicons name="cube" size={18} color="#10B981" />
                <Text style={styles.sectionTitle}>My Vehicle Stock</Text>
                <View style={styles.vehicleStockBadge}>
                  <Text style={styles.vehicleStockBadgeText}>
                    {vehicleStock.vehicle_name || 'Vehicle'}
                  </Text>
                </View>
              </View>
              <View style={styles.vsCompactStats}>
                <Text style={styles.vsCompactLoaded}>{vehicleStock.total_loaded} loaded</Text>
                <Text style={styles.vsCompactSep}>•</Text>
                <Text style={styles.vsCompactRemaining}>{vehicleStock.total_remaining} left</Text>
                <Ionicons
                  name={showAllStock ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color="#64748B"
                  style={{ marginLeft: 4 }}
                />
              </View>
            </TouchableOpacity>

            {showAllStock && (
              <View style={styles.vsExpandedList}>
                {vehicleStock.items.map((item: any, idx: number) => (
                  <View key={idx} style={styles.vsItemCard}>
                    <Text style={styles.vsItemName} numberOfLines={1}>{item.product_name}</Text>
                    <View style={styles.vsItemStats}>
                      <Text style={styles.vsItemLoaded}>{item.quantity_loaded}</Text>
                      <Ionicons name="arrow-forward" size={12} color="#475569" />
                      <Text style={styles.vsItemRemaining}>{item.quantity_remaining}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
        {vehicleStock && (!vehicleStock.items || vehicleStock.items.length === 0) && activeRoutes.length > 0 && (
          <View style={styles.noStockBanner}>
            <Ionicons name="alert-circle-outline" size={20} color="#F59E0B" />
            <Text style={styles.noStockText}>
              No stock loaded on your vehicle yet. Contact admin to dispatch stock.
            </Text>
          </View>
        )}

        {/* Today's Summary */}
        <View style={styles.summarySection}>
          <Text style={styles.sectionTitle}>Today's Summary</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}>
              <Ionicons name="receipt" size={24} color="#3B82F6" />
              <Text style={styles.summaryValue}>{summary?.total_sales || 0}</Text>
              <Text style={styles.summaryLabel}>Sales</Text>
            </View>
            <View style={styles.summaryCard}>
              <Ionicons name="cash" size={24} color="#10B981" />
              <Text style={styles.summaryValue}>
                {formatCurrency(summary?.total_collected || 0)}
              </Text>
              <Text style={styles.summaryLabel}>Collected</Text>
            </View>
            <View style={styles.summaryCard}>
              <Ionicons name="speedometer" size={24} color="#F59E0B" />
              <Text style={styles.summaryValue}>
                {summary?.total_km_traveled?.toFixed(1) || 0} km
              </Text>
              <Text style={styles.summaryLabel}>Traveled</Text>
            </View>
            <View style={styles.summaryCard}>
              <Ionicons name="checkmark-circle" size={24} color="#8B5CF6" />
              <Text style={styles.summaryValue}>
                {summary?.collection_rate?.toFixed(0) || 0}%
              </Text>
              <Text style={styles.summaryLabel}>Collection Rate</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/admin')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#1E3A5F' }]}>
                <Ionicons name="people" size={24} color="#3B82F6" />
              </View>
              <Text style={styles.actionText}>Customers</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/(tabs)/reports')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#1E3B35' }]}>
                <Ionicons name="stats-chart" size={24} color="#10B981" />
              </View>
              <Text style={styles.actionText}>Reports</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/invoice-history')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#2E1E3B' }]}>
                <Ionicons name="receipt" size={24} color="#A855F7" />
              </View>
              <Text style={styles.actionText}>Invoices</Text>
            </TouchableOpacity>
            {(user?.role === 'admin' || user?.role === 'manager') && (
              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => router.push('/stock')}
              >
                <View style={[styles.actionIcon, { backgroundColor: '#1E3A3B' }]}>
                  <Ionicons name="cube" size={24} color="#06B6D4" />
                </View>
                <Text style={styles.actionText}>Stock</Text>
              </TouchableOpacity>
            )}
            {(user?.role === 'admin' || user?.role === 'manager') && (
              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => router.push('/orders-management')}
              >
                <View style={[styles.actionIcon, { backgroundColor: '#1E2E3B' }]}>
                  <Ionicons name="cart" size={24} color="#F97316" />
                </View>
                <Text style={styles.actionText}>Orders</Text>
              </TouchableOpacity>
            )}
            {(user?.role === 'admin' || user?.role === 'manager') && (
              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => router.push('/vehicle-dispatch')}
              >
                <View style={[styles.actionIcon, { backgroundColor: '#1E3B2E' }]}>
                  <Ionicons name="bus" size={24} color="#22C55E" />
                </View>
                <Text style={styles.actionText}>Dispatch</Text>
              </TouchableOpacity>
            )}
            {user?.role === 'admin' && (
              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => router.push('/database-admin')}
              >
                <View style={[styles.actionIcon, { backgroundColor: '#1E1E3B' }]}>
                  <Ionicons name="server" size={24} color="#A78BFA" />
                </View>
                <Text style={styles.actionText}>Database</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/(tabs)/profile')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#3B2E1E' }]}>
                <Ionicons name="settings" size={24} color="#F59E0B" />
              </View>
              <Text style={styles.actionText}>Settings</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  logoRow: {
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: {
    fontSize: 14,
    color: '#94A3B8',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  roleTag: {
    backgroundColor: '#1E3A5F',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  roleText: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: '600',
  },
  activeRoutesSection: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  liveText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
  },
  activeRouteCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  routeIndex: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeIndexText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  routeInfo: {
    flex: 1,
    marginLeft: 12,
  },
  routeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  routeDriver: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  vehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  vehicleInfoText: {
    fontSize: 13,
    color: '#3B82F6',
    fontWeight: '500',
  },
  endRouteButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  endRouteText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
  },
  routeStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  routeStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  routeStatValue: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    paddingVertical: 12,
    gap: 8,
    flex: 1,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  routeActions: {
    flexDirection: 'row',
    gap: 10,
  },
  deliveriesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: '#F97316',
  },
  deliveriesButtonText: {
    color: '#F97316',
    fontSize: 14,
    fontWeight: '600',
  },
  combinedStats: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginTop: 4,
  },
  combinedStatsTitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 12,
    textAlign: 'center',
  },
  combinedStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  combinedStat: {
    alignItems: 'center',
  },
  combinedStatValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  combinedStatLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  addRouteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 1,
    borderColor: '#3B82F6',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
    gap: 8,
  },
  addRouteText: {
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: '600',
  },
  startRouteCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
    borderStyle: 'dashed',
  },
  startRouteIcon: {
    marginBottom: 16,
  },
  startRouteTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  startRouteSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 20,
  },
  startRouteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  startRouteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  summarySection: {
    marginBottom: 24,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  summaryCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  actionsSection: {
    marginBottom: 24,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  actionCard: {
    width: '29%',
    flexGrow: 1,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    minWidth: 100,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
    textAlign: 'center',
  },
  // Vehicle Stock styles - compact collapsible
  vehicleStockSection: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#1E293B',
    borderRadius: 14,
    overflow: 'hidden',
  },
  vsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  vehicleStockBadge: {
    backgroundColor: '#064E3B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  vehicleStockBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10B981',
  },
  vsCompactStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  vsCompactLoaded: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  vsCompactSep: {
    fontSize: 12,
    color: '#475569',
  },
  vsCompactRemaining: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '700',
  },
  vsExpandedList: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  vsItemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#0F172A',
  },
  vsItemName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#CBD5E1',
    flex: 1,
    marginRight: 8,
  },
  vsItemStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  vsItemLoaded: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  vsItemRemaining: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F59E0B',
  },
  noStockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  noStockText: {
    fontSize: 13,
    color: '#F59E0B',
    flex: 1,
  },
});
