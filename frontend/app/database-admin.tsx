import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, Alert, Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { api } from '../src/services/api';

interface Collection {
  name: string;
  count: number;
}

interface BrowseResult {
  collection: string;
  total: number;
  skip: number;
  limit: number;
  documents: any[];
}

type ViewMode = 'collections' | 'documents' | 'document' | 'edit';

export default function DatabaseAdminScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('collections');
  const [collections, setCollections] = useState<Collection[]>([]);
  const [browseResult, setBrowseResult] = useState<BrowseResult | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [editFields, setEditFields] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentCollection, setCurrentCollection] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const PAGE_SIZE = 20;

  const loadCollections = useCallback(async () => {
    try {
      const response = await api.request('GET', '/admin/db/collections');
      setCollections(response);
    } catch (error: any) {
      console.error('Failed to load collections:', error);
      Alert.alert('Error', 'Failed to load database collections. Admin access required.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  const browseCollection = async (collName: string, page: number = 0) => {
    setLoading(true);
    setCurrentCollection(collName);
    setCurrentPage(page);
    try {
      const response = await api.request('GET', `/admin/db/collections/${collName}?skip=${page * PAGE_SIZE}&limit=${PAGE_SIZE}&company_filter=false`);
      setBrowseResult(response);
      setViewMode('documents');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to browse collection');
    } finally {
      setLoading(false);
    }
  };

  const viewDocument = async (collName: string, docId: string) => {
    setLoading(true);
    try {
      const response = await api.request('GET', `/admin/db/collections/${collName}/${docId}`);
      setSelectedDoc(response);
      setViewMode('document');
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load document');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = () => {
    if (!selectedDoc) return;
    const fields: Record<string, string> = {};
    Object.entries(selectedDoc).forEach(([key, value]) => {
      if (key !== '_id' && key !== 'id') {
        fields[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
      }
    });
    setEditFields(fields);
    setViewMode('edit');
  };

  const saveDocument = async () => {
    if (!selectedDoc || !currentCollection) return;
    setLoading(true);
    try {
      const updateData: Record<string, any> = {};
      Object.entries(editFields).forEach(([key, value]) => {
        try {
          updateData[key] = JSON.parse(value);
        } catch {
          updateData[key] = value;
        }
      });

      const response = await api.request('PUT', `/admin/db/collections/${currentCollection}/${selectedDoc.id}`, updateData);
      setSelectedDoc(response);
      setViewMode('document');
      Alert.alert('Success', 'Document updated successfully');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update document');
    } finally {
      setLoading(false);
    }
  };

  const deleteDocument = (docId: string) => {
    Alert.alert(
      'Delete Document',
      'Are you sure? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.request('DELETE', `/admin/db/collections/${currentCollection}/${docId}`);
              Alert.alert('Deleted', 'Document removed');
              browseCollection(currentCollection, currentPage);
              setViewMode('documents');
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'Failed to delete');
            }
          },
        },
      ]
    );
  };

  const onRefresh = () => {
    setRefreshing(true);
    if (viewMode === 'collections') {
      loadCollections();
    } else if (viewMode === 'documents') {
      browseCollection(currentCollection, currentPage);
    }
  };

  const goBack = () => {
    if (viewMode === 'edit') {
      setViewMode('document');
    } else if (viewMode === 'document') {
      setViewMode('documents');
    } else if (viewMode === 'documents') {
      setViewMode('collections');
    } else {
      router.back();
    }
  };

  const renderValue = (value: any, depth: number = 0): string => {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  const getCollectionIcon = (name: string): string => {
    const icons: Record<string, string> = {
      users: 'people',
      companies: 'business',
      products: 'cube',
      routes: 'map',
      orders: 'cart',
      sales: 'cash',
      customers: 'person',
      vehicles: 'car',
      daily_routes: 'navigate',
      settings: 'settings',
      stock: 'layers',
      stock_movements: 'swap-horizontal',
    };
    return icons[name] || 'document';
  };

  const filteredCollections = collections.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading && viewMode === 'collections' && collections.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading database...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // EDIT MODE
  if (viewMode === 'edit' && selectedDoc) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={goBack} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Document</Text>
          <TouchableOpacity onPress={saveDocument} style={styles.saveBtn}>
            <Text style={styles.saveBtnText}>Save</Text>
          </TouchableOpacity>
        </View>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.idBanner}>
              <Text style={styles.idLabel}>ID: {selectedDoc.id}</Text>
            </View>
            {Object.entries(editFields).map(([key, value]) => (
              <View key={key} style={styles.editField}>
                <Text style={styles.editFieldLabel}>{key}</Text>
                <TextInput
                  style={[styles.editFieldInput, value.length > 100 && { minHeight: 120 }]}
                  value={value}
                  onChangeText={(text) => setEditFields(prev => ({ ...prev, [key]: text }))}
                  multiline
                  placeholderTextColor="#475569"
                />
              </View>
            ))}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // SINGLE DOCUMENT VIEW
  if (viewMode === 'document' && selectedDoc) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={goBack} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{currentCollection}</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={startEdit} style={styles.headerActionBtn}>
              <Ionicons name="create-outline" size={22} color="#3B82F6" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => deleteDocument(selectedDoc.id)} style={styles.headerActionBtn}>
              <Ionicons name="trash-outline" size={22} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.idBanner}>
            <Text style={styles.idLabel}>ID: {selectedDoc.id}</Text>
          </View>
          {Object.entries(selectedDoc).filter(([k]) => k !== 'id').map(([key, value]) => (
            <View key={key} style={styles.fieldCard}>
              <Text style={styles.fieldKey}>{key}</Text>
              <Text style={styles.fieldValue} selectable>{renderValue(value)}</Text>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // DOCUMENTS LIST
  if (viewMode === 'documents' && browseResult) {
    const totalPages = Math.ceil(browseResult.total / PAGE_SIZE);
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={goBack} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{browseResult.collection}</Text>
            <Text style={styles.headerSub}>{browseResult.total} documents</Text>
          </View>
          <TouchableOpacity onPress={() => browseCollection(currentCollection, currentPage)} style={styles.headerBtn}>
            <Ionicons name="refresh" size={22} color="#3B82F6" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3B82F6" />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ paddingBottom: 80, paddingHorizontal: 16 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />}
          >
            {browseResult.documents.map((doc) => {
              const displayName = doc.name || doc.contact_person || doc.business_name || doc.order_number || doc.phone || doc.id;
              const displaySub = doc.phone || doc.role || doc.status || doc.category || doc.company_id || '';
              return (
                <TouchableOpacity
                  key={doc.id}
                  style={styles.docCard}
                  onPress={() => viewDocument(currentCollection, doc.id)}
                >
                  <View style={styles.docCardContent}>
                    <Text style={styles.docCardTitle} numberOfLines={1}>{displayName}</Text>
                    {displaySub ? <Text style={styles.docCardSub} numberOfLines={1}>{displaySub}</Text> : null}
                    <Text style={styles.docCardId}>ID: {doc.id}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#475569" />
                </TouchableOpacity>
              );
            })}

            {/* Pagination */}
            {totalPages > 1 && (
              <View style={styles.pagination}>
                <TouchableOpacity
                  style={[styles.pageBtn, currentPage === 0 && { opacity: 0.3 }]}
                  onPress={() => currentPage > 0 && browseCollection(currentCollection, currentPage - 1)}
                  disabled={currentPage === 0}
                >
                  <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
                  <Text style={styles.pageBtnText}>Prev</Text>
                </TouchableOpacity>
                <Text style={styles.pageInfo}>Page {currentPage + 1} of {totalPages}</Text>
                <TouchableOpacity
                  style={[styles.pageBtn, currentPage >= totalPages - 1 && { opacity: 0.3 }]}
                  onPress={() => currentPage < totalPages - 1 && browseCollection(currentCollection, currentPage + 1)}
                  disabled={currentPage >= totalPages - 1}
                >
                  <Text style={styles.pageBtnText}>Next</Text>
                  <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    );
  }

  // COLLECTIONS LIST (default)
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Database Admin</Text>
          <Text style={styles.headerSub}>{collections.length} collections</Text>
        </View>
        <TouchableOpacity onPress={onRefresh} style={styles.headerBtn}>
          <Ionicons name="refresh" size={22} color="#3B82F6" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color="#64748B" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search collections..."
          placeholderTextColor="#64748B"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />}
      >
        {filteredCollections.map((coll) => (
          <TouchableOpacity
            key={coll.name}
            style={styles.collectionCard}
            onPress={() => browseCollection(coll.name)}
          >
            <View style={styles.collectionIcon}>
              <Ionicons name={getCollectionIcon(coll.name) as any} size={24} color="#3B82F6" />
            </View>
            <View style={styles.collectionInfo}>
              <Text style={styles.collectionName}>{coll.name}</Text>
              <Text style={styles.collectionCount}>{coll.count} document{coll.count !== 1 ? 's' : ''}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#475569" />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#94A3B8', marginTop: 12, fontSize: 16 },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1E293B',
  },
  headerBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  headerSub: { fontSize: 12, color: '#64748B', marginTop: 1 },
  headerActions: { flexDirection: 'row', gap: 4 },
  headerActionBtn: { padding: 8 },
  saveBtn: { backgroundColor: '#3B82F6', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  saveBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  content: { padding: 16, paddingBottom: 40 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B',
    marginHorizontal: 16, marginVertical: 12, paddingHorizontal: 14,
    borderRadius: 12, height: 48,
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16, color: '#FFFFFF' },
  collectionCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B',
    borderRadius: 12, padding: 16, marginBottom: 8,
  },
  collectionIcon: {
    width: 48, height: 48, borderRadius: 12, backgroundColor: '#172554',
    justifyContent: 'center', alignItems: 'center',
  },
  collectionInfo: { flex: 1, marginLeft: 14 },
  collectionName: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  collectionCount: { fontSize: 13, color: '#64748B', marginTop: 2 },
  docCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B',
    borderRadius: 12, padding: 14, marginBottom: 8,
  },
  docCardContent: { flex: 1 },
  docCardTitle: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  docCardSub: { fontSize: 13, color: '#94A3B8', marginTop: 2 },
  docCardId: { fontSize: 11, color: '#475569', marginTop: 4, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  pagination: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 16, paddingHorizontal: 8,
  },
  pageBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B',
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, gap: 4,
  },
  pageBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  pageInfo: { color: '#94A3B8', fontSize: 14 },
  idBanner: {
    backgroundColor: '#172554', borderRadius: 10, padding: 12, marginBottom: 16,
  },
  idLabel: { fontSize: 13, color: '#60A5FA', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  fieldCard: {
    backgroundColor: '#1E293B', borderRadius: 10, padding: 14, marginBottom: 8,
  },
  fieldKey: {
    fontSize: 12, fontWeight: '700', color: '#60A5FA', marginBottom: 6,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  fieldValue: { fontSize: 14, color: '#E2E8F0', lineHeight: 20 },
  editField: { marginBottom: 14 },
  editFieldLabel: {
    fontSize: 12, fontWeight: '700', color: '#60A5FA', marginBottom: 6,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  editFieldInput: {
    backgroundColor: '#1E293B', borderRadius: 10, padding: 14,
    color: '#FFFFFF', fontSize: 14, borderWidth: 1, borderColor: '#334155',
    textAlignVertical: 'top',
  },
});
