import React, { useEffect, useState } from 'react';
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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../src/services/api';

interface Route {
  id: string;
  name: string;
  description: string | null;
  customer_count: number;
}

interface Vehicle {
  id: string;
  registration: string;
  name: string;
  vehicle_type: string;
  capacity_crates: number;
  in_use?: boolean;
}

interface InspectionItem {
  id: string;
  label: string;
  category: string;
  passed: boolean | null; // null = not checked, true = pass, false = fail
  comment: string;
}

const INSPECTION_CATEGORIES = [
  {
    id: 'exterior',
    title: 'Exterior & Body',
    icon: 'car-outline' as const,
    items: [
      { id: 'body_damage', label: 'No body damage / dents' },
      { id: 'mirrors', label: 'Side mirrors intact & adjusted' },
      { id: 'windscreen', label: 'Windscreen clear, no cracks' },
      { id: 'headlights', label: 'Headlights working' },
      { id: 'taillights', label: 'Tail lights & brake lights working' },
      { id: 'indicators', label: 'Indicators working (both sides)' },
    ],
  },
  {
    id: 'tires',
    title: 'Tires & Wheels',
    icon: 'ellipse-outline' as const,
    items: [
      { id: 'tire_condition', label: 'Tires in good condition' },
      { id: 'tire_tread', label: 'Sufficient tread depth' },
      { id: 'tire_pressure', label: 'Tire pressure correct' },
      { id: 'spare_tire', label: 'Spare tire present & inflated' },
      { id: 'wheel_nuts', label: 'Wheel nuts tight' },
    ],
  },
  {
    id: 'engine_fluids',
    title: 'Engine & Fluids',
    icon: 'water-outline' as const,
    items: [
      { id: 'oil_level', label: 'Engine oil level OK' },
      { id: 'coolant', label: 'Coolant level OK' },
      { id: 'brake_fluid', label: 'Brake fluid level OK' },
      { id: 'power_steering', label: 'Power steering fluid OK' },
      { id: 'fuel_level', label: 'Fuel level adequate for route' },
    ],
  },
  {
    id: 'safety',
    title: 'Safety Equipment',
    icon: 'shield-checkmark-outline' as const,
    items: [
      { id: 'fire_extinguisher', label: 'Fire extinguisher present & in date' },
      { id: 'reflective_triangles', label: 'Reflective triangles (2x)' },
      { id: 'first_aid', label: 'First aid kit stocked' },
      { id: 'jack_spanner', label: 'Jack & wheel spanner present' },
      { id: 'reflective_vest', label: 'Reflective vest available' },
    ],
  },
  {
    id: 'controls',
    title: 'Interior & Controls',
    icon: 'settings-outline' as const,
    items: [
      { id: 'brakes', label: 'Foot brake working properly' },
      { id: 'handbrake', label: 'Handbrake holding' },
      { id: 'steering', label: 'Steering responsive, no play' },
      { id: 'horn', label: 'Horn working' },
      { id: 'seatbelts', label: 'Seatbelts working' },
      { id: 'wipers', label: 'Wipers & washers working' },
      { id: 'dashboard_lights', label: 'No warning lights on dashboard' },
    ],
  },
  {
    id: 'documents',
    title: 'Documentation',
    icon: 'document-text-outline' as const,
    items: [
      { id: 'license_disc', label: 'License disc valid & displayed' },
      { id: 'roadworthy', label: 'Roadworthy certificate valid' },
    ],
  },
];

