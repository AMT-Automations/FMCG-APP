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

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeRoute, setActiveRoute] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [activeRouteData, summaryData] = await Promise.all([
        api.getActiveDailyRoute(),
        api.getDailySummary(),
      ]);
      setActiveRoute(activeRouteData);
      setSummary(summaryData);
    } catch (error) {
      console.error('Error loading home data:', error);
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

  const formatCurrency = (amount: number) => {
    return `R ${amount.toFixed(2)}`;
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />
        }
      >
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

        {/* Active Route Card */}
        {activeRoute ? (
          <View style={styles.activeRouteCard}>
            <View style={styles.activeRouteHeader}>
              <View style={styles.activeIndicator}>
                <View style={styles.activeDot} />
                <Text style={styles.activeText}>ACTIVE ROUTE</Text>
              </View>
              <TouchableOpacity
                style={styles.endRouteButton}
                onPress={() => router.push('/end-route')}
              >
                <Text style={styles.endRouteText}>End Route</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.routeName}>{activeRoute.route_name}</Text>
            <View style={styles.routeStats}>
              <View style={styles.routeStat}>
                <Ionicons name="speedometer-outline" size={20} color="#94A3B8" />
                <Text style={styles.routeStatValue}>{activeRoute.opening_km} km</Text>
                <Text style={styles.routeStatLabel}>Start KM</Text>
              </View>
              <View style={styles.routeStat}>
                <Ionicons name="cube-outline" size={20} color="#94A3B8" />
                <Text style={styles.routeStatValue}>{activeRoute.crates_out}</Text>
                <Text style={styles.routeStatLabel}>Crates Out</Text>
              </View>
              <View style={styles.routeStat}>
                <Ionicons name="receipt-outline" size={20} color="#94A3B8" />
                <Text style={styles.routeStatValue}>{activeRoute.sales_count}</Text>
                <Text style={styles.routeStatLabel}>Sales</Text>
              </View>
              <View style={styles.routeStat}>
                <Ionicons name="cash-outline" size={20} color="#10B981" />
                <Text style={[styles.routeStatValue, { color: '#10B981' }]}>
                  {formatCurrency(activeRoute.total_collected)}
                </Text>
                <Text style={styles.routeStatLabel}>Collected</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.continueButton}
              onPress={() => router.push('/(tabs)/route')}
            >
              <Ionicons name="navigate" size={20} color="#FFFFFF" />
              <Text style={styles.continueButtonText}>Continue Route</Text>
            </TouchableOpacity>
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
              onPress={() => router.push('/(tabs)/route')}
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
  activeRouteCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  activeRouteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  activeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 8,
  },
  activeText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '600',
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
  routeName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  routeStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  routeStat: {
    alignItems: 'center',
  },
  routeStatValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 4,
  },
  routeStatLabel: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 14,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
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
    gap: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
});
