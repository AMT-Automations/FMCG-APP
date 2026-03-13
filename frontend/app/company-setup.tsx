import React, { useState } from 'react';
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

export default function CompanySetupScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1: company details, 2: admin user, 3: success
  const [loading, setLoading] = useState(false);

  // Company fields
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');

  // Admin fields
  const [adminName, setAdminName] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const [result, setResult] = useState<any>(null);

  const validateStep1 = () => {
    if (!companyName.trim()) {
      Alert.alert('Error', 'Company name is required');
      return false;
    }
    if (!contactPerson.trim()) {
      Alert.alert('Error', 'Contact person is required');
      return false;
    }
    if (!companyPhone.trim()) {
      Alert.alert('Error', 'Company phone is required');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!adminName.trim()) {
      Alert.alert('Error', 'Admin name is required');
      return false;
    }
    if (!adminPhone.trim() || adminPhone.length < 10) {
      Alert.alert('Error', 'Valid phone number is required');
      return false;
    }
    if (!adminPin || adminPin.length !== 4) {
      Alert.alert('Error', 'PIN must be exactly 4 digits');
      return false;
    }
    if (adminPin !== confirmPin) {
      Alert.alert('Error', 'PINs do not match');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateStep2()) return;

    setLoading(true);
    try {
      const res = await api.setupCompany({
        company: {
          name: companyName,
          contact_person: contactPerson,
          phone: companyPhone,
          email: companyEmail || undefined,
          address: companyAddress || undefined,
        },
        admin_name: adminName,
        admin_phone: adminPhone,
        admin_pin: adminPin,
      });
      setResult(res);
      setStep(3);
    } catch (error: any) {
      Alert.alert(
        'Registration Failed',
        error.response?.data?.detail || 'Failed to register company. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#94A3B8" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Register Your Company</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Progress Steps */}
        <View style={styles.progressRow}>
          {[1, 2, 3].map((s) => (
            <View key={s} style={styles.progressItem}>
              <View style={[styles.progressDot, step >= s && styles.progressDotActive]}>
                {step > s ? (
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                ) : (
                  <Text style={[styles.progressNum, step >= s && styles.progressNumActive]}>{s}</Text>
                )}
              </View>
              <Text style={[styles.progressLabel, step >= s && styles.progressLabelActive]}>
                {s === 1 ? 'Company' : s === 2 ? 'Admin User' : 'Done'}
              </Text>
            </View>
          ))}
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Step 1: Company Details */}
          {step === 1 && (
            <View style={styles.stepContainer}>
              <View style={styles.stepIcon}>
                <Ionicons name="business-outline" size={40} color="#3B82F6" />
              </View>
              <Text style={styles.stepTitle}>Company Details</Text>
              <Text style={styles.stepDescription}>
                Tell us about your distribution company. This information will appear on reports and invoices.
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Company Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Mzansi Distribution"
                  placeholderTextColor="#475569"
                  value={companyName}
                  onChangeText={setCompanyName}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Contact Person *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Full name"
                  placeholderTextColor="#475569"
                  value={contactPerson}
                  onChangeText={setContactPerson}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Company Phone *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., 011 123 4567"
                  placeholderTextColor="#475569"
                  value={companyPhone}
                  onChangeText={setCompanyPhone}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="company@email.co.za"
                  placeholderTextColor="#475569"
                  value={companyEmail}
                  onChangeText={setCompanyEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Address (Optional)</Text>
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  placeholder="Physical address"
                  placeholderTextColor="#475569"
                  value={companyAddress}
                  onChangeText={setCompanyAddress}
                  multiline
                />
              </View>

              <TouchableOpacity
                style={styles.nextButton}
                onPress={() => {
                  if (validateStep1()) setStep(2);
                }}
              >
                <Text style={styles.nextButtonText}>Next: Admin Setup</Text>
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}

          {/* Step 2: Admin User */}
          {step === 2 && (
            <View style={styles.stepContainer}>
              <View style={styles.stepIcon}>
                <Ionicons name="person-outline" size={40} color="#10B981" />
              </View>
              <Text style={styles.stepTitle}>Admin Account</Text>
              <Text style={styles.stepDescription}>
                Create the admin account for your company. This person will manage all users, products, routes, and vehicles.
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Admin Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Full name"
                  placeholderTextColor="#475569"
                  value={adminName}
                  onChangeText={setAdminName}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Admin Phone Number *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., 0812345678"
                  placeholderTextColor="#475569"
                  value={adminPhone}
                  onChangeText={setAdminPhone}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>4-Digit PIN *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter 4-digit PIN"
                  placeholderTextColor="#475569"
                  value={adminPin}
                  onChangeText={setAdminPin}
                  keyboardType="numeric"
                  maxLength={4}
                  secureTextEntry
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Confirm PIN *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Re-enter PIN"
                  placeholderTextColor="#475569"
                  value={confirmPin}
                  onChangeText={setConfirmPin}
                  keyboardType="numeric"
                  maxLength={4}
                  secureTextEntry
                />
              </View>

              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.backButton} onPress={() => setStep(1)}>
                  <Ionicons name="arrow-back" size={20} color="#94A3B8" />
                  <Text style={styles.backButtonText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.nextButton, styles.submitButton]}
                  onPress={handleSubmit}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Text style={styles.nextButtonText}>Register</Text>
                      <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Step 3: Success */}
          {step === 3 && result && (
            <View style={styles.stepContainer}>
              <View style={[styles.stepIcon, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <Ionicons name="checkmark-circle" size={56} color="#10B981" />
              </View>
              <Text style={styles.stepTitle}>Company Registered!</Text>
              <Text style={styles.stepDescription}>
                Your company "{result.company_name}" has been set up successfully. You can now log in and start adding your products, routes, and vehicles.
              </Text>

              <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Company</Text>
                  <Text style={styles.infoValue}>{result.company_name}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Admin Phone</Text>
                  <Text style={styles.infoValue}>{result.admin_phone}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>PIN</Text>
                  <Text style={styles.infoValue}>The one you set</Text>
                </View>
              </View>

              <View style={styles.nextSteps}>
                <Text style={styles.nextStepsTitle}>Next Steps:</Text>
                <View style={styles.nextStep}>
                  <View style={styles.nextStepNum}><Text style={styles.nextStepNumText}>1</Text></View>
                  <Text style={styles.nextStepText}>Log in with your admin phone & PIN</Text>
                </View>
                <View style={styles.nextStep}>
                  <View style={styles.nextStepNum}><Text style={styles.nextStepNumText}>2</Text></View>
                  <Text style={styles.nextStepText}>Add your products (Profile → Manage Products)</Text>
                </View>
                <View style={styles.nextStep}>
                  <View style={styles.nextStepNum}><Text style={styles.nextStepNumText}>3</Text></View>
                  <Text style={styles.nextStepText}>Create routes & add vehicles (Profile → Admin)</Text>
                </View>
                <View style={styles.nextStep}>
                  <View style={styles.nextStepNum}><Text style={styles.nextStepNumText}>4</Text></View>
                  <Text style={styles.nextStepText}>Register your drivers & assign routes</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.nextButton, { marginTop: 24 }]}
                onPress={() => router.replace('/(auth)/login')}
              >
                <Ionicons name="log-in-outline" size={20} color="#FFFFFF" />
                <Text style={styles.nextButtonText}>Go to Login</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#334155',
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#FFFFFF' },
  progressRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 32, padding: 20,
    borderBottomWidth: 1, borderBottomColor: '#1E293B',
  },
  progressItem: { alignItems: 'center', gap: 6 },
  progressDot: {
    width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: '#334155',
    alignItems: 'center', justifyContent: 'center',
  },
  progressDotActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  progressNum: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  progressNumActive: { color: '#FFFFFF' },
  progressLabel: { fontSize: 11, color: '#64748B' },
  progressLabelActive: { color: '#FFFFFF' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  stepContainer: { alignItems: 'center' },
  stepIcon: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(59, 130, 246, 0.15)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  stepTitle: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', marginBottom: 8 },
  stepDescription: { fontSize: 14, color: '#94A3B8', textAlign: 'center', marginBottom: 28, lineHeight: 20 },
  inputGroup: { width: '100%', marginBottom: 16 },
  inputLabel: { fontSize: 13, color: '#94A3B8', marginBottom: 6, fontWeight: '500' },
  input: {
    backgroundColor: '#1E293B', borderRadius: 12, padding: 16, fontSize: 16, color: '#FFFFFF',
    borderWidth: 1, borderColor: '#334155',
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  nextButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#3B82F6', borderRadius: 12, padding: 16, gap: 8, width: '100%', marginTop: 12,
  },
  submitButton: { backgroundColor: '#10B981' },
  nextButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  buttonRow: { flexDirection: 'row', gap: 12, width: '100%', marginTop: 12 },
  backButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1E293B', borderRadius: 12, padding: 16, gap: 6, flex: 1,
  },
  backButtonText: { fontSize: 14, color: '#94A3B8' },
  infoCard: {
    backgroundColor: '#1E293B', borderRadius: 12, padding: 20, width: '100%', marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#334155',
  },
  infoLabel: { fontSize: 14, color: '#64748B' },
  infoValue: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  nextSteps: { width: '100%', marginTop: 8 },
  nextStepsTitle: { fontSize: 16, fontWeight: '600', color: '#FFFFFF', marginBottom: 12 },
  nextStep: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  nextStepNum: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: '#1E3A5F',
    alignItems: 'center', justifyContent: 'center',
  },
  nextStepNumText: { fontSize: 12, fontWeight: '700', color: '#3B82F6' },
  nextStepText: { fontSize: 14, color: '#94A3B8', flex: 1 },
});