export default function StartRouteScreen() {
  const router = useRouter();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [openingKm, setOpeningKm] = useState('');
  const [cratesOut, setCratesOut] = useState('');
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [inspectionItems, setInspectionItems] = useState<InspectionItem[]>([]);
  const [overallNotes, setOverallNotes] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<string | null>('exterior');

  useEffect(() => {
    loadData();
    // Initialize inspection items
    const items: InspectionItem[] = [];
    INSPECTION_CATEGORIES.forEach((cat) => {
      cat.items.forEach((item) => {
        items.push({
          id: item.id,
          label: item.label,
          category: cat.id,
          passed: null,
          comment: '',
        });
      });
    });
    setInspectionItems(items);
  }, []);

  const loadData = async () => {
    try {
      const [routesData, vehiclesData] = await Promise.all([
        api.getRoutes(),
        api.getAvailableVehicles(),
      ]);
      setRoutes(routesData);
      setVehicles(vehiclesData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = (itemId: string) => {
    setInspectionItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          // Cycle: null -> true -> false -> null
          const nextState = item.passed === null ? true : item.passed === true ? false : null;
          return { ...item, passed: nextState };
        }
        return item;
      })
    );
  };

  const setItemComment = (itemId: string, comment: string) => {
    setInspectionItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, comment } : item))
    );
  };

  const getInspectionSummary = () => {
    const total = inspectionItems.length;
    const passed = inspectionItems.filter((i) => i.passed === true).length;
    const failed = inspectionItems.filter((i) => i.passed === false).length;
    const unchecked = inspectionItems.filter((i) => i.passed === null).length;
    return { total, passed, failed, unchecked };
  };

  const getCategoryStats = (categoryId: string) => {
    const catItems = inspectionItems.filter((i) => i.category === categoryId);
    const passed = catItems.filter((i) => i.passed === true).length;
    const failed = catItems.filter((i) => i.passed === false).length;
    return { total: catItems.length, passed, failed };
  };

  const buildVehicleCheck = () => {
    const summary = getInspectionSummary();
    const categories: any = {};

    INSPECTION_CATEGORIES.forEach((cat) => {
      const catItems = inspectionItems.filter((i) => i.category === cat.id);
      categories[cat.id] = {
        title: cat.title,
        items: catItems.map((item) => ({
          id: item.id,
          label: item.label,
          passed: item.passed,
          comment: item.comment || null,
        })),
      };
    });

    return {
      inspection_date: new Date().toISOString(),
      summary: {
        total_items: summary.total,
        passed: summary.passed,
        failed: summary.failed,
        unchecked: summary.unchecked,
        pass_rate: summary.total > 0 ? Math.round((summary.passed / summary.total) * 100) : 0,
      },
      categories,
      overall_notes: overallNotes || null,
      failed_items: inspectionItems
        .filter((i) => i.passed === false)
        .map((i) => ({ id: i.id, label: i.label, comment: i.comment })),
    };
  };

  const handleStart = async () => {
    if (!selectedRoute) {
      Alert.alert('Error', 'Please select a route');
      return;
    }
    if (!selectedVehicle) {
      Alert.alert('Error', 'Please select a vehicle');
      return;
    }
    if (!openingKm) {
      Alert.alert('Error', 'Please enter opening kilometers');
      return;
    }
    if (!cratesOut) {
      Alert.alert('Error', 'Please enter crates out');
      return;
    }

    const summary = getInspectionSummary();
    if (summary.unchecked > 0) {
      Alert.alert(
        'Incomplete Inspection',
        `You have ${summary.unchecked} unchecked items. Do you want to continue anyway?`,
        [
          { text: 'Go Back', style: 'cancel' },
          { text: 'Continue', onPress: () => doStart() },
        ]
      );
      return;
    }

    if (summary.failed > 0) {
      Alert.alert(
        'Failed Inspection Items',
        `${summary.failed} item(s) failed inspection. Are you sure you want to start the route?`,
        [
          { text: 'Go Back', style: 'cancel' },
          { text: 'Start Anyway', style: 'destructive', onPress: () => doStart() },
        ]
      );
      return;
    }

    doStart();
  };

  const doStart = async () => {
    setStarting(true);
    try {
      await api.startDailyRoute({
        route_id: selectedRoute!.id,
        vehicle_id: selectedVehicle!.id,
        opening_km: parseFloat(openingKm),
        crates_out: parseInt(cratesOut),
        vehicle_check: buildVehicleCheck(),
      });
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to start route');
    } finally {
      setStarting(false);
    }
  };

  const availableVehicles = vehicles.filter((v) => !v.in_use);
  const inUseVehicles = vehicles.filter((v) => v.in_use);
  const inspectionSummary = getInspectionSummary();

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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
            <Ionicons name="close" size={24} color="#94A3B8" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Start Route</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Route Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Route</Text>
            <View style={styles.routeList}>
              {routes.map((route) => (
                <TouchableOpacity
                  key={route.id}
                  style={[
                    styles.routeCard,
                    selectedRoute?.id === route.id && styles.routeCardSelected,
                  ]}
                  onPress={() => setSelectedRoute(route)}
                >
                  <View style={styles.routeInfo}>
                    <Text style={styles.routeName}>{route.name}</Text>
                    {route.description && (
                      <Text style={styles.routeDescription}>{route.description}</Text>
                    )}
                    <View style={styles.routeMeta}>
                      <Ionicons name="people-outline" size={14} color="#64748B" />
                      <Text style={styles.routeMetaText}>
                        {route.customer_count} customers
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.radioOuter,
                      selectedRoute?.id === route.id && styles.radioOuterSelected,
                    ]}
                  >
                    {selectedRoute?.id === route.id && <View style={styles.radioInner} />}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Vehicle Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Vehicle</Text>
            {availableVehicles.length === 0 ? (
              <View style={styles.noVehiclesCard}>
                <Ionicons name="car-outline" size={32} color="#64748B" />
                <Text style={styles.noVehiclesText}>No vehicles available</Text>
                <Text style={styles.noVehiclesSubtext}>All vehicles are currently in use</Text>
              </View>
            ) : (
              <View style={styles.vehicleList}>
                {availableVehicles.map((vehicle) => (
                  <TouchableOpacity
                    key={vehicle.id}
                    style={[
                      styles.vehicleCard,
                      selectedVehicle?.id === vehicle.id && styles.vehicleCardSelected,
                    ]}
                    onPress={() => setSelectedVehicle(vehicle)}
                  >
                    <View style={styles.vehicleIcon}>
                      <Ionicons
                        name={vehicle.vehicle_type === 'van' ? 'bus-outline' : vehicle.vehicle_type === 'bakkie' ? 'car-sport-outline' : 'car-outline'}
                        size={24}
                        color={selectedVehicle?.id === vehicle.id ? '#3B82F6' : '#64748B'}
                      />
                    </View>
                    <View style={styles.vehicleInfo}>
                      <Text style={styles.vehicleName}>{vehicle.name}</Text>
                      <Text style={styles.vehicleReg}>{vehicle.registration}</Text>
                      <View style={styles.vehicleMeta}>
                        <Ionicons name="cube-outline" size={12} color="#64748B" />
                        <Text style={styles.vehicleMetaText}>
                          {vehicle.capacity_crates} crates capacity
                        </Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.radioOuter,
                        selectedVehicle?.id === vehicle.id && styles.radioOuterSelected,
                      ]}
                    >
                      {selectedVehicle?.id === vehicle.id && <View style={styles.radioInner} />}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {inUseVehicles.length > 0 && (
              <View style={styles.inUseSection}>
                <Text style={styles.inUseTitle}>Currently In Use</Text>
                {inUseVehicles.map((vehicle) => (
                  <View key={vehicle.id} style={styles.inUseVehicle}>
                    <Ionicons name="car-outline" size={16} color="#64748B" />
                    <Text style={styles.inUseText}>{vehicle.name} ({vehicle.registration})</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Route Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Route Information</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Opening Kilometers</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="speedometer-outline" size={20} color="#64748B" />
                <TextInput
                  style={styles.input}
                  placeholder="Enter current odometer reading"
                  placeholderTextColor="#64748B"
                  value={openingKm}
                  onChangeText={setOpeningKm}
                  keyboardType="numeric"
                />
                <Text style={styles.inputSuffix}>km</Text>
              </View>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Crates Out</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="cube-outline" size={20} color="#64748B" />
                <TextInput
                  style={styles.input}
                  placeholder="Number of crates loaded"
                  placeholderTextColor="#64748B"
                  value={cratesOut}
                  onChangeText={setCratesOut}
                  keyboardType="numeric"
                />
                <Text style={styles.inputSuffix}>crates</Text>
              </View>
            </View>
          </View>

          {/* ===== VEHICLE INSPECTION ===== */}
          <View style={styles.section}>
            <View style={styles.inspectionHeader}>
              <Text style={styles.sectionTitle}>Vehicle Inspection</Text>
              <View style={styles.inspectionBadges}>
                <View style={[styles.badge, styles.badgeGreen]}>
                  <Text style={styles.badgeText}>{inspectionSummary.passed} Pass</Text>
                </View>
                {inspectionSummary.failed > 0 && (
                  <View style={[styles.badge, styles.badgeRed]}>
                    <Text style={styles.badgeText}>{inspectionSummary.failed} Fail</Text>
                  </View>
                )}
                {inspectionSummary.unchecked > 0 && (
                  <View style={[styles.badge, styles.badgeGray]}>
                    <Text style={styles.badgeText}>{inspectionSummary.unchecked} Left</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Progress bar */}
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${inspectionSummary.total > 0 ? ((inspectionSummary.passed + inspectionSummary.failed) / inspectionSummary.total) * 100 : 0}%`,
                    backgroundColor: inspectionSummary.failed > 0 ? '#F59E0B' : '#10B981',
                  },
                ]}
              />
            </View>

            {/* Inspection Categories */}
            {INSPECTION_CATEGORIES.map((category) => {
              const stats = getCategoryStats(category.id);
              const isExpanded = expandedCategory === category.id;
              const catItems = inspectionItems.filter((i) => i.category === category.id);

              return (
                <View key={category.id} style={styles.categoryCard}>
                  <TouchableOpacity
                    style={styles.categoryHeader}
                    onPress={() => setExpandedCategory(isExpanded ? null : category.id)}
                  >
                    <View style={styles.categoryLeft}>
                      <View style={styles.categoryIconWrap}>
                        <Ionicons name={category.icon} size={20} color="#3B82F6" />
                      </View>
                      <View>
                        <Text style={styles.categoryTitle}>{category.title}</Text>
                        <Text style={styles.categoryStats}>
                          {stats.passed}/{stats.total} passed
                          {stats.failed > 0 ? ` · ${stats.failed} failed` : ''}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.categoryRight}>
                      {stats.passed === stats.total && stats.total > 0 ? (
                        <Ionicons name="checkmark-circle" size={22} color="#10B981" />
                      ) : stats.failed > 0 ? (
                        <Ionicons name="alert-circle" size={22} color="#EF4444" />
                      ) : null}
                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color="#64748B"
                      />
                    </View>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.categoryItems}>
                      {catItems.map((item) => (
                        <View key={item.id} style={styles.inspectionItemWrap}>
                          <View style={styles.inspectionItemRow}>
                            <TouchableOpacity
                              style={[
                                styles.inspCheckbox,
                                item.passed === true && styles.inspCheckboxPass,
                                item.passed === false && styles.inspCheckboxFail,
                              ]}
                              onPress={() => toggleItem(item.id)}
                            >
                              {item.passed === true && (
                                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                              )}
                              {item.passed === false && (
                                <Ionicons name="close" size={16} color="#FFFFFF" />
                              )}
                            </TouchableOpacity>
                            <Text
                              style={[
                                styles.inspItemLabel,
                                item.passed === true && styles.inspItemLabelPass,
                                item.passed === false && styles.inspItemLabelFail,
                              ]}
                            >
                              {item.label}
                            </Text>
                          </View>
                          {/* Comment input - always visible for failed, toggle for others */}
                          {(item.passed === false || item.comment.length > 0) && (
                            <TextInput
                              style={styles.itemComment}
                              placeholder={item.passed === false ? 'Describe the issue...' : 'Add a note...'}
                              placeholderTextColor="#475569"
                              value={item.comment}
                              onChangeText={(text) => setItemComment(item.id, text)}
                              multiline
                            />
                          )}
                          {item.passed !== false && item.comment.length === 0 && (
                            <TouchableOpacity
                              style={styles.addCommentBtn}
                              onPress={() => setItemComment(item.id, ' ')}
                            >
                              <Ionicons name="chatbubble-outline" size={12} color="#64748B" />
                              <Text style={styles.addCommentText}>Add note</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}

            {/* Overall Notes */}
            <View style={styles.overallNotesCard}>
              <Text style={styles.overallNotesLabel}>Overall Inspection Notes</Text>
              <TextInput
                style={styles.overallNotesInput}
                placeholder="Any general comments about the vehicle condition..."
                placeholderTextColor="#475569"
                value={overallNotes}
                onChangeText={setOverallNotes}
                multiline
                numberOfLines={3}
              />
            </View>
          </View>
        </ScrollView>

        {/* Start Button */}
        <View style={styles.footer}>
          <View style={styles.footerInfo}>
            <Text style={styles.footerInfoText}>
              {inspectionSummary.passed}/{inspectionSummary.total} items checked
            </Text>
            {inspectionSummary.failed > 0 && (
              <Text style={styles.footerWarning}>
                {inspectionSummary.failed} failed item(s)
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={[
              styles.startButton,
              (starting || !selectedRoute || !selectedVehicle) && styles.startButtonDisabled,
            ]}
            onPress={handleStart}
            disabled={starting || !selectedRoute || !selectedVehicle}
          >
            {starting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="play" size={20} color="#FFFFFF" />
                <Text style={styles.startButtonText}>Start Route</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  keyboardView: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#334155',
  },
  closeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#FFFFFF' },
  placeholder: { width: 40 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#FFFFFF', marginBottom: 12 },

  // Route Selection
  routeList: { gap: 12 },
  routeCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B',
    borderRadius: 12, padding: 16, borderWidth: 2, borderColor: 'transparent',
  },
  routeCardSelected: { borderColor: '#3B82F6' },
  routeInfo: { flex: 1 },
  routeName: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  routeDescription: { fontSize: 12, color: '#94A3B8', marginTop: 4 },
  routeMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 4 },
  routeMetaText: { fontSize: 12, color: '#64748B' },
  radioOuter: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#475569',
    alignItems: 'center', justifyContent: 'center',
  },
  radioOuterSelected: { borderColor: '#3B82F6' },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#3B82F6' },

  // Vehicle Selection
  vehicleList: { gap: 12 },
  vehicleCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B',
    borderRadius: 12, padding: 16, borderWidth: 2, borderColor: 'transparent',
  },
  vehicleCardSelected: { borderColor: '#3B82F6' },
  vehicleIcon: {
    width: 48, height: 48, borderRadius: 12, backgroundColor: '#0F172A',
    alignItems: 'center', justifyContent: 'center',
  },
  vehicleInfo: { flex: 1, marginLeft: 12 },
  vehicleName: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  vehicleReg: { fontSize: 14, color: '#94A3B8', marginTop: 2 },
  vehicleMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
  vehicleMetaText: { fontSize: 12, color: '#64748B' },
  noVehiclesCard: {
    backgroundColor: '#1E293B', borderRadius: 12, padding: 32, alignItems: 'center',
    borderWidth: 1, borderColor: '#334155', borderStyle: 'dashed',
  },
  noVehiclesText: { fontSize: 16, fontWeight: '600', color: '#94A3B8', marginTop: 12 },
  noVehiclesSubtext: { fontSize: 12, color: '#64748B', marginTop: 4 },
  inUseSection: { marginTop: 16, padding: 12, backgroundColor: '#1E293B', borderRadius: 8 },
  inUseTitle: { fontSize: 12, fontWeight: '600', color: '#64748B', marginBottom: 8 },
  inUseVehicle: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  inUseText: { fontSize: 12, color: '#64748B' },

  // Input fields
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 14, color: '#94A3B8', marginBottom: 8 },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B',
    borderRadius: 12, paddingHorizontal: 16,
  },
  input: { flex: 1, height: 52, fontSize: 16, color: '#FFFFFF', marginLeft: 12 },
  inputSuffix: { fontSize: 14, color: '#64748B' },

  // Inspection Header
  inspectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
  },
  inspectionBadges: { flexDirection: 'row', gap: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeGreen: { backgroundColor: 'rgba(16, 185, 129, 0.2)' },
  badgeRed: { backgroundColor: 'rgba(239, 68, 68, 0.2)' },
  badgeGray: { backgroundColor: 'rgba(148, 163, 184, 0.2)' },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#FFFFFF' },

  // Progress bar
  progressBar: {
    height: 6, backgroundColor: '#334155', borderRadius: 3, marginBottom: 16, overflow: 'hidden',
  },
  progressFill: { height: 6, borderRadius: 3 },

  // Category cards
  categoryCard: {
    backgroundColor: '#1E293B', borderRadius: 12, marginBottom: 10, overflow: 'hidden',
  },
  categoryHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 14,
  },
  categoryLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  categoryIconWrap: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: '#1E3A5F',
    alignItems: 'center', justifyContent: 'center',
  },
  categoryTitle: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  categoryStats: { fontSize: 11, color: '#64748B', marginTop: 2 },
  categoryRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  // Inspection items
  categoryItems: {
    borderTopWidth: 1, borderTopColor: '#334155', paddingHorizontal: 14, paddingBottom: 12,
  },
  inspectionItemWrap: { paddingTop: 12 },
  inspectionItemRow: { flexDirection: 'row', alignItems: 'center' },
  inspCheckbox: {
    width: 28, height: 28, borderRadius: 8, borderWidth: 2, borderColor: '#475569',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  inspCheckboxPass: { backgroundColor: '#10B981', borderColor: '#10B981' },
  inspCheckboxFail: { backgroundColor: '#EF4444', borderColor: '#EF4444' },
  inspItemLabel: { fontSize: 14, color: '#94A3B8', flex: 1 },
  inspItemLabelPass: { color: '#FFFFFF' },
  inspItemLabelFail: { color: '#FCA5A5' },

  // Item comments
  itemComment: {
    backgroundColor: '#0F172A', borderRadius: 8, padding: 10, marginTop: 8, marginLeft: 40,
    fontSize: 13, color: '#FFFFFF', minHeight: 36,
  },
  addCommentBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, marginLeft: 40,
    paddingVertical: 4,
  },
  addCommentText: { fontSize: 11, color: '#64748B' },

  // Overall notes
  overallNotesCard: {
    backgroundColor: '#1E293B', borderRadius: 12, padding: 16, marginTop: 12,
  },
  overallNotesLabel: { fontSize: 14, fontWeight: '600', color: '#94A3B8', marginBottom: 10 },
  overallNotesInput: {
    backgroundColor: '#0F172A', borderRadius: 10, padding: 14,
    fontSize: 14, color: '#FFFFFF', minHeight: 80, textAlignVertical: 'top',
  },

  // Footer
  footer: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    borderTopWidth: 1, borderTopColor: '#334155', gap: 16,
  },
  footerInfo: { flex: 1 },
  footerInfoText: { fontSize: 13, color: '#94A3B8' },
  footerWarning: { fontSize: 12, color: '#F59E0B', marginTop: 2 },
  startButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#3B82F6', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 14, gap: 8,
  },
  startButtonDisabled: { opacity: 0.5 },
  startButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});
