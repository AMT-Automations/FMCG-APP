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

export default function SalesEntryScreen() {
  const router = useRouter();
  const { customerId, name } = useLocalSearchParams<{ customerId: string; name: string }>();
  const [products, setProducts] = useState<Product[]>([]);
  const [activeRoute, setActiveRoute] = useState<any>(null);
  const [items, setItems] = useState<{ [key: string]: SaleItem }>({});
  const [cashCollected, setCashCollected] = useState('');
  const [paymentType, setPaymentType] = useState('cash');
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
      setProducts(productsData);
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

    if (!cashCollected) {
      Alert.alert('Error', 'Please enter cash collected amount');
      return;
    }

    if (!activeRoute) {
      Alert.alert('Error', 'No active route found');
      return;
    }

    setSaving(true);
    try {
      await api.createSale({
        route_id: activeRoute.route_id,
        customer_id: customerId || '',
        customer_name: customerName,
        items: saleItems,
        cash_collected: parseFloat(cashCollected),
        payment_type: paymentType,
        notes: notes || undefined,
      });
      Alert.alert('Success', 'Sale recorded successfully', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
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

          {/* Payment Section */}
          <View style={styles.paymentSection}>
            <Text style={styles.sectionTitle}>Payment</Text>

            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>Total Amount</Text>
              <Text style={styles.totalValue}>R {total.toFixed(2)}</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputGroupLabel}>Cash Collected *</Text>
              <View style={styles.cashInputContainer}>
                <Text style={styles.currencyPrefix}>R</Text>
                <TextInput
                  style={styles.cashInput}
                  placeholder="0.00"
                  placeholderTextColor="#64748B"
                  value={cashCollected}
                  onChangeText={setCashCollected}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputGroupLabel}>Payment Type</Text>
              <View style={styles.paymentTypes}>
                {['cash', 'card', 'mobile'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.paymentTypeButton,
                      paymentType === type && styles.paymentTypeButtonActive,
                    ]}
                    onPress={() => setPaymentType(type)}
                  >
                    <Ionicons
                      name={
                        type === 'cash'
                          ? 'cash-outline'
                          : type === 'card'
                          ? 'card-outline'
                          : 'phone-portrait-outline'
                      }
                      size={20}
                      color={paymentType === type ? '#FFFFFF' : '#64748B'}
                    />
                    <Text
                      style={[
                        styles.paymentTypeText,
                        paymentType === type && styles.paymentTypeTextActive,
                      ]}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

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
    width: 60,
    height: 36,
    backgroundColor: '#0F172A',
    borderRadius: 8,
    marginHorizontal: 8,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
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
});
