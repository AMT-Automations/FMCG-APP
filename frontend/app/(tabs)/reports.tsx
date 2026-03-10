import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ReportsScreen() {
  const [summary, setSummary] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const loadData = async () => {
    try {
      const [summaryData, historyData] = await Promise.all([
        api.getDailySummary(selectedDate),
        api.getDailyRouteHistory(),
      ]);
      setSummary(summaryData);
      setHistory(historyData);
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [selectedDate])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleExportExcel = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        Alert.alert('Error', 'Please login to download reports');
        return;
      }
      
      const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL || '';
      const url = `${baseUrl}/api/reports/export/excel?date_str=${selectedDate}`;
      
      if (Platform.OS === 'web') {
        // For web, create a link and trigger download
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `route_report_${selectedDate}.xlsx`);
        
        // Add auth header via fetch and blob
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const blob = await response.blob();
        const downloadUrl = URL.createObjectURL(blob);
        link.href = downloadUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);
      } else {
        // For mobile, open in browser or use sharing
        Alert.alert(
          'Export Report',
          'The Excel report will be downloaded to your device.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Download', 
              onPress: () => Linking.openURL(url)
            }
          ]
        );
      }
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Error', 'Failed to export report');
    }
  };

  const handleExportPDF = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        Alert.alert('Error', 'Please login to download reports');
        return;
      }
      
      const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL || '';
      const url = `${baseUrl}/api/reports/export/pdf?date_str=${selectedDate}`;
      
      if (Platform.OS === 'web') {
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const blob = await response.blob();
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.setAttribute('download', `sales_report_${selectedDate}.pdf`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);
      } else {
        Alert.alert(
          'Export PDF',
          'The PDF report will be downloaded to your device.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Download', 
              onPress: () => Linking.openURL(url)
            }
          ]
        );
      }
    } catch (error) {
      console.error('PDF Export error:', error);
      Alert.alert('Error', 'Failed to export PDF report');
    }
  };

  const formatCurrency = (amount: number) => {
    return `R ${amount.toFixed(2)}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-ZA', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Reports</Text>
          <Text style={styles.headerSubtitle}>{formatDate(selectedDate)}</Text>
        </View>
        <View style={styles.exportButtons}>
          <TouchableOpacity style={styles.exportButton} onPress={handleExportExcel}>
            <Ionicons name="document-text-outline" size={18} color="#FFFFFF" />
            <Text style={styles.exportButtonText}>Excel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.exportButton, styles.exportButtonPDF]} onPress={handleExportPDF}>
            <Ionicons name="document-outline" size={18} color="#FFFFFF" />
            <Text style={styles.exportButtonText}>PDF</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />
        }
      >
        {/* Overview Cards */}
        <View style={styles.overviewSection}>
          <View style={styles.overviewRow}>
            <View style={[styles.overviewCard, styles.overviewCardLarge]}>
              <View style={[styles.overviewIcon, { backgroundColor: '#1E3A5F' }]}>
                <Ionicons name="cash" size={24} color="#3B82F6" />
              </View>
              <Text style={styles.overviewValue}>
                {formatCurrency(summary?.total_collected || 0)}
              </Text>
              <Text style={styles.overviewLabel}>Total Collected</Text>
            </View>
            <View style={[styles.overviewCard, styles.overviewCardLarge]}>
              <View style={[styles.overviewIcon, { backgroundColor: '#1E3B35' }]}>
                <Ionicons name="trending-up" size={24} color="#10B981" />
              </View>
              <Text style={styles.overviewValue}>
                {formatCurrency(summary?.total_expected || 0)}
              </Text>
              <Text style={styles.overviewLabel}>Expected</Text>
            </View>
          </View>

          <View style={styles.overviewRow}>
            <View style={styles.overviewCard}>
              <Ionicons name="receipt" size={20} color="#F59E0B" />
              <Text style={styles.overviewValueSmall}>{summary?.total_sales || 0}</Text>
              <Text style={styles.overviewLabelSmall}>Sales</Text>
            </View>
            <View style={styles.overviewCard}>
              <Ionicons name="speedometer" size={20} color="#8B5CF6" />
              <Text style={styles.overviewValueSmall}>
                {summary?.total_km_traveled?.toFixed(1) || 0} km
              </Text>
              <Text style={styles.overviewLabelSmall}>Distance</Text>
            </View>
            <View style={styles.overviewCard}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <Text style={styles.overviewValueSmall}>
                {summary?.collection_rate?.toFixed(0) || 0}%
              </Text>
              <Text style={styles.overviewLabelSmall}>Rate</Text>
            </View>
          </View>
        </View>

        {/* Product Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Product Breakdown</Text>
          {summary?.product_breakdown && Object.keys(summary.product_breakdown).length > 0 ? (
            Object.entries(summary.product_breakdown).map(([product, data]: [string, any]) => (
              <View key={product} style={styles.productCard}>
                <View style={styles.productHeader}>
                  <Text style={styles.productName}>{product}</Text>
                  <Text style={styles.productRevenue}>
                    {formatCurrency(data.revenue || 0)}
                  </Text>
                </View>
                <View style={styles.productStats}>
                  <View style={styles.productStat}>
                    <Text style={styles.productStatValue}>{data.delivered || 0}</Text>
                    <Text style={styles.productStatLabel}>Delivered</Text>
                  </View>
                  <View style={styles.productStat}>
                    <Text style={styles.productStatValue}>{data.returned || 0}</Text>
                    <Text style={styles.productStatLabel}>Returned</Text>
                  </View>
                  <View style={styles.productStat}>
                    <Text style={[styles.productStatValue, data.damages > 0 && { color: '#EF4444' }]}>
                      {data.damages || 0}
                    </Text>
                    <Text style={styles.productStatLabel}>Damages</Text>
                  </View>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="cube-outline" size={32} color="#64748B" />
              <Text style={styles.emptyText}>No product data for today</Text>
            </View>
          )}
        </View>

        {/* Route History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Routes</Text>
          {history.length > 0 ? (
            history.slice(0, 5).map((route) => (
              <View key={route.id} style={styles.historyCard}>
                <View style={styles.historyHeader}>
                  <View>
                    <Text style={styles.historyRouteName}>{route.route_name}</Text>
                    <Text style={styles.historyDate}>{formatDate(route.date)}</Text>
                  </View>
                  <View
                    style={[
                      styles.historyStatus,
                      route.status === 'completed'
                        ? styles.historyStatusCompleted
                        : styles.historyStatusActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.historyStatusText,
                        route.status === 'completed'
                          ? styles.historyStatusTextCompleted
                          : styles.historyStatusTextActive,
                      ]}
                    >
                      {route.status === 'completed' ? 'Completed' : 'Active'}
                    </Text>
                  </View>
                </View>
                <View style={styles.historyStats}>
                  <View style={styles.historyStat}>
                    <Ionicons name="receipt-outline" size={14} color="#64748B" />
                    <Text style={styles.historyStatText}>{route.sales_count} sales</Text>
                  </View>
                  <View style={styles.historyStat}>
                    <Ionicons name="cash-outline" size={14} color="#10B981" />
                    <Text style={[styles.historyStatText, { color: '#10B981' }]}>
                      {formatCurrency(route.total_collected)}
                    </Text>
                  </View>
                  {route.total_shortage > 0 && (
                    <View style={styles.historyStat}>
                      <Ionicons name="warning-outline" size={14} color="#F59E0B" />
                      <Text style={[styles.historyStatText, { color: '#F59E0B' }]}>
                        -{formatCurrency(route.total_shortage)}
                      </Text>
                    </View>
                  )}
                  {route.km_traveled && (
                    <View style={styles.historyStat}>
                      <Ionicons name="speedometer-outline" size={14} color="#64748B" />
                      <Text style={styles.historyStatText}>
                        {route.km_traveled.toFixed(1)} km
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="time-outline" size={32} color="#64748B" />
              <Text style={styles.emptyText}>No route history yet</Text>
            </View>
          )}
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
  },
  exportButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  exportButtonPDF: {
    backgroundColor: '#EF4444',
  },
  exportButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  overviewSection: {
    marginBottom: 24,
  },
  overviewRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  overviewCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  overviewCardLarge: {
    padding: 20,
  },
  overviewIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  overviewValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  overviewLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  overviewValueSmall: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 8,
  },
  overviewLabelSmall: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  productCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  productRevenue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10B981',
  },
  productStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  productStat: {
    alignItems: 'center',
  },
  productStatValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  productStatLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  historyCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  historyRouteName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  historyDate: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  historyStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  historyStatusCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  historyStatusActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  historyStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  historyStatusTextCompleted: {
    color: '#10B981',
  },
  historyStatusTextActive: {
    color: '#3B82F6',
  },
  historyStats: {
    flexDirection: 'row',
    gap: 16,
  },
  historyStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  historyStatText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  emptyCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 12,
  },
});
