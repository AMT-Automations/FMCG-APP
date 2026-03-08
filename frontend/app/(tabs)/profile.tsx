import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.name?.charAt(0)?.toUpperCase() || 'D'}
              </Text>
            </View>
          </View>
          <Text style={styles.userName}>{user?.name || 'Driver'}</Text>
          <View style={styles.roleTag}>
            <Text style={styles.roleText}>{user?.role?.toUpperCase() || 'DRIVER'}</Text>
          </View>
          <Text style={styles.phoneText}>{user?.phone}</Text>
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Account</Text>
          
          <TouchableOpacity style={styles.menuItem}>
            <View style={[styles.menuIcon, { backgroundColor: '#1E3A5F' }]}>
              <Ionicons name="person-outline" size={20} color="#3B82F6" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>Edit Profile</Text>
              <Text style={styles.menuSubtitle}>Update your information</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#64748B" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={[styles.menuIcon, { backgroundColor: '#1E3B35' }]}>
              <Ionicons name="lock-closed-outline" size={20} color="#10B981" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>Change PIN</Text>
              <Text style={styles.menuSubtitle}>Update your login PIN</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#64748B" />
          </TouchableOpacity>
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>App</Text>
          
          <TouchableOpacity style={styles.menuItem}>
            <View style={[styles.menuIcon, { backgroundColor: '#3B2E1E' }]}>
              <Ionicons name="notifications-outline" size={20} color="#F59E0B" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>Notifications</Text>
              <Text style={styles.menuSubtitle}>Manage alerts and reminders</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#64748B" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={[styles.menuIcon, { backgroundColor: '#2E1E3B' }]}>
              <Ionicons name="help-circle-outline" size={20} color="#8B5CF6" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>Help & Support</Text>
              <Text style={styles.menuSubtitle}>Get assistance</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#64748B" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={[styles.menuIcon, { backgroundColor: '#1E293B' }]}>
              <Ionicons name="information-circle-outline" size={20} color="#94A3B8" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>About</Text>
              <Text style={styles.menuSubtitle}>Version 1.0.0</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#64748B" />
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appName}>Mzansi Distribution Tracker</Text>
          <Text style={styles.appVersion}>Version 1.0.0</Text>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    marginBottom: 24,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  roleTag: {
    backgroundColor: '#1E3A5F',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 8,
  },
  roleText: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: '600',
  },
  phoneText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  menuSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  menuSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
    marginLeft: 8,
  },
  appInfo: {
    alignItems: 'center',
    paddingBottom: 24,
  },
  appName: {
    fontSize: 14,
    color: '#64748B',
  },
  appVersion: {
    fontSize: 12,
    color: '#475569',
    marginTop: 4,
  },
});
