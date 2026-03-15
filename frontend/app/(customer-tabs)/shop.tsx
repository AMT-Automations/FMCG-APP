import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, RefreshControl, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/services/api';

interface CompanyInfo {
  id: string;
  name: string;
  phone: string;
  address: string;
  province: string;
  product_count: number;
  routes: { id: string; name: string; areas: string[]; delivery_days: string[]; cut_off_time: string }[];
}

interface Product {
  id: string;
  name: string;
  category: string;
  unit_type: string;
  price: number;
  vat_applicable?: boolean;
}

interface CartItem {
  product: Product;
  quantity: number;
}

type ScreenMode = 'companies' | 'products' | 'cart';

export default function ShopScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<ScreenMode>('companies');
  const [companies, setCompanies] = useState<CompanyInfo[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<CompanyInfo | null>(null);
  const [companyData, setCompanyData] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [orderNotes, setOrderNotes] = useState('');

  const profile = (user as any)?.customer_profile || {};

  const loadCompanies = useCallback(async () => {
    try {
      const data = await api.getAvailableCompanies();
      setCompanies(data);
    } catch (error: any) {
      console.error('Failed to load companies:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  const onRefresh = () => {
    setRefreshing(true);
    if (mode === 'companies') {
      loadCompanies();
    } else if (mode === 'products' && selectedCompany) {
      loadCompanyProducts(selectedCompany);
    }
  };

  const loadCompanyProducts = async (company: CompanyInfo) => {
    setLoadingProducts(true);
    try {
      const data = await api.getCompanyProducts(company.id);
      setCompanyData(data);
      setProducts(data.products || []);
      setSelectedCompany(company);
      setMode('products');
    } catch (error: any) {
      console.error('Failed to load products:', error);
      Alert.alert('Error', 'Failed to load products for this supplier');
    } finally {
      setLoadingProducts(false);
      setRefreshing(false);
    }
  };

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.product.id === product.id);
      if (existing) {
        return prev.map((c) =>
          c.product.id === product.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((c) => {
          if (c.product.id === productId) {
            const newQty = c.quantity + delta;
            return newQty > 0 ? { ...c, quantity: newQty } : null;
          }
          return c;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((c) => c.product.id !== productId));
  };

  const getCartTotal = () => cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const getCartCount = () => cart.reduce((sum, item) => sum + item.quantity, 0);
  const getItemQty = (productId: string) => {
    const item = cart.find((c) => c.product.id === productId);
    return item ? item.quantity : 0;
  };

  const handleSubmitOrder = async () => {
    if (cart.length === 0) {
      if (Platform.OS === 'web') {
        window.alert('Please add items to your cart before ordering.');
      } else {
        Alert.alert('Empty Cart', 'Please add items to your cart before ordering.');
      }
      return;
    }
    if (!selectedCompany) {
      Alert.alert('Error', 'No supplier selected.');
      return;
    }

    if (Platform.OS === 'web') {
      const proceed = window.confirm(
        `Place order for ${getCartCount()} items from ${selectedCompany.name} totaling R${getCartTotal().toFixed(2)}?`
      );
      if (proceed) {
        await placeOrderNow();
      }
    } else {
      Alert.alert(
        'Confirm Order',
        `Place order for ${getCartCount()} items from ${selectedCompany.name} totaling R${getCartTotal().toFixed(2)}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Place Order', onPress: placeOrderNow },
        ]
      );
    }
  };

  const placeOrderNow = async () => {
    if (!selectedCompany) return;
    setSubmitting(true);
    try {
      const orderData = {
        company_id: selectedCompany.id,
        items: cart.map((c) => ({
          product_id: c.product.id,
          product_name: c.product.name,
          quantity: c.quantity,
          unit_price: c.product.price,
        })),
        notes: orderNotes || undefined,
      };
      const result = await api.createOrder(orderData);
      if (result.error) {
        if (Platform.OS === 'web') {
          window.alert(result.message);
        } else {
          Alert.alert('Order Failed', result.message);
        }
      } else {
        setCart([]);
        setOrderNotes('');
        setMode('companies');
        router.push({
          pathname: '/order-confirmation',
          params: { orderId: result.id || result._id },
        });
      }
    } catch (error: any) {
      const msg = error.response?.data?.detail || 'Failed to place order';
      if (Platform.OS === 'web') {
        window.alert('Error: ' + msg);
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedProducts = filteredProducts.reduce((acc: Record<string, Product[]>, p) => {
    const cat = p.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  // ===================== LOADING STATE =====================
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>Finding suppliers in your area...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ===================== CART VIEW =====================
  if (mode === 'cart') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => setMode('products')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerBarTitle}>Your Cart</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 200 }}>
          {cart.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="cart-outline" size={64} color="#475569" />
              <Text style={styles.emptyStateText}>Your cart is empty</Text>
            </View>
          ) : (
            <>
              {/* Company tag */}
              <View style={styles.cartCompanyTag}>
                <Ionicons name="business" size={16} color="#10B981" />
                <Text style={styles.cartCompanyText}>{selectedCompany?.name}</Text>
              </View>

              {cart.map((item) => (
                <View key={item.product.id} style={styles.cartItem}>
                  <View style={styles.cartItemInfo}>
                    <Text style={styles.cartItemName}>{item.product.name}</Text>
                    <Text style={styles.cartItemPrice}>
                      R{item.product.price.toFixed(2)} × {item.quantity} = R{(item.product.price * item.quantity).toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.cartItemControls}>
                    <TouchableOpacity onPress={() => updateQuantity(item.product.id, -1)} style={styles.qtyButton}>
                      <Ionicons name="remove" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={styles.qtyText}>{item.quantity}</Text>
                    <TouchableOpacity onPress={() => updateQuantity(item.product.id, 1)} style={styles.qtyButton}>
                      <Ionicons name="add" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => removeFromCart(item.product.id)} style={[styles.qtyButton, { backgroundColor: '#EF4444', marginLeft: 8 }]}>
                      <Ionicons name="trash" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              <View style={styles.notesContainer}>
                <Text style={styles.notesLabel}>Order Notes (optional)</Text>
                <TextInput
                  style={styles.notesInput}
                  placeholder="Any special instructions..."
                  placeholderTextColor="#64748B"
                  value={orderNotes}
                  onChangeText={setOrderNotes}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </>
          )}
        </ScrollView>

        {cart.length > 0 && (
          <View style={styles.cartFooter}>
            <View style={styles.cartTotalRow}>
              <Text style={styles.cartTotalLabel}>Total ({getCartCount()} items)</Text>
              <Text style={styles.cartTotalAmount}>R{getCartTotal().toFixed(2)}</Text>
            </View>
            <TouchableOpacity
              style={[styles.placeOrderButton, submitting && { opacity: 0.7 }]}
              onPress={handleSubmitOrder}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
                  <Text style={styles.placeOrderText}>Place Order</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    );
  }

  // ===================== PRODUCTS VIEW =====================
  if (mode === 'products' && selectedCompany) {
    const nextDelivery = companyData?.next_delivery;
    const routeInfo = companyData?.route;

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => { setMode('companies'); setSearchQuery(''); }} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerBarTitle} numberOfLines={1}>{selectedCompany.name}</Text>
            {routeInfo && (
              <Text style={styles.headerBarSub}>{routeInfo.delivery_days.join(', ')}</Text>
            )}
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Delivery Info Banner */}
        {nextDelivery && (
          <View style={[styles.deliveryBanner, nextDelivery.is_open ? styles.deliveryOpen : styles.deliveryClosed]}>
            <Ionicons
              name={nextDelivery.is_open ? 'time-outline' : 'close-circle-outline'}
              size={20}
              color={nextDelivery.is_open ? '#10B981' : '#EF4444'}
            />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={styles.deliveryBannerTitle}>
                Next: {nextDelivery.delivery_day} ({nextDelivery.delivery_date})
              </Text>
              <Text style={styles.deliveryBannerSub}>
                {nextDelivery.is_open
                  ? `Order open - ${Math.round(nextDelivery.hours_until_cutoff)}h until cutoff`
                  : 'Ordering closed for this delivery'}
              </Text>
            </View>
          </View>
        )}

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#64748B" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products..."
            placeholderTextColor="#64748B"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#64748B" />
            </TouchableOpacity>
          ) : null}
        </View>

        {loadingProducts ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#10B981" />
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />}
          >
            {filteredProducts.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="storefront-outline" size={64} color="#475569" />
                <Text style={styles.emptyStateText}>No products available</Text>
              </View>
            ) : (
              Object.entries(groupedProducts).map(([category, items]) => (
                <View key={category} style={styles.categorySection}>
                  <Text style={styles.categoryTitle}>{category}</Text>
                  {items.map((product) => {
                    const qty = getItemQty(product.id);
                    return (
                      <View key={product.id} style={styles.productCard}>
                        <View style={styles.productInfo}>
                          <Text style={styles.productName}>{product.name}</Text>
                          <View style={styles.productMeta}>
                            <Text style={styles.productPrice}>R{product.price.toFixed(2)}</Text>
                            <Text style={styles.productUnit}>per {product.unit_type}</Text>
                            {product.vat_applicable && (
                              <View style={styles.vatBadge}>
                                <Text style={styles.vatBadgeText}>VAT incl.</Text>
                              </View>
                            )}
                          </View>
                        </View>
                        {qty > 0 ? (
                          <View style={styles.productControls}>
                            <TouchableOpacity onPress={() => updateQuantity(product.id, -1)} style={styles.productQtyBtn}>
                              <Ionicons name="remove" size={18} color="#FFFFFF" />
                            </TouchableOpacity>
                            <Text style={styles.productQtyText}>{qty}</Text>
                            <TouchableOpacity onPress={() => updateQuantity(product.id, 1)} style={styles.productQtyBtn}>
                              <Ionicons name="add" size={18} color="#FFFFFF" />
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <TouchableOpacity onPress={() => addToCart(product)} style={styles.addButton}>
                            <Ionicons name="add" size={20} color="#FFFFFF" />
                            <Text style={styles.addButtonText}>Add</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </View>
              ))
            )}
          </ScrollView>
        )}

        {/* Floating Cart Button */}
        {cart.length > 0 && (
          <TouchableOpacity style={styles.floatingCart} onPress={() => setMode('cart')}>
            <View style={styles.floatingCartContent}>
              <View style={styles.floatingCartLeft}>
                <Ionicons name="cart" size={22} color="#FFFFFF" />
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{getCartCount()}</Text>
                </View>
              </View>
              <Text style={styles.floatingCartText}>View Cart</Text>
              <Text style={styles.floatingCartTotal}>R{getCartTotal().toFixed(2)}</Text>
            </View>
          </TouchableOpacity>
        )}
      </SafeAreaView>
    );
  }

  // ===================== COMPANIES LIST (DEFAULT) =====================
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.name || 'Customer'}!</Text>
          <Text style={styles.locationLabel}>
            <Ionicons name="location" size={14} color="#10B981" />
            {' '}{profile.city || 'Your area'}, {profile.province || ''}
          </Text>
        </View>
      </View>

      <Text style={styles.sectionHeading}>Suppliers in your area</Text>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />}
      >
        {companies.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="business-outline" size={64} color="#475569" />
            <Text style={styles.emptyStateText}>No suppliers found in your area</Text>
            <Text style={styles.emptyStateSub}>Check back later or update your location in profile</Text>
          </View>
        ) : (
          companies.map((company) => (
            <TouchableOpacity
              key={company.id}
              style={styles.companyCard}
              onPress={() => loadCompanyProducts(company)}
            >
              <View style={styles.companyIconWrap}>
                <Ionicons name="business" size={28} color="#10B981" />
              </View>
              <View style={styles.companyInfo}>
                <Text style={styles.companyName}>{company.name}</Text>
                <Text style={styles.companyAddress}>{company.address || company.province}</Text>
                <View style={styles.companyMeta}>
                  <View style={styles.metaPill}>
                    <Ionicons name="cube-outline" size={12} color="#94A3B8" />
                    <Text style={styles.metaPillText}>{company.product_count} products</Text>
                  </View>
                  {company.routes.length > 0 && company.routes[0].delivery_days.length > 0 && (
                    <View style={styles.metaPill}>
                      <Ionicons name="calendar-outline" size={12} color="#94A3B8" />
                      <Text style={styles.metaPillText}>{company.routes[0].delivery_days.join(', ')}</Text>
                    </View>
                  )}
                </View>
                {company.routes.length > 0 && (
                  <View style={styles.routeTag}>
                    <Ionicons name="navigate-outline" size={12} color="#3B82F6" />
                    <Text style={styles.routeTagText}>{company.routes[0].name}</Text>
                    {company.routes[0].areas.length > 0 && (
                      <Text style={styles.routeAreasText}> — {company.routes[0].areas.slice(0, 3).join(', ')}</Text>
                    )}
                  </View>
                )}
              </View>
              <Ionicons name="chevron-forward" size={22} color="#475569" />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#94A3B8', marginTop: 12, fontSize: 16 },

  // Header
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  greeting: { fontSize: 22, fontWeight: '700', color: '#FFFFFF' },
  locationLabel: { fontSize: 14, color: '#10B981', marginTop: 4 },
  sectionHeading: {
    fontSize: 16, fontWeight: '700', color: '#94A3B8', paddingHorizontal: 20,
    marginTop: 12, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5,
  },

  // Company Card
  companyCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B',
    borderRadius: 14, padding: 16, marginBottom: 12,
  },
  companyIconWrap: {
    width: 56, height: 56, borderRadius: 14, backgroundColor: '#064E3B',
    justifyContent: 'center', alignItems: 'center',
  },
  companyInfo: { flex: 1, marginLeft: 14 },
  companyName: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
  companyAddress: { fontSize: 13, color: '#94A3B8', marginTop: 2 },
  companyMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  metaPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#0F172A', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  metaPillText: { fontSize: 11, color: '#94A3B8' },
  routeTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  routeTagText: { fontSize: 12, color: '#3B82F6', fontWeight: '600' },
  routeAreasText: { fontSize: 11, color: '#64748B' },

  // Header Bar (Products/Cart)
  headerBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#334155',
  },
  backButton: { padding: 8, marginRight: 8 },
  headerBarTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  headerBarSub: { fontSize: 12, color: '#94A3B8', marginTop: 2 },

  // Delivery Banner
  deliveryBanner: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 16,
    padding: 12, borderRadius: 12, marginTop: 8, marginBottom: 4,
  },
  deliveryOpen: { backgroundColor: '#064E3B' },
  deliveryClosed: { backgroundColor: '#7F1D1D' },
  deliveryBannerTitle: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  deliveryBannerSub: { fontSize: 12, color: '#94A3B8', marginTop: 2 },

  // Search
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B',
    marginHorizontal: 16, marginVertical: 8, paddingHorizontal: 14, borderRadius: 12, height: 48,
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16, color: '#FFFFFF' },

  // Products
  categorySection: { marginHorizontal: 16, marginBottom: 16 },
  categoryTitle: {
    fontSize: 14, fontWeight: '700', color: '#94A3B8', marginBottom: 8,
    textTransform: 'uppercase', letterSpacing: 1,
  },
  productCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#1E293B', borderRadius: 12, padding: 14, marginBottom: 8,
  },
  productInfo: { flex: 1, marginRight: 12 },
  productName: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  productMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 },
  productPrice: { fontSize: 16, fontWeight: '700', color: '#10B981' },
  productUnit: { fontSize: 13, color: '#64748B' },
  vatBadge: { backgroundColor: '#1E3A5F', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  vatBadgeText: { fontSize: 10, color: '#60A5FA' },
  productControls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  productQtyBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#334155',
    justifyContent: 'center', alignItems: 'center',
  },
  productQtyText: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', minWidth: 30, textAlign: 'center' },
  addButton: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B981',
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, gap: 4,
  },
  addButtonText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },

  // Empty State
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyStateText: { fontSize: 18, fontWeight: '600', color: '#94A3B8', marginTop: 16 },
  emptyStateSub: { fontSize: 14, color: '#475569', marginTop: 4, textAlign: 'center', paddingHorizontal: 32 },

  // Floating Cart
  floatingCart: {
    position: 'absolute', bottom: Platform.OS === 'ios' ? 100 : 80, left: 16, right: 16,
    backgroundColor: '#10B981', borderRadius: 16, elevation: 8,
    ...Platform.select({
      web: { boxShadow: '0 4px 8px rgba(0,0,0,0.3)' },
      default: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
    }),
  },
  floatingCartContent: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
  },
  floatingCartLeft: { flexDirection: 'row', alignItems: 'center' },
  cartBadge: {
    backgroundColor: '#FFFFFF', borderRadius: 10, minWidth: 20, height: 20,
    justifyContent: 'center', alignItems: 'center', marginLeft: -8, marginTop: -14,
  },
  cartBadgeText: { fontSize: 11, fontWeight: '700', color: '#10B981' },
  floatingCartText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  floatingCartTotal: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },

  // Cart View
  cartCompanyTag: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#064E3B', borderRadius: 10, padding: 12, marginBottom: 16,
  },
  cartCompanyText: { fontSize: 14, fontWeight: '600', color: '#10B981' },
  cartItem: { backgroundColor: '#1E293B', borderRadius: 12, padding: 14, marginBottom: 10 },
  cartItemInfo: { marginBottom: 10 },
  cartItemName: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  cartItemPrice: { fontSize: 14, color: '#10B981', marginTop: 4 },
  cartItemControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyButton: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#334155',
    justifyContent: 'center', alignItems: 'center',
  },
  qtyText: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', minWidth: 30, textAlign: 'center' },
  notesContainer: { marginTop: 16, marginBottom: 20 },
  notesLabel: { fontSize: 14, fontWeight: '600', color: '#94A3B8', marginBottom: 8 },
  notesInput: {
    backgroundColor: '#1E293B', borderRadius: 12, padding: 14,
    color: '#FFFFFF', fontSize: 15, textAlignVertical: 'top', minHeight: 80,
  },
  cartFooter: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#1E293B', borderTopWidth: 1, borderTopColor: '#334155',
    paddingHorizontal: 20, paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  cartTotalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14,
  },
  cartTotalLabel: { fontSize: 16, color: '#94A3B8' },
  cartTotalAmount: { fontSize: 22, fontWeight: '800', color: '#10B981' },
  placeOrderButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#10B981', borderRadius: 14, paddingVertical: 16, gap: 8,
  },
  placeOrderText: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
});
