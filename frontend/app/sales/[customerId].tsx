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
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/services/api';

interface Product {
  id: string;
  name: string;
  category: string;
  unit_type: string;
  price: number;
}

interface SaleItem {
  product_id: string;
  product_name: string;
  quantity_delivered: number;
  quantity_returned: number;
  damages: number;
  unit_price: number;
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
      
      // Try to get customer-specific prices if customer ID is available
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
          // Customer-specific prices not available, use default
          console.log('Using default prices');
        }
      }
      
      // Apply customer-specific prices to products
      const productsWithPrices = productsData.map((product: Product) => ({
        ...product,
        price: customerPrices[product.id] || product.price,
        hasCustomPrice: !!customerPrices[product.id],
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

  const calculateTotal = () => {
    return Object.values(items).reduce((sum, item) => {
      const net = item.quantity_delivered - item.quantity_returned;
      return sum + net * item.unit_price;
    }, 0);
  };

  const handleSave = async () => {
    const saleItems = Object.values(items).filter(
      (item) => item.quantity_delivered > 0 || item.quantity_returned > 0 || item.damages > 0
    );

    if (saleItems.length === 0) {
      Alert.alert('Error', 'Please add at least one product');
      return;
    }

    if (!cashCollected || parseFloat(cashCollected) <= 0) {
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
        items: saleItems,
        crates_dropped: parseInt(cratesDropped) || 0,
        crates_collected: parseInt(cratesCollected) || 0,
        cash_collected: parseFloat(cashCollected),
        payment_type: paymentType,
        split_payments: splitPaymentsData,
        notes: notes || undefined,
      });
      
      // Get values for display
      const invoiceNumber = result.invoice_number || 'N/A';
      const invoiceTotal = result.total_amount || saleItems.reduce((sum, item) => {
        return sum + (item.quantity_delivered - item.quantity_returned) * item.unit_price;
      }, 0);
      const cashReceived = parseFloat(cashCollected);
      const shortageAmount = result.shortage_amount || Math.max(0, invoiceTotal - cashReceived);
      const cratesNet = (parseInt(cratesDropped) || 0) - (parseInt(cratesCollected) || 0);
      
      // Show detailed success with invoice number prominently displayed
      const title = `✅ SALE RECORDED`;
      let message = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      message += `📄 INVOICE: ${invoiceNumber}\n`;
      message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      message += `👤 Customer: ${customerName}\n`;
      message += `🚗 Route: ${activeRoute.route_name}\n`;
      message += `📅 Date: ${new Date().toLocaleDateString()}\n`;
      message += `🕐 Time: ${new Date().toLocaleTimeString()}\n\n`;
      message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      message += `💰 Invoice Total:    R ${invoiceTotal.toFixed(2)}\n`;
      
      // Show payment breakdown
      if (paymentType === 'split' && splitPayments.length > 0) {
        message += `\n💳 Payment Split:\n`;
        splitPayments.forEach(sp => {
          const methodName = PAYMENT_METHODS.find(m => m.id === sp.method)?.name || sp.method;
          message += `   • ${methodName}: R ${parseFloat(sp.amount).toFixed(2)}\n`;
        });
      } else {
        const methodName = PAYMENT_METHODS.find(m => m.id === paymentType)?.name || paymentType;
        message += `💳 Payment (${methodName}): R ${cashReceived.toFixed(2)}\n`;
      }
      
      if (shortageAmount > 0) {
        message += `\n⚠️ SHORTAGE: R ${shortageAmount.toFixed(2)}\n`;
      }
      
      // Crates info
      if (parseInt(cratesDropped) > 0 || parseInt(cratesCollected) > 0) {
        message += `\n📦 Crates Dropped: ${cratesDropped || 0}\n`;
        message += `📦 Crates Collected: ${cratesCollected || 0}\n`;
        message += `📦 Net with Customer: ${cratesNet}\n`;
      }
      
      message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      
      Alert.alert(title, message, [
        { text: 'Done', onPress: () => router.back() },
      ]);
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

  const total = calculateTotal();

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
                      <View>
                        <Text style={styles.productName}>{product.name}</Text>
                        <Text style={styles.productPrice}>
                          R {product.price.toFixed(2)} / {product.unit_type}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.productInputs}>
                      <View style={styles.inputRow}>
                        <Text style={styles.inputLabel}>Delivered</Text>
                        <View style={styles.quantityControl}>
                          <TouchableOpacity
                            style={styles.quantityButton}
                            onPress={() =>
                              updateItem(
                                product,
                                'quantity_delivered',
                                Math.max(0, (item?.quantity_delivered || 0) - 1)
                              )
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
                              updateItem(
                                product,
                                'quantity_delivered',
                                (item?.quantity_delivered || 0) + 1
                              )
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
                              updateItem(
                                product,
                                'quantity_returned',
                                Math.max(0, (item?.quantity_returned || 0) - 1)
                              )
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
                              updateItem(
                                product,
                                'quantity_returned',
                                (item?.quantity_returned || 0) + 1
                              )
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
                              updateItem(
                                product,
                                'damages',
                                Math.max(0, (item?.damages || 0) - 1)
                              )
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

            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>Invoice Total</Text>
              <Text style={styles.totalValue}>R {total.toFixed(2)}</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputGroupLabel}>Payment Method</Text>
              <View style={styles.paymentTypes}>
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
                      size={18}
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
                <Ionicons name="git-branch-outline" size={18} color={paymentType === 'split' ? '#FFFFFF' : '#3B82F6'} />
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
                    <Text style={styles.splitItemAmount}>R {parseFloat(sp.amount || '0').toFixed(2)}</Text>
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
            {parseFloat(cashCollected || '0') < total && parseFloat(cashCollected || '0') > 0 && (
              <View style={styles.shortageCard}>
                <View style={styles.shortageRow}>
                  <Ionicons name="warning" size={20} color="#F59E0B" />
                  <Text style={styles.shortageLabel}>Shortage Amount</Text>
                </View>
                <Text style={styles.shortageValue}>
                  R {(total - parseFloat(cashCollected || '0')).toFixed(2)}
                </Text>
              </View>
            )}

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
            <Text style={styles.footerTotalLabel}>Total</Text>
            <Text style={styles.footerTotalValue}>R {total.toFixed(2)}</Text>
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

        {/* Split Payment Modal */}
        <Modal visible={showSplitModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Split Payment</Text>
                <TouchableOpacity onPress={() => setShowSplitModal(false)}>
                  <Ionicons name="close" size={24} color="#94A3B8" />
                </TouchableOpacity>
              </View>
              
              <Text style={styles.modalSubtitle}>
                Invoice Total: R {total.toFixed(2)}
              </Text>
              
              {PAYMENT_METHODS.map((method) => {
                const existing = splitPayments.find(sp => sp.method === method.id);
                return (
                  <View key={method.id} style={styles.splitPaymentRow}>
                    <View style={styles.splitPaymentLabel}>
                      <Ionicons name={method.icon as any} size={20} color="#94A3B8" />
                      <Text style={styles.splitPaymentLabelText}>{method.name}</Text>
                    </View>
                    <View style={styles.splitPaymentInput}>
                      <Text style={styles.splitCurrencyPrefix}>R</Text>
                      <TextInput
                        style={styles.splitAmountInput}
                        placeholder="0.00"
                        placeholderTextColor="#64748B"
                        keyboardType="numeric"
                        value={existing?.amount || ''}
                        onChangeText={(text) => {
                          const updated = splitPayments.filter(sp => sp.method !== method.id);
                          if (text && parseFloat(text) > 0) {
                            updated.push({ method: method.id, amount: text, reference: '' });
                          }
                          setSplitPayments(updated);
                          // Update total
                          const newTotal = updated.reduce((sum, sp) => sum + parseFloat(sp.amount || '0'), 0);
                          setCashCollected(newTotal.toFixed(2));
                        }}
                      />
                    </View>
                  </View>
                );
              })}
              
              <View style={styles.splitTotalRow}>
                <Text style={styles.splitTotalLabel}>Total Received:</Text>
                <Text style={styles.splitTotalValue}>
                  R {splitPayments.reduce((sum, sp) => sum + parseFloat(sp.amount || '0'), 0).toFixed(2)}
                </Text>
              </View>
              
              {splitPayments.reduce((sum, sp) => sum + parseFloat(sp.amount || '0'), 0) < total && (
                <View style={styles.splitShortageRow}>
                  <Text style={styles.splitShortageLabel}>Shortage:</Text>
                  <Text style={styles.splitShortageValue}>
                    R {(total - splitPayments.reduce((sum, sp) => sum + parseFloat(sp.amount || '0'), 0)).toFixed(2)}
                  </Text>
                </View>
              )}
              
              <TouchableOpacity
                style={styles.splitDoneButton}
                onPress={() => setShowSplitModal(false)}
              >
                <Text style={styles.splitDoneButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

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
    width: 40,
    height: 40,
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
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  productPrice: {
    fontSize: 12,
    color: '#10B981',
    marginTop: 2,
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
  paymentSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  totalCard: {
    backgroundColor: '#1E3A5F',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 14,
    color: '#94A3B8',
  },
  totalValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 4,
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
  inputGroup: {
    marginBottom: 16,
  },
  inputGroupLabel: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 8,
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
  paymentTypes: {
    flexDirection: 'row',
    gap: 12,
  },
  paymentTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 14,
    gap: 8,
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
  cratesSection: {
    marginBottom: 24,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
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
  splitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E3A5F',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  splitButtonActive: {
    backgroundColor: '#3B82F6',
  },
  splitButtonText: {
    fontSize: 14,
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
  },
  splitNote: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#10B981',
    marginBottom: 20,
    textAlign: 'center',
  },
  splitPaymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  splitPaymentLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  splitPaymentLabelText: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  splitPaymentInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 8,
    paddingHorizontal: 12,
    width: 140,
  },
  splitCurrencyPrefix: {
    fontSize: 16,
    color: '#64748B',
  },
  splitAmountInput: {
    flex: 1,
    height: 44,
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'right',
  },
  splitTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 16,
    marginTop: 8,
  },
  splitTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  splitTotalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10B981',
  },
  splitShortageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  splitShortageLabel: {
    fontSize: 14,
    color: '#F59E0B',
  },
  splitShortageValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F59E0B',
  },
  splitDoneButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  splitDoneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
