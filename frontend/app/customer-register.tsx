import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../src/services/api';
import { useAuth } from '../src/context/AuthContext';

interface Company {
  id: string;
  name: string;
  phone: string;
}

interface Route {
  id: string;
  name: string;
  description: string;
  delivery_days: string[];
  cut_off_time: string;
}

export default function CustomerRegisterScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [loadingRoutes, setLoadingRoutes] = useState(false);

  // Form state
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      const data = await api.listCompanies();
      setCompanies(data);
    } catch (error) {
      console.error('Failed to load companies:', error);
      Alert.alert('Error', 'Failed to load companies. Please try again.');
    } finally {
      setLoadingCompanies(false);
    }
  };

  const selectCompany = async (company: Company) => {
    setSelectedCompany(company);
    setLoadingRoutes(true);
    try {
      const data = await api.listCompanyRoutes(company.id);
      setRoutes(data);
      setStep(2);
    } catch (error) {
      console.error('Failed to load routes:', error);
      Alert.alert('Error', 'Failed to load delivery areas.');
    } finally {
      setLoadingRoutes(false);
    }
  };

  const selectRoute = (route: Route) => {
    setSelectedRoute(route);
    setStep(3);
  };

  const handleRegister = async () => {
    if (!businessName || !contactPerson || !phone || !pin) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    if (pin.length !== 4) {
      Alert.alert('Error', 'PIN must be 4 digits');
      return;
    }
    if (pin !== confirmPin) {
      Alert.alert('Error', 'PINs do not match');
      return;
    }
    if (!selectedCompany || !selectedRoute) {
      Alert.alert('Error', 'Please select a company and delivery area');
      return;
    }

    setLoading(true);
    try {
      await api.registerCustomer({
        business_name: businessName,
        contact_person: contactPerson,
        phone,
        pin,
        delivery_address: deliveryAddress,
        company_id: selectedCompany.id,
        route_id: selectedRoute.id,
      });

      // Auto-login
      await login(phone, pin);

      Alert.alert(
        'Welcome!',
        `Registration successful!\n\nYou are now registered with ${selectedCompany.name}.`,
        [{ text: 'Start Shopping', onPress: () => router.replace('/(customer-tabs)/shop') }]
      );
    } catch (error: any) {
      const msg = error.response?.data?.detail || error.message || 'Registration failed';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <View>
      <View style={styles.stepHeader}>
        <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>1</Text></View>
        <View>
          <Text style={styles.stepTitle}>Select Your Distributor</Text>
          <Text style={styles.stepSub}>Choose the company you want to order from</Text>
        </View>
      </View>

      {loadingCompanies ? (
        <ActivityIndicator size="large" color="#10B981" style={{ marginTop: 40 }} />
      ) : companies.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="business-outline" size={48} color="#475569" />
          <Text style={styles.emptyText}>No distributors available yet</Text>
        </View>
      ) : (
        companies.map((company) => (
          <TouchableOpacity
            key={company.id}
            style={styles.companyCard}
            onPress={() => selectCompany(company)}
          >
            <View style={styles.companyIcon}>
              <Ionicons name="business" size={24} color="#10B981" />
            </View>
            <View style={styles.companyInfo}>
              <Text style={styles.companyName}>{company.name}</Text>
              {company.phone ? <Text style={styles.companyPhone}>{company.phone}</Text> : null}
            </View>
            <Ionicons name="chevron-forward" size={20} color="#64748B" />
          </TouchableOpacity>
        ))
      )}
    </View>
  );

  const renderStep2 = () => (
    <View>
      <TouchableOpacity onPress={() => setStep(1)} style={styles.backStepBtn}>
        <Ionicons name="arrow-back" size={20} color="#10B981" />
        <Text style={styles.backStepText}>Back to Companies</Text>
      </TouchableOpacity>

      <View style={styles.stepHeader}>
        <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>2</Text></View>
        <View>
          <Text style={styles.stepTitle}>Select Delivery Area</Text>
          <Text style={styles.stepSub}>From {selectedCompany?.name}</Text>
        </View>
      </View>

      {loadingRoutes ? (
        <ActivityIndicator size="large" color="#10B981" style={{ marginTop: 40 }} />
      ) : routes.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="map-outline" size={48} color="#475569" />
          <Text style={styles.emptyText}>No delivery areas available</Text>
          <Text style={styles.emptySubText}>This distributor hasn't set up delivery areas yet</Text>
        </View>
      ) : (
        routes.map((route) => (
          <TouchableOpacity
            key={route.id}
            style={styles.routeCard}
            onPress={() => selectRoute(route)}
          >
            <View style={styles.routeIcon}>
              <Ionicons name="map" size={22} color="#10B981" />
            </View>
            <View style={styles.routeInfo}>
              <Text style={styles.routeName}>{route.name}</Text>
              {route.description ? <Text style={styles.routeDesc}>{route.description}</Text> : null}
              {route.delivery_days.length > 0 && (
                <View style={styles.deliveryDaysRow}>
                  {route.delivery_days.map((day) => (
                    <View key={day} style={styles.dayChip}>
                      <Text style={styles.dayChipText}>{day.slice(0, 3)}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
            <Ionicons name="chevron-forward" size={20} color="#64748B" />
          </TouchableOpacity>
        ))
      )}
    </View>
  );

  const renderStep3 = () => (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <TouchableOpacity onPress={() => setStep(2)} style={styles.backStepBtn}>
        <Ionicons name="arrow-back" size={20} color="#10B981" />
        <Text style={styles.backStepText}>Back to Areas</Text>
      </TouchableOpacity>

      <View style={styles.stepHeader}>
        <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>3</Text></View>
        <View>
          <Text style={styles.stepTitle}>Your Details</Text>
          <Text style={styles.stepSub}>{selectedCompany?.name} → {selectedRoute?.name}</Text>
        </View>
      </View>

      <View style={styles.formCard}>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Business Name *</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="storefront-outline" size={20} color="#64748B" />
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Sipho's Tuck Shop"
              placeholderTextColor="#475569"
              value={businessName}
              onChangeText={setBusinessName}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Contact Person *</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="person-outline" size={20} color="#64748B" />
            <TextInput
              style={styles.textInput}
              placeholder="Your full name"
              placeholderTextColor="#475569"
              value={contactPerson}
              onChangeText={setContactPerson}
              autoCapitalize="words"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Phone Number *</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="call-outline" size={20} color="#64748B" />
            <TextInput
              style={styles.textInput}
              placeholder="0812345678"
              placeholderTextColor="#475569"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Delivery Address</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="location-outline" size={20} color="#64748B" />
            <TextInput
              style={styles.textInput}
              placeholder="Street address"
              placeholderTextColor="#475569"
              value={deliveryAddress}
              onChangeText={setDeliveryAddress}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Create 4-digit PIN *</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={20} color="#64748B" />
            <TextInput
              style={styles.textInput}
              placeholder="••••"
              placeholderTextColor="#475569"
              value={pin}
              onChangeText={(t) => setPin(t.replace(/[^0-9]/g, '').slice(0, 4))}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Confirm PIN *</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={20} color="#64748B" />
            <TextInput
              style={styles.textInput}
              placeholder="••••"
              placeholderTextColor="#475569"
              value={confirmPin}
              onChangeText={(t) => setConfirmPin(t.replace(/[^0-9]/g, '').slice(0, 4))}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.registerBtn, loading && { opacity: 0.7 }]}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
              <Text style={styles.registerBtnText}>Create Account</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.navHeader}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Customer Registration</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Progress */}
      <View style={styles.progressRow}>
        {[1, 2, 3].map((s) => (
          <View key={s} style={[styles.progressDot, step >= s && styles.progressDotActive]} />
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  navHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  navTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  progressRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 16,
  },
  progressDot: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#334155',
  },
  progressDotActive: { backgroundColor: '#10B981' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  stepHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 14 },
  stepBadge: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#10B981',
    justifyContent: 'center', alignItems: 'center',
  },
  stepBadgeText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  stepTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  stepSub: { fontSize: 14, color: '#94A3B8', marginTop: 2 },
  backStepBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16,
  },
  backStepText: { fontSize: 14, fontWeight: '600', color: '#10B981' },
  companyCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B',
    borderRadius: 14, padding: 16, marginBottom: 10,
  },
  companyIcon: {
    width: 48, height: 48, borderRadius: 12, backgroundColor: '#064E3B',
    justifyContent: 'center', alignItems: 'center',
  },
  companyInfo: { flex: 1, marginLeft: 14 },
  companyName: { fontSize: 17, fontWeight: '600', color: '#FFFFFF' },
  companyPhone: { fontSize: 13, color: '#94A3B8', marginTop: 2 },
  routeCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B',
    borderRadius: 14, padding: 16, marginBottom: 10,
  },
  routeIcon: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: '#064E3B',
    justifyContent: 'center', alignItems: 'center',
  },
  routeInfo: { flex: 1, marginLeft: 14 },
  routeName: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  routeDesc: { fontSize: 13, color: '#94A3B8', marginTop: 2 },
  deliveryDaysRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  dayChip: {
    backgroundColor: '#064E3B', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  dayChipText: { fontSize: 11, fontWeight: '600', color: '#10B981' },
  emptyState: { alignItems: 'center', paddingTop: 40 },
  emptyText: { fontSize: 16, color: '#94A3B8', marginTop: 12 },
  emptySubText: { fontSize: 14, color: '#475569', marginTop: 4, textAlign: 'center' },
  formCard: { backgroundColor: '#1E293B', borderRadius: 14, padding: 18 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#94A3B8', marginBottom: 6 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F172A',
    borderRadius: 10, paddingHorizontal: 14, height: 50,
  },
  textInput: { flex: 1, marginLeft: 10, fontSize: 16, color: '#FFFFFF' },
  registerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#10B981', borderRadius: 14, paddingVertical: 16,
    marginTop: 8, gap: 8,
  },
  registerBtnText: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
});
