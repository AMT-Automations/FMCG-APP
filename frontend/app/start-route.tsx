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

export default function StartRouteScreen() {
  const router = useRouter();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [openingKm, setOpeningKm] = useState('');
  const [cratesOut, setCratesOut] = useState('');
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    loadRoutes();
  }, []);

  const loadRoutes = async () => {
    try {
      const data = await api.getRoutes();
      setRoutes(data);
    } catch (error) {
      console.error('Error loading routes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    if (!selectedRoute) {
      Alert.alert('Error', 'Please select a route');
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

    setStarting(true);
    try {
      await api.startDailyRoute({
        route_id: selectedRoute.id,
        opening_km: parseFloat(openingKm),
        crates_out: parseInt(cratesOut),
      });
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to start route');
    } finally {
      setStarting(false);
    }
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

          {/* Vehicle Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vehicle Information</Text>
            
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

          {/* Vehicle Checklist */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vehicle Checklist</Text>
            <View style={styles.checklistCard}>
              <ChecklistItem label="Tires in good condition" />
              <ChecklistItem label="Lights working" />
              <ChecklistItem label="Brakes checked" />
              <ChecklistItem label="Fuel level adequate" />
              <ChecklistItem label="Load secured" />
            </View>
          </View>
        </ScrollView>

        {/* Start Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.startButton, starting && styles.startButtonDisabled]}
            onPress={handleStart}
            disabled={starting}
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

function ChecklistItem({ label }: { label: string }) {
  const [checked, setChecked] = useState(false);

  return (
    <TouchableOpacity
      style={styles.checklistItem}
      onPress={() => setChecked(!checked)}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
      </View>
      <Text style={[styles.checklistLabel, checked && styles.checklistLabelChecked]}>
        {label}
      </Text>
    </TouchableOpacity>
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
    justifyContent: 'space-between',
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  routeList: {
    gap: 12,
  },
  routeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  routeCardSelected: {
    borderColor: '#3B82F6',
  },
  routeInfo: {
    flex: 1,
  },
  routeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  routeDescription: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  routeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  routeMetaText: {
    fontSize: 12,
    color: '#64748B',
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: '#3B82F6',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3B82F6',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    height: 52,
    fontSize: 16,
    color: '#FFFFFF',
    marginLeft: 12,
  },
  inputSuffix: {
    fontSize: 14,
    color: '#64748B',
  },
  checklistCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  checklistLabel: {
    fontSize: 14,
    color: '#94A3B8',
  },
  checklistLabelChecked: {
    color: '#FFFFFF',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  startButtonDisabled: {
    opacity: 0.7,
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
