import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/services/api';

interface Product {
  id: string;
  name: string;
  category: string;
  unit_type: string;
  price: number;
  vat_applicable: boolean;
}

interface SaleItem {
  product_id: string;
  product_name: string;
  quantity_delivered: number;
  quantity_returned: number;
  damages: number;
  unit_price: number;
  vat_applicable: boolean;
}

interface SplitPayment {
  method: string;
  amount: string;
  reference: string;
}

const PAYMENT_METHODS = [
  { id: 'cash', name: 'Cash', icon: 'cash-outline' },
  { id: 'eft', name: 'EFT', icon: 'card-outline' },
  { id: 'shop2shop', name: 'Shop2Shop', icon: 'storefront-outline' },
  { id: 'kazang', name: 'Kazang', icon: 'phone-portrait-outline' },
];

const VAT_RATE = 0.15; // 15% VAT in South Africa

export default function SalesEntryScreen() {
  const router = useRouter();
  const { customerId, name } = useLocalSearchParams<{ customerId: string; name: string }>();
  const [products, setProducts] = useState<Product[]>([]);
  const [activeRoute, setActiveRoute] = useState<any>(null);
  const [items, setItems] = useState<{ [key: string]: SaleItem }>({});
  const [cratesDropped, setCratesDropped] = useState('');
  const [cratesCollected, setCratesCollected] = useState('');
  const [cashCollected, setCashCollected] = useState('');
  const [paymentType, setPaymentType] = useState('cash');
  const [splitPayments, setSplitPayments] = useState<SplitPayment[]>([]);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const customerName = name ? decodeURIComponent(name) : 'Customer';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [productsData, routeData] = await Promise.all([
        api.getProducts(),
        api.getActiveDailyRoute(),
      ]);
      
      // Try to get customer-specific prices
      let customerPrices: Record<string, number> = {};
      if (customerId) {
        try {
          const priceData = await api.getCustomerPrices(customerId);
          if (priceData && priceData.price_list) {
            priceData.price_list.forEach((item: any) => {
              if (item.custom_price !== null) {
                customerPrices[item.product_id] = item.effective_price;
              }
            });
          }
        } catch (e) {
          console.log('Using default prices');
        }
      }
      
      // Apply customer-specific prices and preserve vat_applicable
      const productsWithPrices = productsData.map((product: any) => ({
        ...product,
        price: customerPrices[product.id] || product.price,
        vat_applicable: product.vat_applicable !== false, // default to true if not set
      }));
      
      setProducts(productsWithPrices);
      setActiveRoute(routeData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateItem = (product: Product, field: keyof SaleItem, value: number) => {
    setItems((prev) => {
      const existing = prev[product.id] || {
        product_id: product.id,
        product_name: product.name,
        quantity_delivered: 0,
        quantity_returned: 0,
        damages: 0,
        unit_price: product.price,
        vat_applicable: product.vat_applicable,
      };
      return {
        ...prev,
        [product.id]: {
          ...existing,
          [field]: value,
        },
      };
    });
  };

  // Calculate subtotal (sum of all item line totals)
  const calculateSubtotal = () => {
    return Object.values(items).reduce((sum, item) => {
      const net = item.quantity_delivered - item.quantity_returned;
      return sum + net * item.unit_price;
    }, 0);
  };

  // Calculate VAT amount (only from VAT-applicable products)
  // Prices are VAT-inclusive, so we extract the VAT component
  const calculateVatAmount = () => {
    return Object.values(items).reduce((sum, item) => {
      if (!item.vat_applicable) return sum;
      const net = item.quantity_delivered - item.quantity_returned;
      const lineTotal = net * item.unit_price;
      // Extract VAT from inclusive price: VAT = price - (price / 1.15)
      const vatPortion = lineTotal - (lineTotal / (1 + VAT_RATE));
      return sum + vatPortion;
    }, 0);
  };

  // Final total is the same as subtotal since prices are VAT-inclusive
  const calculateFinalTotal = () => {
    return calculateSubtotal();
  };

  const handleSave = async () => {
    const saleItems = Object.values(items).filter(
      (item) => item.quantity_delivered > 0 || item.quantity_returned > 0 || item.damages > 0
    );

    if (saleItems.length === 0) {
      Alert.alert('Error', 'Please add at least one product');
      return;
    }

    const finalTotal = calculateFinalTotal();
    const cashAmount = parseFloat(cashCollected || '0');

    if (cashAmount <= 0 && paymentType !== 'split') {
      Alert.alert('Error', 'Please enter payment amount');
      return;
    }

    if (!activeRoute) {
      Alert.alert('Error', 'No active route found');
      return;
    }

    setSaving(true);
    try {
      // Prepare split payments data
      const splitPaymentsData = paymentType === 'split' && splitPayments.length > 0
        ? splitPayments.map(sp => ({
            method: sp.method,
            amount: parseFloat(sp.amount),
            reference: sp.reference || ''
          }))
        : undefined;

      const result = await api.createSale({
        route_id: activeRoute.route_id,
        customer_id: customerId || '',
        customer_name: customerName,
        items: saleItems.map(item => ({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity_delivered: item.quantity_delivered,
          quantity_returned: item.quantity_returned,
          damages: item.damages,
          unit_price: item.unit_price,
        })),
        crates_dropped: parseInt(cratesDropped) || 0,
        crates_collected: parseInt(cratesCollected) || 0,
        cash_collected: cashAmount,
        payment_type: paymentType,
        split_payments: splitPaymentsData,
        notes: notes || undefined,
      });
      
      // Navigate to receipt screen with full details
      router.replace({
        pathname: '/invoice-receipt',
        params: {
          invoiceNumber: result.invoice_number || 'N/A',
          customerName: customerName,
          routeName: activeRoute.route_name || '',
          totalAmount: String(result.total_amount || finalTotal),
          cashReceived: String(cashAmount),
          shortageAmount: String(result.shortage_amount || Math.max(0, finalTotal - cashAmount)),
          vatAmount: String(calculateVatAmount()),
          cratesDropped: cratesDropped || '0',
          cratesCollected: cratesCollected || '0',
          paymentType: paymentType,
          splitPayments: JSON.stringify(splitPayments.filter(sp => parseFloat(sp.amount || '0') > 0)),
          items: JSON.stringify(saleItems),
          date: new Date().toLocaleDateString(),
          time: new Date().toLocaleTimeString(),
        },
      });
    } catch (error: any) {
      console.error('Sale error:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to record sale');
    } finally {
      setSaving(false);
    }
  };

  const groupedProducts = products.reduce((acc: { [key: string]: Product[] }, product) => {
    if (!acc[product.category]) {
      acc[product.category] = [];
    }
    acc[product.category].push(product);
    return acc;
  }, {});

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </SafeAreaView>
    );
  }

  const subtotal = calculateSubtotal();
  const vatAmount = calculateVatAmount();
  const finalTotal = calculateFinalTotal();

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#94A3B8" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>{customerName}</Text>
            <Text style={styles.headerSubtitle}>Record Sale</Text>
          </View>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Products */}
          {Object.entries(groupedProducts).map(([category, categoryProducts]) => (
            <View key={category} style={styles.categorySection}>
              <Text style={styles.categoryTitle}>{category}</Text>
              {categoryProducts.map((product) => {
                const item = items[product.id];
                return (
                  <View key={product.id} style={styles.productCard}>
                    <View style={styles.productHeader}>
                      <View style={styles.productHeaderLeft}>
                        <Text style={styles.productName}>{product.name}</Text>
                        <View style={styles.productMeta}>
                          <Text style={styles.productPrice}>
                            R{product.price.toFixed(2)} / {product.unit_type}
                          </Text>
                          {product.vat_applicable && (
                            <View style={styles.vatBadge}>
                              <Text style={styles.vatBadgeText}>VAT incl.</Text>
                            </View>
                          )}
                          {!product.vat_applicable && (
                            <View style={styles.vatExemptBadge}>
                              <Text style={styles.vatExemptBadgeText}>No VAT</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>

                    <View style={styles.productInputs}>
                      <View style={styles.inputRow}>
                        <Text style={styles.inputLabel}>Delivered</Text>
                        <View style={styles.quantityControl}>
                          <TouchableOpacity
                            style={styles.quantityButton}
                            onPress={() =>
                              updateItem(product, 'quantity_delivered',
                                Math.max(0, (item?.quantity_delivered || 0) - 1))
                            }
                          >
                            <Ionicons name="remove" size={18} color="#FFFFFF" />
                          </TouchableOpacity>
                          <TextInput
                            style={styles.quantityInput}
                            value={String(item?.quantity_delivered || 0)}
                            onChangeText={(text) =>
                              updateItem(product, 'quantity_delivered', parseInt(text) || 0)
                            }
                            keyboardType="numeric"
                          />
                          <TouchableOpacity
                            style={[styles.quantityButton, styles.quantityButtonAdd]}
                            onPress={() =>
                              updateItem(product, 'quantity_delivered',
                                (item?.quantity_delivered || 0) + 1)
                            }
                          >
                            <Ionicons name="add" size={18} color="#FFFFFF" />
                          </TouchableOpacity>
                        </View>
                      </View>

                      <View style={styles.inputRow}>
                        <Text style={styles.inputLabel}>Returned</Text>
                        <View style={styles.quantityControl}>
                          <TouchableOpacity
                            style={styles.quantityButton}
                            onPress={() =>
                              updateItem(product, 'quantity_returned',
                                Math.max(0, (item?.quantity_returned || 0) - 1))
                            }
                          >
                            <Ionicons name="remove" size={18} color="#FFFFFF" />
                          </TouchableOpacity>
                          <TextInput
                            style={styles.quantityInput}
                            value={String(item?.quantity_returned || 0)}
                            onChangeText={(text) =>
                              updateItem(product, 'quantity_returned', parseInt(text) || 0)
                            }
                            keyboardType="numeric"
                          />
                          <TouchableOpacity
                            style={[styles.quantityButton, styles.quantityButtonAdd]}
                            onPress={() =>
                              updateItem(product, 'quantity_returned',
                                (item?.quantity_returned || 0) + 1)
                            }
                          >
                            <Ionicons name="add" size={18} color="#FFFFFF" />
                          </TouchableOpacity>
                        </View>
                      </View>

                      <View style={styles.inputRow}>
                        <Text style={[styles.inputLabel, { color: '#EF4444' }]}>Damages</Text>
                        <View style={styles.quantityControl}>
                          <TouchableOpacity
                            style={styles.quantityButton}
                            onPress={() =>
                              updateItem(product, 'damages',
                                Math.max(0, (item?.damages || 0) - 1))
                            }
                          >
                            <Ionicons name="remove" size={18} color="#FFFFFF" />
                          </TouchableOpacity>
                          <TextInput
                            style={styles.quantityInput}
                            value={String(item?.damages || 0)}
                            onChangeText={(text) =>
                              updateItem(product, 'damages', parseInt(text) || 0)
                            }
                            keyboardType="numeric"
                          />
                          <TouchableOpacity
                            style={[styles.quantityButton, styles.quantityButtonAdd]}
                            onPress={() =>
                              updateItem(product, 'damages', (item?.damages || 0) + 1)
                            }
                          >
                            <Ionicons name="add" size={18} color="#FFFFFF" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          ))}

          {/* Crates Section */}
          <View style={styles.cratesSection}>
            <Text style={styles.sectionTitle}>Crate Tracking</Text>
            <View style={styles.cratesRow}>
              <View style={styles.cratesInputGroup}>
                <Text style={styles.cratesLabel}>Crates Dropped Off</Text>
                <View style={styles.cratesInputContainer}>
                  <Ionicons name="cube-outline" size={20} color="#10B981" />
                  <TextInput
                    style={styles.cratesInput}
                    placeholder="0"
                    placeholderTextColor="#64748B"
                    value={cratesDropped}
                    onChangeText={setCratesDropped}
                    keyboardType="numeric"
                  />
                </View>
              </View>
              <View style={styles.cratesInputGroup}>
                <Text style={styles.cratesLabel}>Crates Collected</Text>
                <View style={styles.cratesInputContainer}>
                  <Ionicons name="cube" size={20} color="#3B82F6" />
                  <TextInput
                    style={styles.cratesInput}
                    placeholder="0"
                    placeholderTextColor="#64748B"
                    value={cratesCollected}
                    onChangeText={setCratesCollected}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </View>
            <View style={styles.cratesNetRow}>
              <Text style={styles.cratesNetLabel}>Net Crates:</Text>
              <Text style={[
                styles.cratesNetValue,
                { color: (parseInt(cratesDropped) || 0) - (parseInt(cratesCollected) || 0) > 0 ? '#F59E0B' : '#10B981' }
              ]}>
                {(parseInt(cratesDropped) || 0) - (parseInt(cratesCollected) || 0)} left with customer
              </Text>
            </View>
          </View>

          {/* Payment Section */}
          <View style={styles.paymentSection}>
            <Text style={styles.sectionTitle}>Payment</Text>

            {/* Totals Card - VAT auto-calculated */}
            <View style={styles.totalCard}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Items Total</Text>
                <Text style={styles.subtotalValue}>R{subtotal.toFixed(2)}</Text>
              </View>
              {vatAmount > 0 && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>VAT (15% included)</Text>
                  <Text style={styles.vatValue}>R{vatAmount.toFixed(2)}</Text>
                </View>
              )}
              <View style={[styles.totalRow, styles.totalRowFinal]}>
                <Text style={styles.totalLabelFinal}>Invoice Total</Text>
                <Text style={styles.totalValueFinal}>R{finalTotal.toFixed(2)}</Text>
              </View>
            </View>

            {/* Payment Methods */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputGroupLabel}>Payment Method</Text>
              <View style={styles.paymentTypesGrid}>
                {PAYMENT_METHODS.map((method) => (
                  <TouchableOpacity
                    key={method.id}
                    style={[
                      styles.paymentTypeButton,
                      paymentType === method.id && styles.paymentTypeButtonActive,
                    ]}
                    onPress={() => {
                      setPaymentType(method.id);
                      setSplitPayments([]);
                    }}
                  >
                    <Ionicons
                      name={method.icon as any}
                      size={20}
                      color={paymentType === method.id ? '#FFFFFF' : '#64748B'}
                    />
                    <Text
                      style={[
                        styles.paymentTypeText,
                        paymentType === method.id && styles.paymentTypeTextActive,
                      ]}
                    >
                      {method.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              {/* Split Payment Button */}
              <TouchableOpacity
                style={[
                  styles.splitButton,
                  paymentType === 'split' && styles.splitButtonActive
                ]}
                onPress={() => {
                  setPaymentType('split');
                  setShowSplitModal(true);
                }}
              >
                <Ionicons name="git-branch-outline" size={20} color={paymentType === 'split' ? '#FFFFFF' : '#3B82F6'} />
                <Text style={[styles.splitButtonText, paymentType === 'split' && { color: '#FFFFFF' }]}>
                  Split Payment
                </Text>
              </TouchableOpacity>
            </View>

            {/* Split Payment Summary */}
            {paymentType === 'split' && splitPayments.length > 0 && (
              <View style={styles.splitSummary}>
                <Text style={styles.splitSummaryTitle}>Split Payments:</Text>
                {splitPayments.map((sp, idx) => (
                  <View key={idx} style={styles.splitItem}>
                    <Text style={styles.splitItemMethod}>
                      {PAYMENT_METHODS.find(m => m.id === sp.method)?.name || sp.method}
                    </Text>
                    <Text style={styles.splitItemAmount}>R{parseFloat(sp.amount || '0').toFixed(2)}</Text>
                  </View>
                ))}
                <TouchableOpacity
                  style={styles.editSplitButton}
                  onPress={() => setShowSplitModal(true)}
                >
                  <Text style={styles.editSplitButtonText}>Edit Split</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Cash Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputGroupLabel}>Total Received *</Text>
              <View style={styles.cashInputContainer}>
                <Text style={styles.currencyPrefix}>R</Text>
                <TextInput
                  style={styles.cashInput}
                  placeholder="0.00"
                  placeholderTextColor="#64748B"
                  value={cashCollected}
                  onChangeText={setCashCollected}
                  keyboardType="numeric"
                  editable={paymentType !== 'split'}
                />
              </View>
              {paymentType === 'split' && (
                <Text style={styles.splitNote}>Auto-calculated from split payments</Text>
              )}
            </View>

            {/* Shortage Display */}
            {parseFloat(cashCollected || '0') < finalTotal && parseFloat(cashCollected || '0') > 0 && (
              <View style={styles.shortageCard}>
                <View style={styles.shortageRow}>
                  <Ionicons name="warning" size={20} color="#F59E0B" />
                  <Text style={styles.shortageLabel}>Shortage Amount</Text>
                </View>
                <Text style={styles.shortageValue}>
                  R{(finalTotal - parseFloat(cashCollected || '0')).toFixed(2)}
                </Text>
              </View>
            )}

            {/* Notes */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputGroupLabel}>Notes (Optional)</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="Add any notes..."
                placeholderTextColor="#64748B"
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
              />
            </View>
          </View>
        </ScrollView>

        {/* Save Button */}
        <View style={styles.footer}>
          <View style={styles.footerTotal}>
            <Text style={styles.footerTotalLabel}>Invoice Total</Text>
            <Text style={styles.footerTotalValue}>R{finalTotal.toFixed(2)}</Text>
          </View>
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                <Text style={styles.saveButtonText}>Record Sale</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Split Payment Modal - Redesigned */}
        <Modal visible={showSplitModal} animationType="slide" transparent>
          <View style={splitStyles.overlay}>
            <View style={splitStyles.content}>
              {/* Modal Header */}
              <View style={splitStyles.header}>
                <Text style={splitStyles.title}>Split Payment</Text>
                <TouchableOpacity 
                  onPress={() => setShowSplitModal(false)}
                  style={splitStyles.closeBtn}
                >
                  <Ionicons name="close" size={24} color="#94A3B8" />
                </TouchableOpacity>
              </View>
              
              {/* Invoice Total */}
              <View style={splitStyles.totalBanner}>
                <Text style={splitStyles.totalBannerLabel}>Invoice Total</Text>
                <Text style={splitStyles.totalBannerValue}>R{finalTotal.toFixed(2)}</Text>
              </View>
              
              <ScrollView style={splitStyles.methodsList}>
                {/* Payment method inputs - each on its own row */}
                {PAYMENT_METHODS.map((method) => {
                  const existing = splitPayments.find(sp => sp.method === method.id);
                  return (
                    <View key={method.id} style={splitStyles.methodCard}>
                      <View style={splitStyles.methodHeader}>
                        <Ionicons name={method.icon as any} size={22} color="#3B82F6" />
                        <Text style={splitStyles.methodName}>{method.name}</Text>
                      </View>
                      <View style={splitStyles.amountInputContainer}>
                        <Text style={splitStyles.currencySymbol}>R</Text>
                        <TextInput
                          style={splitStyles.amountInput}
                          placeholder="0.00"
                          placeholderTextColor="#475569"
                          keyboardType="numeric"
                          value={existing?.amount || ''}
                          onChangeText={(text) => {
                            const updated = splitPayments.filter(sp => sp.method !== method.id);
                            if (text && parseFloat(text) > 0) {
                              updated.push({ method: method.id, amount: text, reference: '' });
                            }
                            setSplitPayments(updated);
                            const newTotal = updated.reduce((sum, sp) => sum + parseFloat(sp.amount || '0'), 0);
                            setCashCollected(newTotal.toFixed(2));
                          }}
                        />
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
              
              {/* Summary at bottom */}
              <View style={splitStyles.summary}>
                <View style={splitStyles.summaryRow}>
                  <Text style={splitStyles.summaryLabel}>Total Received</Text>
                  <Text style={splitStyles.summaryValue}>
                    R{splitPayments.reduce((sum, sp) => sum + parseFloat(sp.amount || '0'), 0).toFixed(2)}
                  </Text>
                </View>
                
                {splitPayments.reduce((sum, sp) => sum + parseFloat(sp.amount || '0'), 0) < finalTotal && (
                  <View style={splitStyles.shortageRow}>
                    <Text style={splitStyles.shortageLabel}>Shortage</Text>
                    <Text style={splitStyles.shortageValue}>
                      R{(finalTotal - splitPayments.reduce((sum, sp) => sum + parseFloat(sp.amount || '0'), 0)).toFixed(2)}
                    </Text>
                  </View>
                )}
              </View>
              
              <TouchableOpacity
                style={splitStyles.doneButton}
                onPress={() => setShowSplitModal(false)}
              >
                <Text style={splitStyles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Split Payment Modal styles - separate for clarity
const splitStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalBanner: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  totalBannerLabel: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 4,
  },
  totalBannerValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#10B981',
  },
  methodsList: {
    maxHeight: 320,
  },
  methodCard: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  methodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  methodName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#334155',
    paddingHorizontal: 16,
    height: 52,
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: '700',
    color: '#10B981',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    height: 52,
    padding: 0,
  },
  summary: {
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 16,
    marginTop: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#10B981',
  },
  shortageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#422006',
    borderRadius: 8,
    padding: 12,
  },
  shortageLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
  },
  shortageValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F59E0B',
  },
  doneButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  doneButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

// Main screen styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  keyboardView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  productCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  productHeader: {
    marginBottom: 12,
  },
  productHeaderLeft: {},
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  productMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  productPrice: {
    fontSize: 13,
    color: '#10B981',
  },
  vatBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  vatBadgeText: {
    fontSize: 10,
    color: '#3B82F6',
    fontWeight: '600',
  },
  vatExemptBadge: {
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  vatExemptBadgeText: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
  },
  productInputs: {
    gap: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputLabel: {
    fontSize: 14,
    color: '#94A3B8',
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButtonAdd: {
    backgroundColor: '#3B82F6',
  },
  quantityInput: {
    width: 50,
    height: 36,
    backgroundColor: '#0F172A',
    borderRadius: 8,
    marginHorizontal: 6,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    padding: 0,
  },
  cratesSection: {
    marginBottom: 24,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  cratesRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cratesInputGroup: {
    flex: 1,
  },
  cratesLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 8,
  },
  cratesInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  cratesInput: {
    flex: 1,
    height: 48,
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  cratesNetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  cratesNetLabel: {
    fontSize: 14,
    color: '#94A3B8',
  },
  cratesNetValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  paymentSection: {
    marginBottom: 24,
  },
  totalCard: {
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
  totalRowFinal: {
    borderTopWidth: 1,
    borderTopColor: '#334155',
    marginTop: 8,
    paddingTop: 12,
  },
  totalLabel: {
    fontSize: 14,
    color: '#94A3B8',
  },
  subtotalValue: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  vatValue: {
    fontSize: 14,
    color: '#64748B',
  },
  totalLabelFinal: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  totalValueFinal: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#10B981',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputGroupLabel: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 8,
  },
  paymentTypesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  paymentTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
    width: '48%',
    flexGrow: 1,
  },
  paymentTypeButtonActive: {
    backgroundColor: '#3B82F6',
  },
  paymentTypeText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  paymentTypeTextActive: {
    color: '#FFFFFF',
  },
  splitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E3A5F',
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  splitButtonActive: {
    backgroundColor: '#3B82F6',
  },
  splitButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3B82F6',
  },
  splitSummary: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  splitSummaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  splitItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  splitItemMethod: {
    fontSize: 14,
    color: '#94A3B8',
  },
  splitItemAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  editSplitButton: {
    marginTop: 12,
    alignItems: 'center',
  },
  editSplitButtonText: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '600',
  },
  splitNote: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    fontStyle: 'italic',
  },
  cashInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  currencyPrefix: {
    fontSize: 20,
    fontWeight: '600',
    color: '#10B981',
  },
  cashInput: {
    flex: 1,
    height: 52,
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  shortageCard: {
    backgroundColor: '#422006',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  shortageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  shortageLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#F59E0B',
  },
  shortageValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F59E0B',
    textAlign: 'center',
  },
  notesInput: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    color: '#FFFFFF',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    gap: 16,
  },
  footerTotal: {
    flex: 1,
  },
  footerTotalLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  footerTotalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
