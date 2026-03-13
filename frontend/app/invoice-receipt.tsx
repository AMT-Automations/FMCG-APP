import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Share,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LogoHeader } from '../src/components/LogoHeader';

export default function InvoiceReceiptScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const invoiceNumber = (params.invoiceNumber as string) || 'N/A';
  const customerName = (params.customerName as string) || 'Customer';
  const routeName = (params.routeName as string) || '';
  const totalAmount = parseFloat((params.totalAmount as string) || '0');
  const cashReceived = parseFloat((params.cashReceived as string) || '0');
  const shortageAmount = parseFloat((params.shortageAmount as string) || '0');
  const vatAmount = parseFloat((params.vatAmount as string) || '0');
  const cratesDropped = parseInt((params.cratesDropped as string) || '0');
  const cratesCollected = parseInt((params.cratesCollected as string) || '0');
  const paymentType = (params.paymentType as string) || 'cash';
  const splitPaymentsStr = (params.splitPayments as string) || '[]';
  const itemsStr = (params.items as string) || '[]';
  const dateStr = (params.date as string) || new Date().toLocaleDateString();
  const timeStr = (params.time as string) || new Date().toLocaleTimeString();

  let splitPayments: any[] = [];
  let saleItems: any[] = [];
  try {
    splitPayments = JSON.parse(splitPaymentsStr);
    saleItems = JSON.parse(itemsStr);
  } catch (e) {}

  const PAYMENT_METHODS: Record<string, string> = {
    cash: 'Cash',
    eft: 'EFT',
    shop2shop: 'Shop2Shop',
    kazang: 'Kazang',
  };

  const handleShare = async () => {
    let text = `INVOICE: ${invoiceNumber}\n`;
    text += `Date: ${dateStr} ${timeStr}\n`;
    text += `Customer: ${customerName}\n`;
    text += `Route: ${routeName}\n\n`;
    text += `--- Items ---\n`;
    saleItems.forEach((item: any) => {
      const net = (item.quantity_delivered || 0) - (item.quantity_returned || 0);
      text += `${item.product_name}: ${net} x R${item.unit_price?.toFixed(2)} = R${(net * item.unit_price).toFixed(2)}\n`;
    });
    text += `\n--- Totals ---\n`;
    if (vatAmount > 0) {
      text += `VAT (15%): R${vatAmount.toFixed(2)}\n`;
    }
    text += `Total: R${totalAmount.toFixed(2)}\n`;
    text += `Received: R${cashReceived.toFixed(2)}\n`;
    if (shortageAmount > 0) {
      text += `Shortage: R${shortageAmount.toFixed(2)}\n`;
    }
    text += `\nMzansi FMCG Tracker`;

    try {
      await Share.share({ message: text, title: `Invoice ${invoiceNumber}` });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerBar}>
        <LogoHeader size="small" showText={false} />
        <Text style={styles.headerTitle}>Invoice Receipt</Text>
        <TouchableOpacity onPress={handleShare} style={styles.shareButton}>
          <Ionicons name="share-outline" size={24} color="#3B82F6" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Success Banner */}
        <View style={styles.successBanner}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={48} color="#10B981" />
          </View>
          <Text style={styles.successTitle}>Sale Recorded!</Text>
        </View>

        {/* Invoice Number Card */}
        <View style={styles.invoiceCard}>
          <Text style={styles.invoiceLabel}>INVOICE NUMBER</Text>
          <Text style={styles.invoiceNumber}>{invoiceNumber}</Text>
          <View style={styles.invoiceMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={14} color="#94A3B8" />
              <Text style={styles.metaText}>{dateStr}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={14} color="#94A3B8" />
              <Text style={styles.metaText}>{timeStr}</Text>
            </View>
          </View>
        </View>

        {/* Customer Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer</Text>
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={18} color="#94A3B8" />
            <Text style={styles.infoText}>{customerName}</Text>
          </View>
          {routeName ? (
            <View style={styles.infoRow}>
              <Ionicons name="map-outline" size={18} color="#94A3B8" />
              <Text style={styles.infoText}>{routeName}</Text>
            </View>
          ) : null}
        </View>

        {/* Items */}
        {saleItems.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Items</Text>
            {saleItems.map((item: any, idx: number) => {
              const net = (item.quantity_delivered || 0) - (item.quantity_returned || 0);
              return (
                <View key={idx} style={styles.itemRow}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.product_name}</Text>
                    <Text style={styles.itemQty}>
                      {net} × R{item.unit_price?.toFixed(2)}
                    </Text>
                  </View>
                  <Text style={styles.itemTotal}>R{(net * (item.unit_price || 0)).toFixed(2)}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Totals */}
        <View style={styles.totalsCard}>
          {vatAmount > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>VAT (15%)</Text>
              <Text style={styles.totalLabelValue}>R{vatAmount.toFixed(2)}</Text>
            </View>
          )}
          <View style={[styles.totalRow, styles.totalRowMain]}>
            <Text style={styles.totalMainLabel}>Invoice Total</Text>
            <Text style={styles.totalMainValue}>R{totalAmount.toFixed(2)}</Text>
          </View>

          {/* Payment */}
          {paymentType === 'split' && splitPayments.length > 0 ? (
            <>
              <View style={styles.divider} />
              <Text style={styles.paymentTitle}>Payment Breakdown</Text>
              {splitPayments.map((sp: any, idx: number) => (
                <View key={idx} style={styles.totalRow}>
                  <Text style={styles.totalLabel}>
                    {PAYMENT_METHODS[sp.method] || sp.method}
                  </Text>
                  <Text style={styles.paymentValue}>R{parseFloat(sp.amount || '0').toFixed(2)}</Text>
                </View>
              ))}
            </>
          ) : (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                Paid ({PAYMENT_METHODS[paymentType] || paymentType})
              </Text>
              <Text style={styles.paymentValue}>R{cashReceived.toFixed(2)}</Text>
            </View>
          )}

          {shortageAmount > 0 && (
            <View style={[styles.totalRow, styles.shortageRow]}>
              <Text style={styles.shortageLabel}>Shortage</Text>
              <Text style={styles.shortageValue}>R{shortageAmount.toFixed(2)}</Text>
            </View>
          )}
        </View>

        {/* Crates */}
        {(cratesDropped > 0 || cratesCollected > 0) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Crate Tracking</Text>
            <View style={styles.cratesRow}>
              <View style={styles.crateItem}>
                <Text style={styles.crateValue}>{cratesDropped}</Text>
                <Text style={styles.crateLabel}>Dropped</Text>
              </View>
              <View style={styles.crateItem}>
                <Text style={styles.crateValue}>{cratesCollected}</Text>
                <Text style={styles.crateLabel}>Collected</Text>
              </View>
              <View style={styles.crateItem}>
                <Text style={[styles.crateValue, { color: '#F59E0B' }]}>
                  {cratesDropped - cratesCollected}
                </Text>
                <Text style={styles.crateLabel}>Net</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.doneButton}
          onPress={() => router.back()}
        >
          <Ionicons name="checkmark" size={20} color="#FFFFFF" />
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },
  shareButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  successBanner: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  successIcon: {
    marginBottom: 8,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#10B981',
  },
  invoiceCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  invoiceLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 8,
  },
  invoiceNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: '#3B82F6',
    letterSpacing: 1,
    marginBottom: 12,
  },
  invoiceMeta: {
    flexDirection: 'row',
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  section: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  itemQty: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  itemTotal: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  totalsCard: {
    backgroundColor: '#1E3A5F',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  totalRowMain: {
    paddingVertical: 10,
  },
  totalLabel: {
    fontSize: 14,
    color: '#94A3B8',
  },
  totalLabelValue: {
    fontSize: 14,
    color: '#94A3B8',
  },
  totalMainLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  totalMainValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#10B981',
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 10,
  },
  paymentTitle: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  paymentValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  shortageRow: {
    backgroundColor: '#422006',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  shortageLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F59E0B',
  },
  shortageValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F59E0B',
  },
  cratesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  crateItem: {
    alignItems: 'center',
    minWidth: 80,
  },
  crateValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  crateLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  doneButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
