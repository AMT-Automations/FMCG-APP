import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import { api } from '../src/services/api';

const ADJUSTMENT_REASONS = ['damages', 'spoilage', 'theft', 'correction', 'other'];

interface StockLevel {
  product_id: string;
  product_name: string;
  category: string;
  unit_type: string;
  current_quantity: number;
  last_updated: string | null;
}

interface StockMovement {
  id: string;
  movement_type: string;
  product_id: string;
  product_name: string;
  quantity: number;
  reason?: string;
  supplier?: string;
  personnel_name: string;
  created_at: string;
}

export default function StockManagement() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'levels' | 'receive' | 'adjust' | 'take' | 'history'>('levels');
  const [stockLevels, setStockLevels] = useState<StockLevel[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Modal states
  const [receiveModalVisible, setReceiveModalVisible] = useState(false);
  const [adjustModalVisible, setAdjustModalVisible] = useState(false);
  const [takeModalVisible, setTakeModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<StockLevel | null>(null);
  
  // Form states
  const [receiveForm, setReceiveForm] = useState({ 
    quantity: '', 
    supplier: '', 
    batch_reference: '', 
    damages_in_transit: '',
    rejected_stock: '',
    spoilt_from_factory: '',
    crates_received: '',
    crates_returned: '',
    notes: '' 
  });
  const [adjustForm, setAdjustForm] = useState({ quantity: '', reason: 'damages', notes: '' });
  const [takeForm, setTakeForm] = useState({ physical_count: '', variance_reason: '' });

  useEffect(() => {
    if (user?.role !== 'admin' && user?.role !== 'manager') {
      Alert.alert('Access Denied', 'Only admin/manager can access stock management');
      router.back();
      return;
    }
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [levelsData, movementsData, productsData] = await Promise.all([
        api.getStockLevels(),
        api.getStockMovements(),
        api.getProducts(),
      ]);
      setStockLevels(levelsData);
      setMovements(movementsData);
      setProducts(productsData);
    } catch (error) {
      console.error('Error loading stock data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Open receive modal for a product
  const openReceiveModal = (product: StockLevel) => {
    setSelectedProduct(product);
    setReceiveForm({ 
      quantity: '', 
      supplier: '', 
      batch_reference: '', 
      damages_in_transit: '',
      rejected_stock: '',
      spoilt_from_factory: '',
      crates_received: '',
      crates_returned: '',
      notes: '' 
    });
    setReceiveModalVisible(true);
  };

  // Open adjustment modal for a product
  const openAdjustModal = (product: StockLevel) => {
    setSelectedProduct(product);
    setAdjustForm({ quantity: '', reason: 'damages', notes: '' });
    setAdjustModalVisible(true);
  };

  // Open stock take modal for a product
  const openTakeModal = (product: StockLevel) => {
    setSelectedProduct(product);
    setTakeForm({ physical_count: String(product.current_quantity), variance_reason: '' });
    setTakeModalVisible(true);
  };

  // Submit receive stock
  const submitReceive = async () => {
    if (!selectedProduct || !receiveForm.quantity) {
      Alert.alert('Error', 'Please enter quantity');
      return;
    }
    
    const damages = parseInt(receiveForm.damages_in_transit) || 0;
    const rejected = parseInt(receiveForm.rejected_stock) || 0;
    const spoilt = parseInt(receiveForm.spoilt_from_factory) || 0;
    const totalDeductions = damages + rejected + spoilt;
    const netQty = parseInt(receiveForm.quantity) - totalDeductions;
    
    setSaving(true);
    try {
      const result = await api.receiveStock({
        product_id: selectedProduct.product_id,
        product_name: selectedProduct.product_name,
        quantity: parseInt(receiveForm.quantity),
        supplier: receiveForm.supplier || undefined,
        batch_reference: receiveForm.batch_reference || undefined,
        damages_in_transit: damages,
        rejected_stock: rejected,
        spoilt_from_factory: spoilt,
        crates_received: parseInt(receiveForm.crates_received) || 0,
        crates_returned: parseInt(receiveForm.crates_returned) || 0,
        notes: receiveForm.notes || undefined,
      });
      
      let message = `Received: ${receiveForm.quantity}\n`;
      if (totalDeductions > 0) {
        message += `Deductions:\n`;
        if (damages > 0) message += `  - Damages in transit: ${damages}\n`;
        if (rejected > 0) message += `  - Rejected: ${rejected}\n`;
        if (spoilt > 0) message += `  - Spoilt from factory: ${spoilt}\n`;
        message += `Net Added: ${netQty}`;
      }
      
      Alert.alert('Stock Received', message);
      setReceiveModalVisible(false);
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to receive stock');
    } finally {
      setSaving(false);
    }
  };

  // Submit adjustment
  const submitAdjustment = async () => {
    if (!selectedProduct || !adjustForm.quantity) {
      Alert.alert('Error', 'Please enter adjustment quantity');
      return;
    }
    
    setSaving(true);
    try {
      await api.adjustStock({
        product_id: selectedProduct.product_id,
        product_name: selectedProduct.product_name,
        adjustment_quantity: parseInt(adjustForm.quantity),
        reason: adjustForm.reason,
        notes: adjustForm.notes || undefined,
      });
      Alert.alert('Success', 'Stock adjusted successfully');
      setAdjustModalVisible(false);
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to adjust stock');
    } finally {
      setSaving(false);
    }
  };

  // Submit stock take
  const submitStockTake = async () => {
    if (!selectedProduct || !takeForm.physical_count) {
      Alert.alert('Error', 'Please enter physical count');
      return;
    }
    
    const variance = parseInt(takeForm.physical_count) - selectedProduct.current_quantity;
    if (variance !== 0 && !takeForm.variance_reason) {
      Alert.alert('Error', 'Please provide a reason for the variance');
      return;
    }
    
    setSaving(true);
    try {
      await api.recordStockTake({
        product_id: selectedProduct.product_id,
        product_name: selectedProduct.product_name,
        system_quantity: selectedProduct.current_quantity,
        physical_count: parseInt(takeForm.physical_count),
        variance_reason: takeForm.variance_reason || undefined,
      });
      Alert.alert('Success', 'Stock take recorded');
      setTakeModalVisible(false);
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to record stock take');
    } finally {
      setSaving(false);
    }
  };

  // Seed initial stock
  const seedStock = async () => {
    try {
      await api.seedStock();
      Alert.alert('Success', 'Stock seeded for all products');
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to seed stock');
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getMovementIcon = (type: string) => {
    switch (type) {
      case 'receive': return 'arrow-down-circle';
      case 'adjustment': return 'build';
      case 'stock_take': return 'clipboard';
      case 'sale': return 'cart';
      default: return 'swap-horizontal';
    }
  };

  const getMovementColor = (type: string, quantity: number) => {
    if (type === 'receive') return '#10B981';
    if (type === 'adjustment') return quantity > 0 ? '#10B981' : '#EF4444';
    if (type === 'stock_take') return '#3B82F6';
    return '#F59E0B';
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Stock Management</Text>
        <TouchableOpacity style={styles.seedButton} onPress={seedStock}>
          <Ionicons name="refresh" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabContainer}>
        {(['levels', 'receive', 'adjust', 'take', 'history'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Ionicons
              name={
                tab === 'levels' ? 'cube-outline' :
                tab === 'receive' ? 'arrow-down-circle-outline' :
                tab === 'adjust' ? 'build-outline' :
                tab === 'take' ? 'clipboard-outline' : 'time-outline'
              }
              size={18}
              color={activeTab === tab ? '#FFFFFF' : '#94A3B8'}
            />
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'levels' ? 'Levels' :
               tab === 'receive' ? 'Receive' :
               tab === 'adjust' ? 'Adjust' :
               tab === 'take' ? 'Stock Take' : 'History'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />}
      >
        {/* Stock Levels Tab */}
        {activeTab === 'levels' && (
          <View>
            <Text style={styles.sectionTitle}>Current Stock Levels</Text>
            {stockLevels.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="cube-outline" size={48} color="#64748B" />
                <Text style={styles.emptyText}>No stock data. Tap refresh to seed initial stock.</Text>
              </View>
            ) : (
              stockLevels.map((item) => (
                <View key={item.product_id} style={styles.stockCard}>
                  <View style={styles.stockInfo}>
                    <Text style={styles.productName}>{item.product_name}</Text>
                    <Text style={styles.productCategory}>{item.category}</Text>
                  </View>
                  <View style={styles.stockQuantity}>
                    <Text style={[
                      styles.quantityText,
                      item.current_quantity < 20 && styles.quantityLow
                    ]}>
                      {item.current_quantity}
                    </Text>
                    <Text style={styles.unitText}>{item.unit_type}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* Receive Stock Tab */}
        {activeTab === 'receive' && (
          <View>
            <Text style={styles.sectionTitle}>Receive Stock from Supplier</Text>
            <Text style={styles.sectionSubtitle}>Select a product to receive stock</Text>
            {stockLevels.map((item) => (
              <TouchableOpacity
                key={item.product_id}
                style={styles.actionCard}
                onPress={() => openReceiveModal(item)}
              >
                <View style={styles.actionCardContent}>
                  <View style={[styles.actionIcon, { backgroundColor: '#10B981' }]}>
                    <Ionicons name="arrow-down-circle" size={24} color="#FFFFFF" />
                  </View>
                  <View style={styles.actionInfo}>
                    <Text style={styles.actionProductName}>{item.product_name}</Text>
                    <Text style={styles.actionQuantity}>Current: {item.current_quantity} {item.unit_type}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#64748B" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Adjust Stock Tab */}
        {activeTab === 'adjust' && (
          <View>
            <Text style={styles.sectionTitle}>Stock Adjustment</Text>
            <Text style={styles.sectionSubtitle}>Adjust for damages, spoilage, theft, etc.</Text>
            {stockLevels.map((item) => (
              <TouchableOpacity
                key={item.product_id}
                style={styles.actionCard}
                onPress={() => openAdjustModal(item)}
              >
                <View style={styles.actionCardContent}>
                  <View style={[styles.actionIcon, { backgroundColor: '#F59E0B' }]}>
                    <Ionicons name="build" size={24} color="#FFFFFF" />
                  </View>
                  <View style={styles.actionInfo}>
                    <Text style={styles.actionProductName}>{item.product_name}</Text>
                    <Text style={styles.actionQuantity}>Current: {item.current_quantity} {item.unit_type}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#64748B" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Stock Take Tab */}
        {activeTab === 'take' && (
          <View>
            <Text style={styles.sectionTitle}>Physical Stock Count</Text>
            <Text style={styles.sectionSubtitle}>Record actual physical counts and variance</Text>
            {stockLevels.map((item) => (
              <TouchableOpacity
                key={item.product_id}
                style={styles.actionCard}
                onPress={() => openTakeModal(item)}
              >
                <View style={styles.actionCardContent}>
                  <View style={[styles.actionIcon, { backgroundColor: '#3B82F6' }]}>
                    <Ionicons name="clipboard" size={24} color="#FFFFFF" />
                  </View>
                  <View style={styles.actionInfo}>
                    <Text style={styles.actionProductName}>{item.product_name}</Text>
                    <Text style={styles.actionQuantity}>System: {item.current_quantity} {item.unit_type}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#64748B" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <View>
            <Text style={styles.sectionTitle}>Recent Stock Movements</Text>
            {movements.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="time-outline" size={48} color="#64748B" />
                <Text style={styles.emptyText}>No stock movements recorded yet</Text>
              </View>
            ) : (
              movements.map((movement) => (
                <View key={movement.id} style={styles.movementCard}>
                  <View style={[
                    styles.movementIcon,
                    { backgroundColor: getMovementColor(movement.movement_type, movement.quantity) + '20' }
                  ]}>
                    <Ionicons
                      name={getMovementIcon(movement.movement_type)}
                      size={20}
                      color={getMovementColor(movement.movement_type, movement.quantity)}
                    />
                  </View>
                  <View style={styles.movementInfo}>
                    <Text style={styles.movementProduct}>{movement.product_name}</Text>
                    <Text style={styles.movementType}>
                      {movement.movement_type.replace('_', ' ').toUpperCase()}
                      {movement.reason && ` - ${movement.reason}`}
                    </Text>
                    <Text style={styles.movementMeta}>
                      By {movement.personnel_name} • {formatDate(movement.created_at)}
                    </Text>
                  </View>
                  <Text style={[
                    styles.movementQuantity,
                    { color: getMovementColor(movement.movement_type, movement.quantity) }
                  ]}>
                    {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                  </Text>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Receive Stock Modal */}
      <Modal visible={receiveModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScrollContent}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Receive Stock</Text>
                <TouchableOpacity onPress={() => setReceiveModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#94A3B8" />
                </TouchableOpacity>
              </View>
              
              {selectedProduct && (
                <View style={styles.selectedProductInfo}>
                  <Text style={styles.selectedProductName}>{selectedProduct.product_name}</Text>
                  <Text style={styles.selectedProductQty}>Current Stock: {selectedProduct.current_quantity}</Text>
                </View>
              )}
              
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Quantity Received *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Enter quantity"
                  placeholderTextColor="#64748B"
                  value={receiveForm.quantity}
                  onChangeText={(text) => setReceiveForm({ ...receiveForm, quantity: text })}
                  keyboardType="numeric"
                />
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Supplier</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Supplier name"
                  placeholderTextColor="#64748B"
                  value={receiveForm.supplier}
                  onChangeText={(text) => setReceiveForm({ ...receiveForm, supplier: text })}
                />
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Batch Reference</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Batch/Invoice number"
                  placeholderTextColor="#64748B"
                  value={receiveForm.batch_reference}
                  onChangeText={(text) => setReceiveForm({ ...receiveForm, batch_reference: text })}
                />
              </View>

              {/* Deductions Section */}
              <View style={styles.sectionDivider}>
                <Text style={styles.sectionDividerText}>⚠️ Deductions (if any)</Text>
              </View>
              
              <View style={styles.formRow}>
                <View style={styles.formGroupHalf}>
                  <Text style={styles.formLabel}>Damages In-Transit</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="0"
                    placeholderTextColor="#64748B"
                    value={receiveForm.damages_in_transit}
                    onChangeText={(text) => setReceiveForm({ ...receiveForm, damages_in_transit: text })}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.formGroupHalf}>
                  <Text style={styles.formLabel}>Rejected Stock</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="0"
                    placeholderTextColor="#64748B"
                    value={receiveForm.rejected_stock}
                    onChangeText={(text) => setReceiveForm({ ...receiveForm, rejected_stock: text })}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Spoilt from Factory</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="0"
                  placeholderTextColor="#64748B"
                  value={receiveForm.spoilt_from_factory}
                  onChangeText={(text) => setReceiveForm({ ...receiveForm, spoilt_from_factory: text })}
                  keyboardType="numeric"
                />
              </View>

              {/* Crates Section */}
              <View style={styles.sectionDivider}>
                <Text style={styles.sectionDividerText}>📦 Crates Tracking</Text>
              </View>

              <View style={styles.formRow}>
                <View style={styles.formGroupHalf}>
                  <Text style={styles.formLabel}>Crates Received</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="0"
                    placeholderTextColor="#64748B"
                    value={receiveForm.crates_received}
                    onChangeText={(text) => setReceiveForm({ ...receiveForm, crates_received: text })}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.formGroupHalf}>
                  <Text style={styles.formLabel}>Crates Returned</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="0"
                    placeholderTextColor="#64748B"
                    value={receiveForm.crates_returned}
                    onChangeText={(text) => setReceiveForm({ ...receiveForm, crates_returned: text })}
                    keyboardType="numeric"
                  />
                </View>
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Notes</Text>
                <TextInput
                  style={[styles.formInput, styles.formTextArea]}
                  placeholder="Additional notes"
                  placeholderTextColor="#64748B"
                  value={receiveForm.notes}
                  onChangeText={(text) => setReceiveForm({ ...receiveForm, notes: text })}
                  multiline
                  numberOfLines={3}
                />
              </View>
              
              <TouchableOpacity
                style={[styles.submitButton, saving && styles.submitButtonDisabled]}
                onPress={submitReceive}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Receive Stock</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Adjustment Modal */}
      <Modal visible={adjustModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Adjust Stock</Text>
              <TouchableOpacity onPress={() => setAdjustModalVisible(false)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            
            {selectedProduct && (
              <View style={styles.selectedProductInfo}>
                <Text style={styles.selectedProductName}>{selectedProduct.product_name}</Text>
                <Text style={styles.selectedProductQty}>Current Stock: {selectedProduct.current_quantity}</Text>
              </View>
            )}
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Adjustment Quantity *</Text>
              <Text style={styles.formHint}>Use negative for reduction (e.g., -5 for damages)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g., -5 or +10"
                placeholderTextColor="#64748B"
                value={adjustForm.quantity}
                onChangeText={(text) => setAdjustForm({ ...adjustForm, quantity: text })}
                keyboardType="numeric"
              />
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Reason *</Text>
              <View style={styles.reasonButtons}>
                {ADJUSTMENT_REASONS.map((reason) => (
                  <TouchableOpacity
                    key={reason}
                    style={[
                      styles.reasonButton,
                      adjustForm.reason === reason && styles.reasonButtonActive
                    ]}
                    onPress={() => setAdjustForm({ ...adjustForm, reason })}
                  >
                    <Text style={[
                      styles.reasonButtonText,
                      adjustForm.reason === reason && styles.reasonButtonTextActive
                    ]}>
                      {reason.charAt(0).toUpperCase() + reason.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Notes</Text>
              <TextInput
                style={[styles.formInput, styles.formTextArea]}
                placeholder="Additional details"
                placeholderTextColor="#64748B"
                value={adjustForm.notes}
                onChangeText={(text) => setAdjustForm({ ...adjustForm, notes: text })}
                multiline
                numberOfLines={3}
              />
            </View>
            
            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: '#F59E0B' }, saving && styles.submitButtonDisabled]}
              onPress={submitAdjustment}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Adjustment</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Stock Take Modal */}
      <Modal visible={takeModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Stock Take</Text>
              <TouchableOpacity onPress={() => setTakeModalVisible(false)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            
            {selectedProduct && (
              <View style={styles.selectedProductInfo}>
                <Text style={styles.selectedProductName}>{selectedProduct.product_name}</Text>
                <Text style={styles.selectedProductQty}>System Stock: {selectedProduct.current_quantity}</Text>
              </View>
            )}
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Physical Count *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Actual count"
                placeholderTextColor="#64748B"
                value={takeForm.physical_count}
                onChangeText={(text) => setTakeForm({ ...takeForm, physical_count: text })}
                keyboardType="numeric"
              />
            </View>
            
            {selectedProduct && takeForm.physical_count && parseInt(takeForm.physical_count) !== selectedProduct.current_quantity && (
              <View style={styles.varianceInfo}>
                <Ionicons name="warning" size={20} color="#F59E0B" />
                <Text style={styles.varianceText}>
                  Variance: {parseInt(takeForm.physical_count) - selectedProduct.current_quantity} units
                </Text>
              </View>
            )}
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Variance Reason</Text>
              <TextInput
                style={[styles.formInput, styles.formTextArea]}
                placeholder="Explain any variance"
                placeholderTextColor="#64748B"
                value={takeForm.variance_reason}
                onChangeText={(text) => setTakeForm({ ...takeForm, variance_reason: text })}
                multiline
                numberOfLines={3}
              />
            </View>
            
            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: '#3B82F6' }, saving && styles.submitButtonDisabled]}
              onPress={submitStockTake}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Record Stock Take</Text>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  seedButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#334155',
    borderRadius: 8,
  },
  tabContainer: {
    maxHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 6,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#3B82F6',
  },
  tabText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 12,
    textAlign: 'center',
  },
  stockCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  stockInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  productCategory: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  stockQuantity: {
    alignItems: 'flex-end',
  },
  quantityText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#10B981',
  },
  quantityLow: {
    color: '#EF4444',
  },
  unitText: {
    fontSize: 12,
    color: '#64748B',
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  actionCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionInfo: {
    flex: 1,
  },
  actionProductName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionQuantity: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  movementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  movementIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  movementInfo: {
    flex: 1,
  },
  movementProduct: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  movementType: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  movementMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  movementQuantity: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalScrollContent: {
    maxHeight: '90%',
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
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  selectedProductInfo: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  selectedProductName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  selectedProductQty: {
    fontSize: 14,
    color: '#10B981',
    marginTop: 4,
  },
  sectionDivider: {
    borderTopWidth: 1,
    borderTopColor: '#334155',
    marginVertical: 16,
    paddingTop: 12,
  },
  sectionDividerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  formGroupHalf: {
    flex: 1,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 8,
  },
  formHint: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#334155',
  },
  formTextArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  reasonButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reasonButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#0F172A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  reasonButtonActive: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  reasonButtonText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  reasonButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  varianceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#422006',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  varianceText: {
    fontSize: 14,
    color: '#F59E0B',
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
