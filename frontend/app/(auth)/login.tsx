import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/services/api';

export default function LoginScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const { login, register } = useAuth();
  const router = useRouter();

  const handleSubmit = async () => {
    console.log('handleSubmit called', { phone, pin, isLogin });
    if (!phone || !pin) {
      Alert.alert('Error', 'Please enter phone number and PIN');
      return;
    }
    if (!isLogin && !name) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }
    if (pin.length !== 4) {
      Alert.alert('Error', 'PIN must be 4 digits');
      return;
    }

    setLoading(true);
    try {
      console.log('Attempting login...');
      let loggedInUser: any;
      if (isLogin) {
        loggedInUser = await login(phone, pin);
        console.log('Login successful, navigating...');
      } else {
        await register(name, phone, pin);
        console.log('Registration successful, navigating...');
        loggedInUser = { role: 'driver' }; // Default for register
      }
      // Route based on user role
      setTimeout(() => {
        if (loggedInUser?.role === 'customer') {
          console.log('Navigating to customer tabs...');
          router.replace('/(customer-tabs)/shop');
        } else {
          console.log('Navigating to distributor tabs...');
          router.replace('/(tabs)');
        }
      }, 100);
    } catch (error: any) {
      console.error('Login error:', error);
      Alert.alert('Error', error.message);
      setLoading(false);
    }
  };

  const handleSeedData = async () => {
    setSeeding(true);
    try {
      const result = await api.seedAll();
      const demoLogin = result.demo_logins?.driver || result.demo_login || { phone: '0812345678', pin: '1234' };
      Alert.alert(
        'Success',
        `Sample data created!\n\nDemo Driver Login:\nPhone: ${demoLogin.phone}\nPIN: ${demoLogin.pin}`,
        [
          {
            text: 'Use Demo Login',
            onPress: () => {
              setPhone(demoLogin.phone);
              setPin(demoLogin.pin);
            },
          },
          { text: 'OK' },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', 'Failed to seed data');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Image
                source={require('../../assets/icon.png')}
                style={styles.logo}
                resizeMode="cover"
              />
            </View>
            <Text style={styles.appName}>Mzansi FMCG Tracker</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.formTitle}>
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </Text>
            <Text style={styles.formSubtitle}>
              {isLogin ? 'Sign in to continue' : 'Register to get started'}
            </Text>

            {!isLogin && (
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color="#64748B" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Full Name"
                  placeholderTextColor="#64748B"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>
            )}

            <View style={styles.inputContainer}>
              <Ionicons name="call-outline" size={20} color="#64748B" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Phone Number"
                placeholderTextColor="#64748B"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#64748B" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="4-digit PIN"
                placeholderTextColor="#64748B"
                value={pin}
                onChangeText={(text) => setPin(text.replace(/[^0-9]/g, '').slice(0, 4))}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={4}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.submitButton, 
                loading && styles.submitButtonDisabled,
              ]}
              onPress={() => {
                console.log('Sign In button pressed');
                handleSubmit();
              }}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {isLogin ? 'Sign In' : 'Create Account'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchButton}
              onPress={() => setIsLogin(!isLogin)}
            >
              <Text style={styles.switchText}>
                {isLogin ? "Don't have an account? " : 'Already have an account? '}
                <Text style={styles.switchTextBold}>
                  {isLogin ? 'Register' : 'Sign In'}
                </Text>
              </Text>
            </TouchableOpacity>

            {/* New Company Registration */}
            <TouchableOpacity
              style={styles.companySetupButton}
              onPress={() => router.push('/company-setup')}
            >
              <Ionicons name="business-outline" size={18} color="#3B82F6" />
              <Text style={styles.companySetupText}>Register a New Company</Text>
            </TouchableOpacity>

            {/* Customer Registration */}
            <TouchableOpacity
              style={styles.customerRegisterButton}
              onPress={() => router.push('/customer-register')}
            >
              <Ionicons name="cart-outline" size={18} color="#10B981" />
              <Text style={styles.customerRegisterText}>Register as Customer</Text>
            </TouchableOpacity>
          </View>

          {/* Seed Data Button */}
          <TouchableOpacity
            style={styles.seedButton}
            onPress={handleSeedData}
            disabled={seeding}
          >
            {seeding ? (
              <ActivityIndicator size="small" color="#3B82F6" />
            ) : (
              <>
                <Ionicons name="download-outline" size={18} color="#3B82F6" />
                <Text style={styles.seedButtonText}>Load Demo Data</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 30,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 30,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: '#1E293B',
  },
  appName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  form: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  formSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 52,
    fontSize: 16,
    color: '#FFFFFF',
  },
  submitButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  switchButton: {
    alignItems: 'center',
    marginTop: 16,
  },
  switchText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  switchTextBold: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  seedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#3B82F6',
    borderRadius: 12,
    borderStyle: 'dashed',
  },
  seedButtonText: {
    color: '#3B82F6',
    fontSize: 14,
    marginLeft: 8,
  },
  companySetupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 8,
  },
  companySetupText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  customerRegisterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#10B981',
    gap: 8,
  },
  customerRegisterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
});
