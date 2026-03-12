import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../src/services/api';
import { LogoHeader } from '../src/components/LogoHeader';

interface SaleRecord {
  id: string;
  invoice_number: string;
  customer_name: string;
  total_amount: number;
  cash_collected: number;
  shortage_amount: number;
  payment_type: string;
  split_payments?: any[];
  created_at: string;
  items: any[];
  crates_dropped?: number;
  crates_collected?: number;
}

export default function InvoiceHistoryScreen() {
  const router = useRouter();
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadSales = async () => {
    try {
      const data = await api.getSales();
      // Sort by newest first
      const sorted = (data || []).sort((a: any, b: any) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      setSales(sorted);
    } catch (error) {
      console.error('Error loading sales:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadSales();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadSales();
  };

  const viewInvoice = (sale: SaleRecord) => {
    const vatAmount = 0; // We don't store VAT separately yet
    router.push({
      pathname: '/invoice-receipt',
      params: {
        invoiceNumber: sale.invoice_number || 'N/A',
        customerName: sale.customer_name,
        routeName: '',
        totalAmount: String(sale.total_amount || 0),
        cashReceived: String(sale.cash_collected || 0),
        shortageAmount: String(sale.shortage_amount || 0),
        vatAmount: String(vatAmount),
        cratesDropped: String(sale.crates_dropped || 0),
        cratesCollected: String(sale.crates_collected || 0),
        paymentType: sale.payment_type || 'cash',
        splitPayments: JSON.stringify(sale.split_payments || []),
        items: JSON.stringify(sale.items || []),
        date: new Date(sale.created_at).toLocaleDateString(),
        time: new Date(sale.created_at).toLocaleTimeString(),
      },
    });
  };

  const renderSaleItem = ({ item }: { item: SaleRecord }) => {
    const date = new Date(item.created_at);
    return (
      <TouchableOpacity style={styles.saleCard} onPress={() => viewInvoice(item)}>
        <View style={styles.saleHeader}>
          <View style={styles.invoiceBadge}>
            <Ionicons name="receipt-outline" size={16} color="#3B82F6" />
            <Text style={styles.invoiceNum}>{item.invoice_number || 'No Invoice #'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#64748B" />
        </View>
        <View style={styles.saleBody}>
          <View style={styles.saleRow}>
            <Text style={styles.customerName}>{item.customer_name}</Text>
            <Text style={styles.saleAmount}>R{(item.total_amount || 0).toFixed(2)}</Text>
          </View>
          <View style={styles.saleRow}>
            <Text style={styles.saleDate}>
              {date.toLocaleDateString()} • {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {(item.shortage_amount || 0) > 0 && (
              <Text style={styles.shortageTag}>
                Shortage: R{item.shortage_amount.toFixed(2)}
              </Text>
            )}
          </View>
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#94A3B8" />
        </TouchableOpacity>
        <LogoHeader size="small" showText={false} />
        <Text style={styles.headerTitle}>Invoice History</Text>
        <View style={{ width: 44 }} />
      </View>

      <FlatList
        data={sales}
        keyExtractor={(item) => item.id}
        renderItem={renderSaleItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color="#334155" />
            <Text style={styles.emptyText}>No invoices yet</Text>
            <Text style={styles.emptySubtext}>Sales invoices will appear here</Text>
          </View>
        }
      />
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
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    gap: 8,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  saleCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  saleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  invoiceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E3A5F',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  invoiceNum: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3B82F6',
  },
  saleBody: {},
  saleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  saleAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10B981',
  },
  saleDate: {
    fontSize: 13,
    color: '#94A3B8',
  },
  shortageTag: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#475569',
    marginTop: 4,
  },
});
