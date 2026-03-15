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

export default function CustomerRegisterScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Location state
  const [provinces, setProvinces] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [loadingLocations, setLoadingLocations] = useState(false);

  // Company matching
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  // Form state
  const [businessName, setBusinessName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');

  useEffect(() => {
    loadProvinces();
  }, []);

  const loadProvinces = async () => {
    try {
      const data = await api.request('GET', '/locations/provinces');
      setProvinces(data);
    } catch (error) {
      console.error('Failed to load provinces:', error);
    }
  };

  const selectProvince = async (province: string) => {
    setSelectedProvince(province);
    setSelectedDistrict('');
    setSelectedCity('');
    setDistricts([]);
    setAreas([]);
    setLoadingLocations(true);
    try {
      const data = await api.request('GET', `/locations/districts/${encodeURIComponent(province)}`);
      setDistricts(data);
    } catch (error) {
      console.error('Failed to load districts:', error);
    } finally {
      setLoadingLocations(false);
    }
  };

  const selectDistrict = async (district: string) => {
    setSelectedDistrict(district);
    setSelectedCity('');
    setAreas([]);
    setLoadingLocations(true);
    try {
      const data = await api.request('GET', `/locations/areas/${encodeURIComponent(selectedProvince)}/${encodeURIComponent(district)}`);
      setAreas(data);
    } catch (error) {
      console.error('Failed to load areas:', error);
    } finally {
      setLoadingLocations(false);
    }
  };

  const selectCity = async (city: string) => {
    setSelectedCity(city);
    // Skip company selection - marketplace model: customer can order from any company
    setStep(3);
  };

  const selectCompany = (company: Company | null) => {
    setSelectedCompany(company);
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

    setLoading(true);
    try {
      await api.registerCustomer({
        business_name: businessName,
        contact_person: contactPerson,
        phone,
        pin,
        delivery_address: deliveryAddress,
        province: selectedProvince,
        district: selectedDistrict,
        city: selectedCity,
      });

      await login(phone, pin);
      Alert.alert(
        'Welcome!',
        `Registration successful! You are now registered in ${selectedCity}, ${selectedProvince}.`,
        [{ text: 'Start Shopping', onPress: () => router.replace('/(customer-tabs)/shop') }]
      );
    } catch (error: any) {
      const msg = error.response?.data?.detail || error.message || 'Registration failed';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Location Selection
  const renderStep1 = () => (
    <View>
      <View style={styles.stepHeader}>
        <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>1</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.stepTitle}>Your Location</Text>
          <Text style={styles.stepSub}>Select your province, district & area</Text>
        </View>
      </View>

      {/* Province Selector */}
      <Text style={styles.selectorLabel}>Province</Text>
      {selectedProvince ? (
        <TouchableOpacity style={styles.selectedChip} onPress={() => { setSelectedProvince(''); setSelectedDistrict(''); setSelectedCity(''); setDistricts([]); setAreas([]); }}>
          <Ionicons name="location" size={18} color="#10B981" />
          <Text style={styles.selectedChipText}>{selectedProvince}</Text>
          <Ionicons name="close-circle" size={18} color="#64748B" />
        </TouchableOpacity>
      ) : (
        <ScrollView style={styles.optionsList} nestedScrollEnabled>
          {provinces.map((p) => (
            <TouchableOpacity key={p} style={styles.optionCard} onPress={() => selectProvince(p)}>
              <Ionicons name="navigate-outline" size={18} color="#3B82F6" />
              <Text style={styles.optionText}>{p}</Text>
              <Ionicons name="chevron-forward" size={16} color="#475569" />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* District Selector */}
      {selectedProvince && !selectedDistrict && (
        <>
          <Text style={[styles.selectorLabel, { marginTop: 16 }]}>District / Metro</Text>
          {loadingLocations ? (
            <ActivityIndicator color="#10B981" style={{ marginTop: 12 }} />
          ) : (
            <ScrollView style={styles.optionsList} nestedScrollEnabled>
              {districts.map((d) => (
                <TouchableOpacity key={d} style={styles.optionCard} onPress={() => selectDistrict(d)}>
                  <Ionicons name="map-outline" size={18} color="#F59E0B" />
                  <Text style={styles.optionText}>{d}</Text>
                  <Ionicons name="chevron-forward" size={16} color="#475569" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </>
      )}

      {selectedDistrict && (
        <TouchableOpacity style={[styles.selectedChip, { marginTop: 8 }]} onPress={() => { setSelectedDistrict(''); setSelectedCity(''); setAreas([]); }}>
          <Ionicons name="map" size={18} color="#F59E0B" />
          <Text style={styles.selectedChipText}>{selectedDistrict}</Text>
          <Ionicons name="close-circle" size={18} color="#64748B" />
        </TouchableOpacity>
      )}

      {/* Area/City Selector */}
      {selectedDistrict && !selectedCity && (
        <>
          <Text style={[styles.selectorLabel, { marginTop: 16 }]}>City / Town / Area</Text>
          {loadingLocations ? (
            <ActivityIndicator color="#10B981" style={{ marginTop: 12 }} />
          ) : (
            <ScrollView style={styles.optionsList} nestedScrollEnabled>
              {areas.map((a) => (
                <TouchableOpacity key={a} style={styles.optionCard} onPress={() => selectCity(a)}>
                  <Ionicons name="home-outline" size={18} color="#10B981" />
                  <Text style={styles.optionText}>{a}</Text>
                  <Ionicons name="chevron-forward" size={16} color="#475569" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </>
      )}
    </View>
  );

  // Step 2: Company Selection (optional)
  const renderStep2 = () => (
    <View>
      <TouchableOpacity onPress={() => { setStep(1); setSelectedCity(''); }} style={styles.backStepBtn}>
        <Ionicons name="arrow-back" size={20} color="#10B981" />
        <Text style={styles.backStepText}>Back to Location</Text>
      </TouchableOpacity>

      <View style={styles.stepHeader}>
        <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>2</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.stepTitle}>Choose a Supplier (Optional)</Text>
          <Text style={styles.stepSub}>You can browse all suppliers after registration</Text>
        </View>
      </View>

      <View style={styles.locationSummary}>
        <Ionicons name="location" size={16} color="#10B981" />
        <Text style={styles.locationSummaryText}>{selectedCity}, {selectedDistrict}, {selectedProvince}</Text>
      </View>

      <TouchableOpacity style={[styles.companyCard, styles.skipCard]} onPress={() => selectCompany(null)}>
        <View style={[styles.companyIcon, { backgroundColor: '#1E293B' }]}>
          <Ionicons name="globe-outline" size={24} color="#3B82F6" />
        </View>
        <View style={styles.companyInfo}>
          <Text style={styles.companyName}>Browse All Suppliers</Text>
          <Text style={styles.companyPhone}>Skip this step - choose later</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#64748B" />
      </TouchableOpacity>

      {companies.map((company) => (
        <TouchableOpacity key={company.id} style={styles.companyCard} onPress={() => selectCompany(company)}>
          <View style={styles.companyIcon}>
            <Ionicons name="business" size={24} color="#10B981" />
          </View>
          <View style={styles.companyInfo}>
            <Text style={styles.companyName}>{company.name}</Text>
            {company.phone ? <Text style={styles.companyPhone}>{company.phone}</Text> : null}
          </View>
          <Ionicons name="chevron-forward" size={20} color="#64748B" />
        </TouchableOpacity>
      ))}
    </View>
  );

  // Step 3: Details Form
  const renderStep3 = () => (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <TouchableOpacity onPress={() => setStep(2)} style={styles.backStepBtn}>
        <Ionicons name="arrow-back" size={20} color="#10B981" />
        <Text style={styles.backStepText}>Back</Text>
      </TouchableOpacity>

      <View style={styles.stepHeader}>
        <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>3</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.stepTitle}>Your Details</Text>
          <Text style={styles.stepSub}>{selectedCity}, {selectedProvince}{selectedCompany ? ` • ${selectedCompany.name}` : ''}</Text>
        </View>
      </View>

      <View style={styles.formCard}>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Business Name *</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="storefront-outline" size={20} color="#64748B" />
            <TextInput style={styles.textInput} placeholder="e.g. Sipho's Tuck Shop" placeholderTextColor="#475569" value={businessName} onChangeText={setBusinessName} />
          </View>
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Contact Person *</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="person-outline" size={20} color="#64748B" />
            <TextInput style={styles.textInput} placeholder="Your full name" placeholderTextColor="#475569" value={contactPerson} onChangeText={setContactPerson} autoCapitalize="words" />
          </View>
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Phone Number *</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="call-outline" size={20} color="#64748B" />
            <TextInput style={styles.textInput} placeholder="0812345678" placeholderTextColor="#475569" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          </View>
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Delivery Address</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="location-outline" size={20} color="#64748B" />
            <TextInput style={styles.textInput} placeholder="Street address" placeholderTextColor="#475569" value={deliveryAddress} onChangeText={setDeliveryAddress} />
          </View>
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Create 4-digit PIN *</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={20} color="#64748B" />
            <TextInput style={styles.textInput} placeholder="••••" placeholderTextColor="#475569" value={pin} onChangeText={(t) => setPin(t.replace(/[^0-9]/g, '').slice(0, 4))} keyboardType="number-pad" secureTextEntry maxLength={4} />
          </View>
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Confirm PIN *</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={20} color="#64748B" />
            <TextInput style={styles.textInput} placeholder="••••" placeholderTextColor="#475569" value={confirmPin} onChangeText={(t) => setConfirmPin(t.replace(/[^0-9]/g, '').slice(0, 4))} keyboardType="number-pad" secureTextEntry maxLength={4} />
          </View>
        </View>
        <TouchableOpacity style={[styles.registerBtn, loading && { opacity: 0.7 }]} onPress={handleRegister} disabled={loading}>
          {loading ? <ActivityIndicator color="#FFFFFF" /> : (
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
      <View style={styles.navHeader}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Customer Registration</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.progressRow}>
        {[1, 2, 3].map((s) => (
          <View key={s} style={[styles.progressDot, step >= s && styles.progressDotActive]} />
        ))}
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  navHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  navTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  progressRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 16 },
  progressDot: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#334155' },
  progressDotActive: { backgroundColor: '#10B981' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  stepHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 14 },
  stepBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center' },
  stepBadgeText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  stepTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  stepSub: { fontSize: 14, color: '#94A3B8', marginTop: 2 },
  backStepBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  backStepText: { fontSize: 14, fontWeight: '600', color: '#10B981' },
  selectorLabel: { fontSize: 14, fontWeight: '700', color: '#94A3B8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  selectedChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 12, padding: 14, gap: 10, borderWidth: 1, borderColor: '#10B981' },
  selectedChipText: { flex: 1, fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  optionsList: { maxHeight: 280 },
  optionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 10, padding: 14, marginBottom: 6, gap: 10 },
  optionText: { flex: 1, fontSize: 15, color: '#E2E8F0' },
  locationSummary: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16, backgroundColor: '#064E3B', borderRadius: 10, padding: 12 },
  locationSummaryText: { fontSize: 14, color: '#10B981', fontWeight: '600' },
  companyCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 14, padding: 16, marginBottom: 10 },
  skipCard: { borderWidth: 1, borderColor: '#3B82F6', borderStyle: 'dashed' },
  companyIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#064E3B', justifyContent: 'center', alignItems: 'center' },
  companyInfo: { flex: 1, marginLeft: 14 },
  companyName: { fontSize: 17, fontWeight: '600', color: '#FFFFFF' },
  companyPhone: { fontSize: 13, color: '#94A3B8', marginTop: 2 },
  formCard: { backgroundColor: '#1E293B', borderRadius: 14, padding: 18 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#94A3B8', marginBottom: 6 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F172A', borderRadius: 10, paddingHorizontal: 14, height: 50 },
  textInput: { flex: 1, marginLeft: 10, fontSize: 16, color: '#FFFFFF' },
  registerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#10B981', borderRadius: 14, paddingVertical: 16, marginTop: 8, gap: 8 },
  registerBtnText: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
});
