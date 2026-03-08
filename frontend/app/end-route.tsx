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

export default function EndRouteScreen() {
  const router = useRouter();
  const [activeRoute, setActiveRoute] = useState<any>(null);
  const [closingKm, setClosingKm] = useState('');
  const [cratesIn, setCratesIn] = useState('');
  const [damagesCount, setDamagesCount] = useState('');
  const [fuelUsed, setFuelUsed] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    loadActiveRoute();
  }, []);

  const loadActiveRoute = async () => {
    try {
      const data = await api.getActiveDailyRoute();
      setActiveRoute(data);
    } catch (error) {
      console.error('Error loading active route:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnd = async () => {
    if (!closingKm) {
      Alert.alert('Error', 'Please enter closing kilometers');
      return;
    }
    if (!cratesIn) {
      Alert.alert('Error', 'Please enter crates returned');
      return;
    }

    const closingKmNum = parseFloat(closingKm);
    if (closingKmNum < activeRoute.opening_km) {
      Alert.alert('Error', 'Closing KM must be greater than opening KM');
      return;
    }

    setEnding(true);
    try {
      await api.endDailyRoute(activeRoute.id, {
        closing_km: closingKmNum,
        crates_in: parseInt(cratesIn),
        damages_count: damagesCount ? parseInt(damagesCount) : 0,
        fuel_used: fuelUsed ? parseFloat(fuelUsed) : undefined,
        notes: notes || undefined,
      });
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to end route');
    } finally {
      setEnding(false);
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

  if (!activeRoute) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.noRouteContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#64748B" />
          <Text style={styles.noRouteText}>No active route to end</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const kmTraveled = closingKm ? parseFloat(closingKm) - activeRoute.opening_km : 0;
  const cratesBalance = cratesIn ? activeRoute.crates_out - parseInt(cratesIn) : activeRoute.crates_out;

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
          <Text style={styles.headerTitle}>End Route</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Route Summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.routeName}>{activeRoute.route_name}</Text>
            <View style={styles.summaryStats}>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryValue}>{activeRoute.sales_count}</Text>
                <Text style={styles.summaryLabel}>Sales</Text>
              </View>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryValue}>R {activeRoute.total_collected.toFixed(2)}</Text>
                <Text style={styles.summaryLabel}>Collected</Text>
              </View>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryValue}>{activeRoute.opening_km}</Text>
                <Text style={styles.summaryLabel}>Start KM</Text>
              </View>
            </View>
          </View>

          {/* Closing Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Closing Information</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Closing Kilometers *</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="speedometer-outline" size={20} color="#64748B" />
                <TextInput
                  style={styles.input}
                  placeholder="Enter current odometer reading"
                  placeholderTextColor="#64748B"
                  value={closingKm}
                  onChangeText={setClosingKm}
                  keyboardType="numeric"
                />
                <Text style={styles.inputSuffix}>km</Text>
              </View>
              {closingKm && kmTraveled > 0 && (
                <Text style={styles.inputHelper}>
                  Distance traveled: {kmTraveled.toFixed(1)} km
                </Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Crates Returned *</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="cube-outline" size={20} color="#64748B" />
                <TextInput
                  style={styles.input}
                  placeholder={`Crates out: ${activeRoute.crates_out}`}
                  placeholderTextColor="#64748B"
                  value={cratesIn}
                  onChangeText={setCratesIn}
                  keyboardType="numeric"
                />
                <Text style={styles.inputSuffix}>crates</Text>
              </View>
              {cratesIn && (
                <Text
                  style={[
                    styles.inputHelper,
                    cratesBalance !== 0 && { color: '#F59E0B' },
                  ]}
                >
                  {cratesBalance === 0
                    ? 'All crates accounted for'
                    : `${Math.abs(cratesBalance)} crates ${cratesBalance > 0 ? 'with customers' : 'extra'}`}
                </Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Damages Count</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="alert-circle-outline" size={20} color="#64748B" />
                <TextInput
                  style={styles.input}
                  placeholder="Number of damaged items"
                  placeholderTextColor="#64748B"
                  value={damagesCount}
                  onChangeText={setDamagesCount}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Fuel Used (Liters)</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="water-outline" size={20} color="#64748B" />
                <TextInput
                  style={styles.input}
                  placeholder="Fuel consumed"
                  placeholderTextColor="#64748B"
                  value={fuelUsed}
                  onChangeText={setFuelUsed}
                  keyboardType="numeric"
                />
                <Text style={styles.inputSuffix}>L</Text>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Notes</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Any comments or issues..."
                placeholderTextColor="#64748B"
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={4}
              />
            </View>
          </View>
        </ScrollView>

        {/* End Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.endButton, ending && styles.endButtonDisabled]}
            onPress={handleEnd}
            disabled={ending}
          >
            {ending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                <Text style={styles.endButtonText}>Complete Route</Text>
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
  noRouteContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  noRouteText: {
    fontSize: 18,
    color: '#94A3B8',
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
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
  summaryCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  routeName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryStat: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
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
  inputHelper: {
    fontSize: 12,
    color: '#10B981',
    marginTop: 8,
    marginLeft: 4,
  },
  textArea: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  endButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  endButtonDisabled: {
    opacity: 0.7,
  },
  endButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
