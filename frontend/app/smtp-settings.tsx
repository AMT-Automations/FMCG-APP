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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import { api } from '../src/services/api';

export default function SmtpSettings() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  
  const [senderEmail, setSenderEmail] = useState('');
  const [senderPassword, setSenderPassword] = useState('');
  const [smtpServer, setSmtpServer] = useState('');
  const [smtpPort, setSmtpPort] = useState('465');
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    if (user?.role !== 'admin') {
      Alert.alert('Access Denied', 'Only admin can access SMTP settings');
      router.back();
      return;
    }
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await api.getSmtpSettings();
      if (data.configured) {
        setSenderEmail(data.sender_email || '');
        setSmtpServer(data.smtp_server || '');
        setSmtpPort(String(data.smtp_port || 465));
        setIsConfigured(true);
      }
    } catch (error) {
      console.error('Error loading SMTP settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!senderEmail || !senderPassword || !smtpServer || !smtpPort) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    
    setSaving(true);
    try {
      await api.saveSmtpSettings({
        sender_email: senderEmail,
        sender_password: senderPassword,
        smtp_server: smtpServer,
        smtp_port: parseInt(smtpPort)
      });
      Alert.alert('Success', 'SMTP settings saved successfully');
      setIsConfigured(true);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!isConfigured) {
      Alert.alert('Error', 'Please save settings first');
      return;
    }
    
    setTesting(true);
    try {
      await api.sendReport('sales');
      Alert.alert('Test Email Sent', 'Check your configured email recipients for the test report.');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to send test email');
    } finally {
      setTesting(false);
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
      {/* Header with Logo */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Image
            source={require('../assets/logo.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <Text style={styles.headerTitle}>SMTP Settings</Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color="#3B82F6" />
          <Text style={styles.infoText}>
            Configure your email server settings to enable automated report sending.
          </Text>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Email Server Configuration</Text>
          
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Sender Email *</Text>
            <TextInput
              style={styles.formInput}
              placeholder="accounts@yourdomain.co.za"
              placeholderTextColor="#64748B"
              value={senderEmail}
              onChangeText={setSenderEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Email Password *</Text>
            <TextInput
              style={styles.formInput}
              placeholder="Enter password"
              placeholderTextColor="#64748B"
              value={senderPassword}
              onChangeText={setSenderPassword}
              secureTextEntry
            />
            <Text style={styles.formHint}>Password is encrypted and stored securely</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>SMTP Server *</Text>
            <TextInput
              style={styles.formInput}
              placeholder="mail.yourdomain.co.za"
              placeholderTextColor="#64748B"
              value={smtpServer}
              onChangeText={setSmtpServer}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>SMTP Port *</Text>
            <View style={styles.portRow}>
              {['465', '587', '25'].map((port) => (
                <TouchableOpacity
                  key={port}
                  style={[styles.portButton, smtpPort === port && styles.portButtonActive]}
                  onPress={() => setSmtpPort(port)}
                >
                  <Text style={[styles.portButtonText, smtpPort === port && styles.portButtonTextActive]}>
                    {port}
                  </Text>
                  <Text style={[styles.portLabel, smtpPort === port && styles.portLabelActive]}>
                    {port === '465' ? 'SSL' : port === '587' ? 'TLS' : 'Plain'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <Ionicons 
              name={isConfigured ? 'checkmark-circle' : 'alert-circle'} 
              size={24} 
              color={isConfigured ? '#10B981' : '#F59E0B'} 
            />
            <Text style={styles.statusText}>
              {isConfigured ? 'SMTP is configured' : 'SMTP not configured'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="save" size={20} color="#FFFFFF" />
              <Text style={styles.saveButtonText}>Save Settings</Text>
            </>
          )}
        </TouchableOpacity>

        {isConfigured && (
          <TouchableOpacity
            style={[styles.testButton, testing && styles.buttonDisabled]}
            onPress={handleTestEmail}
            disabled={testing}
          >
            {testing ? (
              <ActivityIndicator color="#3B82F6" />
            ) : (
              <>
                <Ionicons name="paper-plane" size={20} color="#3B82F6" />
                <Text style={styles.testButtonText}>Send Test Email</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        <View style={styles.helpSection}>
          <Text style={styles.helpTitle}>Common SMTP Settings:</Text>
          <View style={styles.helpItem}>
            <Text style={styles.helpLabel}>Gmail:</Text>
            <Text style={styles.helpValue}>smtp.gmail.com:587 (TLS)</Text>
          </View>
          <View style={styles.helpItem}>
            <Text style={styles.helpLabel}>Outlook:</Text>
            <Text style={styles.helpValue}>smtp.office365.com:587 (TLS)</Text>
          </View>
          <View style={styles.helpItem}>
            <Text style={styles.helpLabel}>cPanel:</Text>
            <Text style={styles.helpValue}>mail.yourdomain.com:465 (SSL)</Text>
          </View>
        </View>
      </ScrollView>
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
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerLogo: {
    width: 32,
    height: 32,
    borderRadius: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#1E3A5F',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginBottom: 24,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 20,
  },
  formSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#334155',
  },
  formHint: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  portRow: {
    flexDirection: 'row',
    gap: 12,
  },
  portButton: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  portButtonActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  portButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  portButtonTextActive: {
    color: '#FFFFFF',
  },
  portLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  portLabelActive: {
    color: '#FFFFFF',
  },
  statusCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusText: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    marginBottom: 12,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#3B82F6',
    marginBottom: 24,
  },
  testButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3B82F6',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  helpSection: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  helpItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  helpLabel: {
    fontSize: 14,
    color: '#94A3B8',
  },
  helpValue: {
    fontSize: 14,
    color: '#64748B',
  },
});
