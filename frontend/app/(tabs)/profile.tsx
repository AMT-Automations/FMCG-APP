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
import { LogoHeader } from '../../src/components/LogoHeader';

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
        {/* Logo */}
        <View style={{ marginBottom: 16 }}>
          <LogoHeader size="small" />
        </View>

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

        {/* Admin Section - Only for Admin/Manager */}
        {(user?.role === 'admin' || user?.role === 'manager') && (
          <View style={styles.menuSection}>
            <Text style={styles.sectionTitle}>Administration</Text>
            
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => router.push('/admin')}
            >
              <View style={[styles.menuIcon, { backgroundColor: '#3B1E1E' }]}>
                <Ionicons name="settings-outline" size={20} color="#EF4444" />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>Admin Dashboard</Text>
                <Text style={styles.menuSubtitle}>Manage users, routes, customers</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#64748B" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => router.push('/stock')}
            >
              <View style={[styles.menuIcon, { backgroundColor: '#1E3A3B' }]}>
                <Ionicons name="cube" size={20} color="#06B6D4" />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>Stock Management</Text>
                <Text style={styles.menuSubtitle}>Receive, adjust, stock take</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#64748B" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => router.push('/email-settings')}
            >
              <View style={[styles.menuIcon, { backgroundColor: '#1E3A1E' }]}>
                <Ionicons name="mail" size={20} color="#22C55E" />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>Email Recipients</Text>
                <Text style={styles.menuSubtitle}>Manage report recipients</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#64748B" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => router.push('/smtp-settings')}
            >
              <View style={[styles.menuIcon, { backgroundColor: '#2E1E3B' }]}>
                <Ionicons name="server" size={20} color="#A855F7" />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>SMTP Settings</Text>
                <Text style={styles.menuSubtitle}>Configure email server</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#64748B" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => router.push('/invoice-history')}
            >
              <View style={[styles.menuIcon, { backgroundColor: '#1E3A5F' }]}>
                <Ionicons name="receipt" size={20} color="#3B82F6" />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>Invoice History</Text>
                <Text style={styles.menuSubtitle}>View all past invoices</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>
        )}

        {/* Menu Items */}
        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Products & Inventory</Text>
          
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => router.push('/manage-products')}
          >
            <View style={[styles.menuIcon, { backgroundColor: '#1E3B35' }]}>
              <Ionicons name="cube-outline" size={20} color="#10B981" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>Manage Products</Text>
              <Text style={styles.menuSubtitle}>Add or view products in your basket</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#64748B" />
          </TouchableOpacity>
        </View>

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

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => {
              Alert.alert(
                'Help & Support',
                `Need assistance? Contact us:\n\n` +
                `📧 Email: supportapp@mzafri.co.za\n` +
                `📞 Phone: +27 71 876 5600\n` +
                `🌐 Website: www.mzafri.co.za\n\n` +
                `Our support team is available Monday to Friday, 8am - 5pm.`,
                [{ text: 'OK' }]
              );
            }}
          >
            <View style={[styles.menuIcon, { backgroundColor: '#2E1E3B' }]}>
              <Ionicons name="help-circle-outline" size={20} color="#8B5CF6" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>Help & Support</Text>
              <Text style={styles.menuSubtitle}>supportapp@mzafri.co.za</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#64748B" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => {
              Alert.alert(
                'About Mzansi Distribution Tracker',
                `Version 1.0.0\n\n` +
                `Developed for Mzafri Distribution\n\n` +
                `📧 supportapp@mzafri.co.za\n` +
                `📞 +27 71 876 5600\n` +
                `🌐 www.mzafri.co.za\n\n` +
                `© 2026 Mzafri Distribution. All rights reserved.`,
                [{ text: 'OK' }]
              );
            }}
          >
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

        {/* Support Contact Card */}
        <View style={styles.supportCard}>
          <Text style={styles.supportTitle}>Need Help?</Text>
          <View style={styles.supportRow}>
            <Ionicons name="mail" size={16} color="#3B82F6" />
            <Text style={styles.supportText}>supportapp@mzafri.co.za</Text>
          </View>
          <View style={styles.supportRow}>
            <Ionicons name="call" size={16} color="#10B981" />
            <Text style={styles.supportText}>+27 71 876 5600</Text>
          </View>
          <View style={styles.supportRow}>
            <Ionicons name="globe" size={16} color="#F59E0B" />
            <Text style={styles.supportText}>www.mzafri.co.za</Text>
          </View>
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
  supportCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  supportTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  supportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  supportText: {
    fontSize: 14,
    color: '#94A3B8',
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
