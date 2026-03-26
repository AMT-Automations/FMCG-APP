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
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../src/context/AuthContext';
import { api } from '../src/services/api';

const ROLES = ['admin', 'manager', 'driver', 'conductor'];
const VEHICLE_TYPES = ['truck', 'van', 'bakkie'];

export default function AdminDashboard() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'routes' | 'customers' | 'vehicles'>('users');
  const [users, setUsers] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [userModalVisible, setUserModalVisible] = useState(false);
  const [routeModalVisible, setRouteModalVisible] = useState(false);
  const [customerModalVisible, setCustomerModalVisible] = useState(false);
  const [vehicleModalVisible, setVehicleModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // Location data for route creation
  const [provinces, setProvinces] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [areas, setAreas] = useState<string[]>([]);

  // Form states
  const [userForm, setUserForm] = useState({ name: '', phone: '', pin: '', role: 'driver' });
  const [routeForm, setRouteForm] = useState({ 
    name: '', description: '', assigned_driver_id: '',
    province: '', district: '', areas_covered: [] as string[],
    delivery_days: [] as string[], cut_off_time: '16:00',
  });
  const [customerForm, setCustomerForm] = useState({ 
    name: '', contact: '', location: '', payment_terms: 'cash', credit_limit: '', route_id: '' 
  });
  const [vehicleForm, setVehicleForm] = useState({
    name: '', registration: '', vehicle_type: 'truck', capacity_crates: '100'
  });

  useEffect(() => {
    if (authLoading) return; // Wait for auth token to be restored
    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      if (Platform.OS === 'web') {
        window.alert('Access Denied: You do not have permission to access this page');
      } else {
        Alert.alert('Access Denied', 'You do not have permission to access this page');
      }
      router.back();
      return;
    }
    loadData();
  }, [authLoading, user]);

  const loadData = async () => {
    try {
      const [usersData, routesData, customersData, vehiclesData] = await Promise.all([
        user?.role === 'admin' ? api.getUsers() : Promise.resolve([]),
        api.getRoutes(),
        api.getCustomers(),
        api.getVehicles(true), // Include inactive
      ]);
      setUsers(usersData);
      setRoutes(routesData);
      setCustomers(customersData);
      setVehicles(vehiclesData);
      setDrivers(usersData.filter((u: any) => u.role === 'driver' && u.is_active !== false));
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // User Management
  const openUserModal = (userItem?: any) => {
    if (userItem) {
      setEditingItem(userItem);
      setUserForm({ 
        name: userItem.name, 
        phone: userItem.phone, 
        pin: '', 
        role: userItem.role 
      });
    } else {
      setEditingItem(null);
      setUserForm({ name: '', phone: '', pin: '', role: 'driver' });
    }
    setUserModalVisible(true);
  };

  const saveUser = async () => {
    if (!userForm.name || !userForm.phone) {
      showAlert('Error', 'Name and phone are required');
      return;
    }
    if (!editingItem && !userForm.pin) {
      showAlert('Error', 'PIN is required for new users');
      return;
    }

    setSaving(true);
    try {
      if (editingItem) {
        await api.updateUser(editingItem.id, {
          name: userForm.name,
          phone: userForm.phone,
          role: userForm.role,
        });
      } else {
        await api.createUser(userForm);
      }
      setUserModalVisible(false);
      loadData();
      showAlert('Success', editingItem ? 'User updated' : 'User created');
    } catch (error: any) {
      showAlert('Error', error.response?.data?.detail || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const deactivateUser = (userItem: any) => {
    if (Platform.OS === 'web') {
      const proceed = window.confirm(`Are you sure you want to deactivate ${userItem.name}?`);
      if (proceed) {
        api.deactivateUser(userItem.id).then(() => {
          loadData();
          showAlert('Success', 'User deactivated');
        }).catch((error: any) => {
          showAlert('Error', error.response?.data?.detail || 'Failed to deactivate');
        });
      }
    } else {
      Alert.alert(
        'Deactivate User',
        `Are you sure you want to deactivate ${userItem.name}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Deactivate',
            style: 'destructive',
            onPress: async () => {
              try {
                await api.deactivateUser(userItem.id);
                loadData();
                showAlert('Success', 'User deactivated');
              } catch (error: any) {
                showAlert('Error', error.response?.data?.detail || 'Failed to deactivate');
              }
            },
          },
        ]
      );
    }
  };

  // Route Management
  const openRouteModal = async (routeItem?: any) => {
    if (routeItem) {
      setEditingItem(routeItem);
      setRouteForm({
        name: routeItem.name,
        description: routeItem.description || '',
        assigned_driver_id: routeItem.assigned_driver_id || '',
        province: routeItem.province || '',
        district: routeItem.district || '',
        areas_covered: routeItem.areas_covered || [],
        delivery_days: routeItem.delivery_schedule?.delivery_days || [],
        cut_off_time: routeItem.delivery_schedule?.cut_off_time || '16:00',
      });
      // Load cascading data for existing province/district
      if (routeItem.province) {
        try {
          const d = await api.getDistricts(routeItem.province);
          setDistricts(d);
          if (routeItem.district) {
            const a = await api.getAreas(routeItem.province, routeItem.district);
            setAreas(a);
          }
        } catch (err) { console.error(err); }
      }
    } else {
      setEditingItem(null);
      setRouteForm({ 
        name: '', description: '', assigned_driver_id: '',
        province: '', district: '', areas_covered: [],
        delivery_days: [], cut_off_time: '16:00',
      });
      setDistricts([]);
      setAreas([]);
    }
    // Load provinces
    try {
      const p = await api.getProvinces();
      setProvinces(p);
    } catch (err) { console.error(err); }
    setRouteModalVisible(true);
  };

  const handleRouteProvinceChange = async (province: string) => {
    setRouteForm(prev => ({ ...prev, province, district: '', areas_covered: [] }));
    setAreas([]);
    if (province) {
      try {
        const d = await api.getDistricts(province);
        setDistricts(d);
      } catch (err) { setDistricts([]); }
    } else {
      setDistricts([]);
    }
  };

  const handleRouteDistrictChange = async (district: string) => {
    setRouteForm(prev => ({ ...prev, district, areas_covered: [] }));
    if (district && routeForm.province) {
      try {
        const a = await api.getAreas(routeForm.province, district);
        setAreas(a);
      } catch (err) { setAreas([]); }
    } else {
      setAreas([]);
    }
  };

  const toggleRouteArea = (area: string) => {
    setRouteForm(prev => {
      const exists = prev.areas_covered.includes(area);
      return {
        ...prev,
        areas_covered: exists
          ? prev.areas_covered.filter((a: string) => a !== area)
          : [...prev.areas_covered, area],
      };
    });
  };

  const toggleDeliveryDay = (day: string) => {
    setRouteForm(prev => {
      const exists = prev.delivery_days.includes(day);
      return {
        ...prev,
        delivery_days: exists
          ? prev.delivery_days.filter((d: string) => d !== day)
          : [...prev.delivery_days, day],
      };
    });
  };

  const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const saveRoute = async () => {
    if (!routeForm.name) {
      showAlert('Error', 'Route name is required');
      return;
    }
    if (!routeForm.province) {
      showAlert('Error', 'Please select a province');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        name: routeForm.name,
        description: routeForm.description,
        assigned_driver_id: routeForm.assigned_driver_id || undefined,
        province: routeForm.province,
        district: routeForm.district,
        areas_covered: routeForm.areas_covered,
        delivery_schedule: {
          delivery_days: routeForm.delivery_days,
          cut_off_time: routeForm.cut_off_time,
          cut_off_hours_before: parseInt(routeForm.cut_off_time.split(':')[0]) || 16,
        },
      };
      if (editingItem) {
        await api.updateRoute(editingItem.id, payload);
      } else {
        await api.createRoute(payload);
      }
      setRouteModalVisible(false);
      loadData();
      showAlert('Success', editingItem ? 'Route updated' : 'Route created');
    } catch (error: any) {
      showAlert('Error', error.response?.data?.detail || 'Failed to save route');
    } finally {
      setSaving(false);
    }
  };

  // Customer Management  
  const openCustomerModal = (customerItem?: any) => {
    if (customerItem) {
      setEditingItem(customerItem);
      setCustomerForm({
        name: customerItem.name,
        contact: customerItem.contact || '',
        location: customerItem.location || '',
        payment_terms: customerItem.payment_terms || 'cash',
        credit_limit: customerItem.credit_limit?.toString() || '',
        route_id: customerItem.route_id || '',
      });
    } else {
      setEditingItem(null);
      setCustomerForm({ name: '', contact: '', location: '', payment_terms: 'cash', credit_limit: '', route_id: '' });
    }
    setCustomerModalVisible(true);
  };

  // Helper for web-compatible alerts
  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const saveCustomer = async () => {
    if (!customerForm.name) {
      showAlert('Error', 'Customer name is required');
      return;
    }

    setSaving(true);
    try {
      const data = {
        ...customerForm,
        credit_limit: customerForm.credit_limit ? parseFloat(customerForm.credit_limit) : undefined,
      };
      
      if (editingItem) {
        await api.updateCustomer(editingItem.id, data);
      } else {
        await api.createCustomer(data);
      }
      setCustomerModalVisible(false);
      loadData();
      showAlert('Success', editingItem ? 'Customer updated' : 'Customer created');
    } catch (error: any) {
      showAlert('Error', error.response?.data?.detail || 'Failed to save customer');
    } finally {
      setSaving(false);
    }
  };

  // Vehicle Management
  const openVehicleModal = (vehicleItem?: any) => {
    if (vehicleItem) {
      setEditingItem(vehicleItem);
      setVehicleForm({
        name: vehicleItem.name,
        registration: vehicleItem.registration,
        vehicle_type: vehicleItem.vehicle_type || 'truck',
        capacity_crates: vehicleItem.capacity_crates?.toString() || '100',
      });
    } else {
      setEditingItem(null);
      setVehicleForm({ name: '', registration: '', vehicle_type: 'truck', capacity_crates: '100' });
    }
    setVehicleModalVisible(true);
  };

  const saveVehicle = async () => {
    if (!vehicleForm.name || !vehicleForm.registration) {
      showAlert('Error', 'Name and registration are required');
      return;
    }

    setSaving(true);
    try {
      const data = {
        ...vehicleForm,
        capacity_crates: parseInt(vehicleForm.capacity_crates) || 100,
      };
      
      if (editingItem) {
        await api.updateVehicle(editingItem.id, data);
      } else {
        await api.createVehicle(data);
      }
      setVehicleModalVisible(false);
      loadData();
      showAlert('Success', editingItem ? 'Vehicle updated' : 'Vehicle added');
    } catch (error: any) {
      showAlert('Error', error.response?.data?.detail || 'Failed to save vehicle');
    } finally {
      setSaving(false);
    }
  };

  const deactivateVehicle = (vehicleItem: any) => {
    if (Platform.OS === 'web') {
      const proceed = window.confirm(`Are you sure you want to deactivate ${vehicleItem.name}?`);
      if (proceed) {
        api.deactivateVehicle(vehicleItem.id).then(() => {
          loadData();
          showAlert('Success', 'Vehicle deactivated');
        }).catch((error: any) => {
          showAlert('Error', error.response?.data?.detail || 'Failed to deactivate');
        });
      }
    } else {
      Alert.alert(
        'Deactivate Vehicle',
        `Are you sure you want to deactivate ${vehicleItem.name}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Deactivate',
            style: 'destructive',
            onPress: async () => {
              try {
                await api.deactivateVehicle(vehicleItem.id);
                loadData();
                showAlert('Success', 'Vehicle deactivated');
              } catch (error: any) {
                showAlert('Error', error.response?.data?.detail || 'Failed to deactivate');
              }
            },
          },
        ]
      );
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return '#EF4444';
      case 'manager': return '#8B5CF6';
      case 'driver': return '#3B82F6';
      case 'conductor': return '#10B981';
      default: return '#64748B';
    }
  };

  const getVehicleTypeIcon = (type: string) => {
    switch (type) {
      case 'van': return 'bus-outline';
      case 'bakkie': return 'car-sport-outline';
      default: return 'car-outline';
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Dashboard</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
        <View style={styles.tabs}>
          {user?.role === 'admin' && (
            <TouchableOpacity
              style={[styles.tab, activeTab === 'users' && styles.tabActive]}
              onPress={() => setActiveTab('users')}
            >
              <Ionicons name="people" size={18} color={activeTab === 'users' ? '#3B82F6' : '#64748B'} />
              <Text style={[styles.tabText, activeTab === 'users' && styles.tabTextActive]}>
                Users ({users.filter(u => u.is_active !== false).length})
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.tab, activeTab === 'vehicles' && styles.tabActive]}
            onPress={() => setActiveTab('vehicles')}
          >
            <Ionicons name="car" size={18} color={activeTab === 'vehicles' ? '#3B82F6' : '#64748B'} />
            <Text style={[styles.tabText, activeTab === 'vehicles' && styles.tabTextActive]}>
              Vehicles ({vehicles.filter(v => v.is_active !== false).length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'routes' && styles.tabActive]}
            onPress={() => setActiveTab('routes')}
          >
            <Ionicons name="map" size={18} color={activeTab === 'routes' ? '#3B82F6' : '#64748B'} />
            <Text style={[styles.tabText, activeTab === 'routes' && styles.tabTextActive]}>
              Routes ({routes.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'customers' && styles.tabActive]}
            onPress={() => setActiveTab('customers')}
          >
            <Ionicons name="storefront" size={18} color={activeTab === 'customers' ? '#3B82F6' : '#64748B'} />
            <Text style={[styles.tabText, activeTab === 'customers' && styles.tabTextActive]}>
              Customers ({customers.length})
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Content */}
      <ScrollView style={styles.content}>
        {/* Users Tab */}
        {activeTab === 'users' && user?.role === 'admin' && (
          <View>
            <TouchableOpacity style={styles.addButton} onPress={() => openUserModal()}>
              <Ionicons name="add" size={20} color="#FFFFFF" />
              <Text style={styles.addButtonText}>Add User</Text>
            </TouchableOpacity>

            {users.map((u) => (
              <TouchableOpacity
                key={u.id}
                style={[styles.card, u.is_active === false && styles.cardInactive]}
                onPress={() => openUserModal(u)}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardAvatar}>
                    <Text style={styles.cardAvatarText}>{u.name?.charAt(0)}</Text>
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle}>{u.name}</Text>
                    <Text style={styles.cardSubtitle}>{u.phone}</Text>
                  </View>
                  <View style={[styles.roleBadge, { backgroundColor: getRoleBadgeColor(u.role) }]}>
                    <Text style={styles.roleBadgeText}>{u.role}</Text>
                  </View>
                </View>
                {u.is_active === false && (
                  <Text style={styles.inactiveLabel}>INACTIVE</Text>
                )}
                <View style={styles.cardActions}>
                  <TouchableOpacity 
                    style={styles.cardAction}
                    onPress={() => openUserModal(u)}
                  >
                    <Ionicons name="pencil" size={16} color="#3B82F6" />
                    <Text style={styles.cardActionText}>Edit</Text>
                  </TouchableOpacity>
                  {/* Deactivation removed - backend only */}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Vehicles Tab */}
        {activeTab === 'vehicles' && (
          <View>
            <TouchableOpacity style={styles.addButton} onPress={() => openVehicleModal()}>
              <Ionicons name="add" size={20} color="#FFFFFF" />
              <Text style={styles.addButtonText}>Add Vehicle</Text>
            </TouchableOpacity>

            {vehicles.map((v) => (
              <TouchableOpacity
                key={v.id}
                style={[styles.card, v.is_active === false && styles.cardInactive]}
                onPress={() => openVehicleModal(v)}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.cardIcon, { backgroundColor: '#1E3A5F' }]}>
                    <Ionicons name={getVehicleTypeIcon(v.vehicle_type)} size={20} color="#3B82F6" />
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle}>{v.name}</Text>
                    <Text style={styles.cardSubtitle}>{v.registration}</Text>
                  </View>
                  <View style={[styles.typeBadge, { backgroundColor: '#1E3A5F' }]}>
                    <Text style={styles.typeBadgeText}>{v.vehicle_type}</Text>
                  </View>
                </View>
                <View style={styles.vehicleDetails}>
                  <View style={styles.vehicleDetail}>
                    <Ionicons name="cube-outline" size={14} color="#64748B" />
                    <Text style={styles.vehicleDetailText}>{v.capacity_crates} crates capacity</Text>
                  </View>
                </View>
                {v.is_active === false && (
                  <Text style={styles.inactiveLabel}>INACTIVE</Text>
                )}
                <View style={styles.cardActions}>
                  <TouchableOpacity 
                    style={styles.cardAction}
                    onPress={() => openVehicleModal(v)}
                  >
                    <Ionicons name="pencil" size={16} color="#3B82F6" />
                    <Text style={styles.cardActionText}>Edit</Text>
                  </TouchableOpacity>
                  {/* Deactivation removed - backend only */}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Routes Tab */}
        {activeTab === 'routes' && (
          <View>
            <TouchableOpacity style={styles.addButton} onPress={() => openRouteModal()}>
              <Ionicons name="add" size={20} color="#FFFFFF" />
              <Text style={styles.addButtonText}>Add Route</Text>
            </TouchableOpacity>

            {routes.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={styles.card}
                onPress={() => openRouteModal(r)}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.cardIcon, { backgroundColor: '#1E3A5F' }]}>
                    <Ionicons name="map" size={20} color="#3B82F6" />
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle}>{r.name}</Text>
                    <Text style={styles.cardSubtitle}>
                      {r.province || ''}{r.district ? ` • ${r.district}` : ''}
                      {r.assigned_driver_name && ` • ${r.assigned_driver_name}`}
                    </Text>
                  </View>
                </View>
                {r.areas_covered && r.areas_covered.length > 0 && (
                  <Text style={styles.cardDescription}>Areas: {r.areas_covered.join(', ')}</Text>
                )}
                {r.delivery_schedule?.delivery_days?.length > 0 && (
                  <Text style={styles.cardMeta}>Delivery: {r.delivery_schedule.delivery_days.join(', ')} (cutoff {r.delivery_schedule.cut_off_time || '16:00'})</Text>
                )}
                {r.description && (
                  <Text style={styles.cardDescription}>{r.description}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Customers Tab */}
        {activeTab === 'customers' && (
          <View>
            <TouchableOpacity style={styles.addButton} onPress={() => openCustomerModal()}>
              <Ionicons name="add" size={20} color="#FFFFFF" />
              <Text style={styles.addButtonText}>Add Customer</Text>
            </TouchableOpacity>

            {customers.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.card, c.is_active === false && styles.cardInactive]}
                onPress={() => openCustomerModal(c)}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.cardIcon, { backgroundColor: '#1E3B35' }]}>
                    <Ionicons name="storefront" size={20} color="#10B981" />
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle}>{c.name}</Text>
                    <Text style={styles.cardSubtitle}>
                      {c.location || 'No location'} • {c.payment_terms}
                    </Text>
                  </View>
                  {c.balance > 0 && (
                    <View style={styles.balanceBadge}>
                      <Text style={styles.balanceText}>R {c.balance.toFixed(0)}</Text>
                    </View>
                  )}
                </View>
                {c.credit_limit && (
                  <Text style={styles.cardMeta}>Credit Limit: R {c.credit_limit}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* User Modal */}
      <Modal visible={userModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingItem ? 'Edit User' : 'Add User'}</Text>
              <TouchableOpacity onPress={() => setUserModalVisible(false)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Name *</Text>
                <TextInput
                  style={styles.input}
                  value={userForm.name}
                  onChangeText={(t) => setUserForm({ ...userForm, name: t })}
                  placeholder="Full name"
                  placeholderTextColor="#64748B"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Phone *</Text>
                <TextInput
                  style={styles.input}
                  value={userForm.phone}
                  onChangeText={(t) => setUserForm({ ...userForm, phone: t })}
                  placeholder="Phone number"
                  placeholderTextColor="#64748B"
                  keyboardType="phone-pad"
                />
              </View>
              {!editingItem && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>PIN *</Text>
                  <TextInput
                    style={styles.input}
                    value={userForm.pin}
                    onChangeText={(t) => setUserForm({ ...userForm, pin: t.replace(/\D/g, '').slice(0, 4) })}
                    placeholder="4-digit PIN"
                    placeholderTextColor="#64748B"
                    keyboardType="number-pad"
                    maxLength={4}
                    secureTextEntry
                  />
                </View>
              )}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Role</Text>
                <View style={styles.roleOptions}>
                  {ROLES.map((r) => (
                    <TouchableOpacity
                      key={r}
                      style={[styles.roleOption, userForm.role === r && styles.roleOptionActive]}
                      onPress={() => setUserForm({ ...userForm, role: r })}
                    >
                      <Text style={[styles.roleOptionText, userForm.role === r && styles.roleOptionTextActive]}>
                        {r}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={saveUser}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveButtonText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Vehicle Modal */}
      <Modal visible={vehicleModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingItem ? 'Edit Vehicle' : 'Add Vehicle'}</Text>
              <TouchableOpacity onPress={() => setVehicleModalVisible(false)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Vehicle Name *</Text>
                <TextInput
                  style={styles.input}
                  value={vehicleForm.name}
                  onChangeText={(t) => setVehicleForm({ ...vehicleForm, name: t })}
                  placeholder="e.g., Truck 1, Van A"
                  placeholderTextColor="#64748B"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Registration Number *</Text>
                <TextInput
                  style={styles.input}
                  value={vehicleForm.registration}
                  onChangeText={(t) => setVehicleForm({ ...vehicleForm, registration: t.toUpperCase() })}
                  placeholder="e.g., CA 123-456"
                  placeholderTextColor="#64748B"
                  autoCapitalize="characters"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Vehicle Type</Text>
                <View style={styles.typeOptions}>
                  {VEHICLE_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.typeOption, vehicleForm.vehicle_type === type && styles.typeOptionActive]}
                      onPress={() => setVehicleForm({ ...vehicleForm, vehicle_type: type })}
                    >
                      <Ionicons 
                        name={getVehicleTypeIcon(type)} 
                        size={20} 
                        color={vehicleForm.vehicle_type === type ? '#FFFFFF' : '#64748B'} 
                      />
                      <Text style={[styles.typeOptionText, vehicleForm.vehicle_type === type && styles.typeOptionTextActive]}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Crate Capacity</Text>
                <TextInput
                  style={styles.input}
                  value={vehicleForm.capacity_crates}
                  onChangeText={(t) => setVehicleForm({ ...vehicleForm, capacity_crates: t.replace(/\D/g, '') })}
                  placeholder="100"
                  placeholderTextColor="#64748B"
                  keyboardType="numeric"
                />
              </View>
            </ScrollView>
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={saveVehicle}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveButtonText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Route Modal */}
      <Modal visible={routeModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingItem ? 'Edit Route' : 'Add Route'}</Text>
              <TouchableOpacity onPress={() => setRouteModalVisible(false)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Route Name *</Text>
                <TextInput
                  style={styles.input}
                  value={routeForm.name}
                  onChangeText={(t) => setRouteForm({ ...routeForm, name: t })}
                  placeholder="e.g., Soweto & Surrounds"
                  placeholderTextColor="#64748B"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={[styles.input, { height: 80 }]}
                  value={routeForm.description}
                  onChangeText={(t) => setRouteForm({ ...routeForm, description: t })}
                  placeholder="Route description"
                  placeholderTextColor="#64748B"
                  multiline
                />
              </View>

              {/* Province Dropdown */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Province *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.roleOptions}>
                    {provinces.map((p) => (
                      <TouchableOpacity
                        key={p}
                        style={[styles.roleOption, routeForm.province === p && styles.roleOptionActive]}
                        onPress={() => handleRouteProvinceChange(p)}
                      >
                        <Text style={[styles.roleOptionText, routeForm.province === p && styles.roleOptionTextActive]}>
                          {p}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              {/* District Dropdown */}
              {districts.length > 0 && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>District</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.roleOptions}>
                      {districts.map((d) => (
                        <TouchableOpacity
                          key={d}
                          style={[styles.roleOption, routeForm.district === d && styles.roleOptionActive]}
                          onPress={() => handleRouteDistrictChange(d)}
                        >
                          <Text style={[styles.roleOptionText, routeForm.district === d && styles.roleOptionTextActive]}>
                            {d}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              )}

              {/* Multi-Select Areas */}
              {areas.length > 0 && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Areas Covered (select multiple)</Text>
                  <View style={styles.roleOptions}>
                    {areas.map((a) => (
                      <TouchableOpacity
                        key={a}
                        style={[styles.roleOption, routeForm.areas_covered.includes(a) && { backgroundColor: '#10B981', borderColor: '#10B981' }]}
                        onPress={() => toggleRouteArea(a)}
                      >
                        <Text style={[styles.roleOptionText, routeForm.areas_covered.includes(a) && styles.roleOptionTextActive]}>
                          {routeForm.areas_covered.includes(a) ? '✓ ' : ''}{a}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {routeForm.areas_covered.length > 0 && (
                    <Text style={{ color: '#10B981', fontSize: 12, marginTop: 6 }}>
                      {routeForm.areas_covered.length} area(s) selected
                    </Text>
                  )}
                </View>
              )}

              {/* Delivery Days */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Delivery Days</Text>
                <View style={styles.roleOptions}>
                  {DAYS_OF_WEEK.map((day) => (
                    <TouchableOpacity
                      key={day}
                      style={[styles.roleOption, routeForm.delivery_days.includes(day) && { backgroundColor: '#3B82F6', borderColor: '#3B82F6' }]}
                      onPress={() => toggleDeliveryDay(day)}
                    >
                      <Text style={[styles.roleOptionText, routeForm.delivery_days.includes(day) && styles.roleOptionTextActive]}>
                        {day.slice(0, 3)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Cut-off Time */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Order Cut-off Time</Text>
                <View style={styles.roleOptions}>
                  {['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'].map((time) => (
                    <TouchableOpacity
                      key={time}
                      style={[styles.roleOption, routeForm.cut_off_time === time && styles.roleOptionActive]}
                      onPress={() => setRouteForm({ ...routeForm, cut_off_time: time })}
                    >
                      <Text style={[styles.roleOptionText, routeForm.cut_off_time === time && styles.roleOptionTextActive]}>
                        {time}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Assigned Driver */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Assigned Driver</Text>
                <View style={styles.driverOptions}>
                  <TouchableOpacity
                    style={[styles.driverOption, !routeForm.assigned_driver_id && styles.driverOptionActive]}
                    onPress={() => setRouteForm({ ...routeForm, assigned_driver_id: '' })}
                  >
                    <Text style={[styles.driverOptionText, !routeForm.assigned_driver_id && styles.driverOptionTextActive]}>
                      Unassigned
                    </Text>
                  </TouchableOpacity>
                  {drivers.map((d) => (
                    <TouchableOpacity
                      key={d.id}
                      style={[styles.driverOption, routeForm.assigned_driver_id === d.id && styles.driverOptionActive]}
                      onPress={() => setRouteForm({ ...routeForm, assigned_driver_id: d.id })}
                    >
                      <Text style={[styles.driverOptionText, routeForm.assigned_driver_id === d.id && styles.driverOptionTextActive]}>
                        {d.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={saveRoute}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveButtonText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Customer Modal */}
      <Modal visible={customerModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingItem ? 'Edit Customer' : 'Add Customer'}</Text>
              <TouchableOpacity onPress={() => setCustomerModalVisible(false)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Name *</Text>
                <TextInput
                  style={styles.input}
                  value={customerForm.name}
                  onChangeText={(t) => setCustomerForm({ ...customerForm, name: t })}
                  placeholder="Customer/Shop name"
                  placeholderTextColor="#64748B"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Contact</Text>
                <TextInput
                  style={styles.input}
                  value={customerForm.contact}
                  onChangeText={(t) => setCustomerForm({ ...customerForm, contact: t })}
                  placeholder="Phone number"
                  placeholderTextColor="#64748B"
                  keyboardType="phone-pad"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Location</Text>
                <TextInput
                  style={styles.input}
                  value={customerForm.location}
                  onChangeText={(t) => setCustomerForm({ ...customerForm, location: t })}
                  placeholder="Address/Area"
                  placeholderTextColor="#64748B"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Payment Terms</Text>
                <View style={styles.paymentOptions}>
                  {['cash', 'credit', 'mixed'].map((p) => (
                    <TouchableOpacity
                      key={p}
                      style={[styles.paymentOption, customerForm.payment_terms === p && styles.paymentOptionActive]}
                      onPress={() => setCustomerForm({ ...customerForm, payment_terms: p })}
                    >
                      <Text style={[styles.paymentOptionText, customerForm.payment_terms === p && styles.paymentOptionTextActive]}>
                        {p}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              {customerForm.payment_terms !== 'cash' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Credit Limit (R)</Text>
                  <TextInput
                    style={styles.input}
                    value={customerForm.credit_limit}
                    onChangeText={(t) => setCustomerForm({ ...customerForm, credit_limit: t.replace(/\D/g, '') })}
                    placeholder="0"
                    placeholderTextColor="#64748B"
                    keyboardType="numeric"
                  />
                </View>
              )}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Route</Text>
                <View style={styles.routeOptions}>
                  <TouchableOpacity
                    style={[styles.routeOption, !customerForm.route_id && styles.routeOptionActive]}
                    onPress={() => setCustomerForm({ ...customerForm, route_id: '' })}
                  >
                    <Text style={[styles.routeOptionText, !customerForm.route_id && styles.routeOptionTextActive]}>
                      Unassigned
                    </Text>
                  </TouchableOpacity>
                  {routes.map((r) => (
                    <TouchableOpacity
                      key={r.id}
                      style={[styles.routeOption, customerForm.route_id === r.id && styles.routeOptionActive]}
                      onPress={() => setCustomerForm({ ...customerForm, route_id: r.id })}
                    >
                      <Text style={[styles.routeOptionText, customerForm.route_id === r.id && styles.routeOptionTextActive]}>
                        {r.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={saveCustomer}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveButtonText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#334155' },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#FFFFFF' },
  placeholder: { width: 40 },
  tabsContainer: { maxHeight: 56, backgroundColor: '#1E293B' },
  tabs: { flexDirection: 'row', padding: 8, paddingRight: 16 },
  tab: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, gap: 6, marginRight: 4 },
  tabActive: { backgroundColor: '#0F172A' },
  tabText: { fontSize: 12, color: '#64748B', fontWeight: '500' },
  tabTextActive: { color: '#3B82F6' },
  content: { flex: 1, padding: 16 },
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#3B82F6', padding: 14, borderRadius: 12, marginBottom: 16, gap: 8 },
  addButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 16 },
  card: { backgroundColor: '#1E293B', borderRadius: 12, padding: 16, marginBottom: 12 },
  cardInactive: { opacity: 0.5 },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  cardAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center' },
  cardAvatarText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  cardIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  cardInfo: { flex: 1, marginLeft: 12 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  cardSubtitle: { fontSize: 12, color: '#64748B', marginTop: 2 },
  cardDescription: { fontSize: 12, color: '#94A3B8', marginTop: 8 },
  cardMeta: { fontSize: 12, color: '#64748B', marginTop: 8 },
  cardActions: { flexDirection: 'row', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#334155', gap: 16 },
  cardAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardActionText: { fontSize: 12, color: '#3B82F6', fontWeight: '500' },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  roleBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '600', textTransform: 'uppercase' },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  typeBadgeText: { color: '#3B82F6', fontSize: 10, fontWeight: '600', textTransform: 'uppercase' },
  balanceBadge: { backgroundColor: '#F59E0B', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  balanceText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  inactiveLabel: { color: '#EF4444', fontSize: 10, fontWeight: '600', marginTop: 8 },
  vehicleDetails: { marginTop: 8 },
  vehicleDetail: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  vehicleDetailText: { fontSize: 12, color: '#64748B' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1E293B', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#334155' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF' },
  modalBody: { padding: 20, maxHeight: 400 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 14, color: '#94A3B8', marginBottom: 8 },
  input: { backgroundColor: '#0F172A', borderRadius: 12, padding: 14, fontSize: 16, color: '#FFFFFF' },
  roleOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  roleOption: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#334155' },
  roleOptionActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  roleOptionText: { color: '#94A3B8', fontSize: 14, textTransform: 'capitalize' },
  roleOptionTextActive: { color: '#FFFFFF', fontWeight: '600' },
  typeOptions: { flexDirection: 'row', gap: 8 },
  typeOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 8, backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#334155' },
  typeOptionActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  typeOptionText: { color: '#94A3B8', fontSize: 12, textTransform: 'capitalize' },
  typeOptionTextActive: { color: '#FFFFFF', fontWeight: '600' },
  driverOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  driverOption: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#334155' },
  driverOptionActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  driverOptionText: { color: '#94A3B8', fontSize: 13 },
  driverOptionTextActive: { color: '#FFFFFF', fontWeight: '600' },
  paymentOptions: { flexDirection: 'row', gap: 8 },
  paymentOption: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#334155', alignItems: 'center' },
  paymentOptionActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  paymentOptionText: { color: '#94A3B8', fontSize: 14, textTransform: 'capitalize' },
  paymentOptionTextActive: { color: '#FFFFFF', fontWeight: '600' },
  routeOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  routeOption: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#334155' },
  routeOptionActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  routeOptionText: { color: '#94A3B8', fontSize: 13 },
  routeOptionTextActive: { color: '#FFFFFF', fontWeight: '600' },
  saveButton: { backgroundColor: '#10B981', margin: 20, marginTop: 0, padding: 16, borderRadius: 12, alignItems: 'center' },
  saveButtonDisabled: { opacity: 0.7 },
  saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
