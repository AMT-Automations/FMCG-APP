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

const REPORT_TYPES = [
  { id: 'sales', name: 'Sales Reports', icon: 'cart' },
  { id: 'stock', name: 'Stock Reports', icon: 'cube' },
  { id: 'summary', name: 'Daily Summary', icon: 'stats-chart' },
];

interface EmailRecipient {
  id: string;
  email: string;
  name?: string;
  report_types: string[];
  is_active: boolean;
  created_at: string;
}

export default function EmailSettings() {
  const router = useRouter();
  const { user } = useAuth();
  const [recipients, setRecipients] = useState<EmailRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  
  // Modal states
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState<EmailRecipient | null>(null);
  
  // Form states
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [selectedReportTypes, setSelectedReportTypes] = useState<string[]>([]);

  useEffect(() => {
    if (user?.role !== 'admin' && user?.role !== 'manager') {
      Alert.alert('Access Denied', 'Only admin/manager can access email settings');
      router.back();
      return;
    }
    loadRecipients();
  }, []);

  const loadRecipients = async () => {
    try {
      const data = await api.getEmailRecipients();
      setRecipients(data);
    } catch (error) {
      console.error('Error loading recipients:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadRecipients();
  };

  const openAddModal = () => {
    setEditingRecipient(null);
    setEmail('');
    setName('');
    setSelectedReportTypes([]);
    setModalVisible(true);
  };

  const openEditModal = (recipient: EmailRecipient) => {
    setEditingRecipient(recipient);
    setEmail(recipient.email);
    setName(recipient.name || '');
    setSelectedReportTypes(recipient.report_types || []);
    setModalVisible(true);
  };

  const toggleReportType = (typeId: string) => {
    setSelectedReportTypes(prev => 
      prev.includes(typeId) 
        ? prev.filter(t => t !== typeId)
        : [...prev, typeId]
    );
  };

  const handleSave = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }
    
    if (selectedReportTypes.length === 0) {
      Alert.alert('Error', 'Please select at least one report type');
      return;
    }
    
    setSaving(true);
    try {
      if (editingRecipient) {
        await api.updateEmailRecipient(editingRecipient.id, {
          email: email.trim(),
          name: name.trim() || undefined,
          report_types: selectedReportTypes
        });
        Alert.alert('Success', 'Recipient updated successfully');
      } else {
        await api.addEmailRecipient({
          email: email.trim(),
          name: name.trim() || undefined,
          report_types: selectedReportTypes
        });
        Alert.alert('Success', 'Recipient added successfully');
      }
      setModalVisible(false);
      loadRecipients();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to save recipient');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (recipient: EmailRecipient) => {
    Alert.alert(
      'Delete Recipient',
      `Are you sure you want to remove ${recipient.email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteEmailRecipient(recipient.id);
              loadRecipients();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'Failed to delete recipient');
            }
          }
        }
      ]
    );
  };

  const handleToggle = async (recipient: EmailRecipient) => {
    try {
      await api.toggleEmailRecipient(recipient.id);
      loadRecipients();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to toggle recipient');
    }
  };

  const sendTestReport = async (reportType: string) => {
    Alert.alert(
      'Send Test Report',
      `This will send a ${reportType} report to all active recipients configured for this report type. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            setSending(true);
            try {
              const result = await api.sendReport(reportType);
              Alert.alert('Success', result.message);
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'Failed to send report');
            } finally {
              setSending(false);
            }
          }
        }
      ]
    );
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
        <Text style={styles.headerTitle}>Email Settings</Text>
        <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />}
      >
        {/* Quick Send Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Send Reports Now</Text>
          <Text style={styles.sectionSubtitle}>Send reports to configured recipients</Text>
          <View style={styles.quickSendRow}>
            {REPORT_TYPES.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={styles.quickSendButton}
                onPress={() => sendTestReport(type.id)}
                disabled={sending}
              >
                <Ionicons name={type.icon as any} size={24} color="#3B82F6" />
                <Text style={styles.quickSendText}>{type.name.split(' ')[0]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Recipients List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Email Recipients ({recipients.length})</Text>
          
          {recipients.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="mail-outline" size={48} color="#64748B" />
              <Text style={styles.emptyText}>No email recipients configured</Text>
              <Text style={styles.emptySubtext}>Tap + to add recipients for automated reports</Text>
            </View>
          ) : (
            recipients.map((recipient) => (
              <View key={recipient.id} style={styles.recipientCard}>
                <View style={styles.recipientHeader}>
                  <View style={styles.recipientInfo}>
                    <View style={[styles.statusDot, recipient.is_active ? styles.statusActive : styles.statusInactive]} />
                    <View>
                      <Text style={styles.recipientEmail}>{recipient.email}</Text>
                      {recipient.name && <Text style={styles.recipientName}>{recipient.name}</Text>}
                    </View>
                  </View>
                  <TouchableOpacity 
                    style={styles.toggleButton}
                    onPress={() => handleToggle(recipient)}
                  >
                    <Ionicons 
                      name={recipient.is_active ? 'toggle' : 'toggle-outline'} 
                      size={28} 
                      color={recipient.is_active ? '#10B981' : '#64748B'} 
                    />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.reportTypeTags}>
                  {recipient.report_types.map((type) => (
                    <View key={type} style={styles.reportTypeTag}>
                      <Text style={styles.reportTypeTagText}>
                        {REPORT_TYPES.find(t => t.id === type)?.name || type}
                      </Text>
                    </View>
                  ))}
                </View>
                
                <View style={styles.recipientActions}>
                  <TouchableOpacity 
                    style={styles.editButton}
                    onPress={() => openEditModal(recipient)}
                  >
                    <Ionicons name="pencil" size={16} color="#3B82F6" />
                    <Text style={styles.editButtonText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.deleteButton}
                    onPress={() => handleDelete(recipient)}
                  >
                    <Ionicons name="trash" size={16} color="#EF4444" />
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Info Section */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color="#3B82F6" />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Automated Reports</Text>
            <Text style={styles.infoText}>
              Stock reports are automatically sent every Friday at 11:00 AM to all active recipients configured for stock reports.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingRecipient ? 'Edit Recipient' : 'Add Recipient'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Email Address *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="email@example.com"
                placeholderTextColor="#64748B"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Name (Optional)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Recipient name"
                placeholderTextColor="#64748B"
                value={name}
                onChangeText={setName}
              />
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Report Types *</Text>
              <Text style={styles.formHint}>Select which reports this recipient should receive</Text>
              <View style={styles.reportTypeOptions}>
                {REPORT_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type.id}
                    style={[
                      styles.reportTypeOption,
                      selectedReportTypes.includes(type.id) && styles.reportTypeOptionSelected
                    ]}
                    onPress={() => toggleReportType(type.id)}
                  >
                    <Ionicons 
                      name={type.icon as any} 
                      size={24} 
                      color={selectedReportTypes.includes(type.id) ? '#FFFFFF' : '#64748B'} 
                    />
                    <Text style={[
                      styles.reportTypeOptionText,
                      selectedReportTypes.includes(type.id) && styles.reportTypeOptionTextSelected
                    ]}>
                      {type.name}
                    </Text>
                    {selectedReportTypes.includes(type.id) && (
                      <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            <TouchableOpacity
              style={[styles.submitButton, saving && styles.submitButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {editingRecipient ? 'Update Recipient' : 'Add Recipient'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Sending overlay */}
      {sending && (
        <View style={styles.sendingOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.sendingText}>Sending reports...</Text>
        </View>
      )}
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
  addButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    borderRadius: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 16,
  },
  quickSendRow: {
    flexDirection: 'row',
    gap: 12,
  },
  quickSendButton: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  quickSendText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#1E293B',
    borderRadius: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  recipientCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  recipientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  recipientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  statusActive: {
    backgroundColor: '#10B981',
  },
  statusInactive: {
    backgroundColor: '#64748B',
  },
  recipientEmail: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  recipientName: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  toggleButton: {
    padding: 4,
  },
  reportTypeTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  reportTypeTag: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  reportTypeTagText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  recipientActions: {
    flexDirection: 'row',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 12,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#1E3A5F',
    borderRadius: 6,
  },
  editButtonText: {
    fontSize: 14,
    color: '#3B82F6',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#3B1E1E',
    borderRadius: 6,
  },
  deleteButtonText: {
    fontSize: 14,
    color: '#EF4444',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#1E3A5F',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginBottom: 24,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 8,
  },
  formHint: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
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
  reportTypeOptions: {
    gap: 10,
  },
  reportTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  reportTypeOptionSelected: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  reportTypeOptionText: {
    flex: 1,
    fontSize: 14,
    color: '#94A3B8',
  },
  reportTypeOptionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: '#3B82F6',
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
  sendingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendingText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginTop: 16,
  },
});
