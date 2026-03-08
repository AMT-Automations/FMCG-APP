import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace('/(tabs)');
      } else {
        router.replace('/(auth)/login');
      }
    }
  }, [user, loading]);

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>🚛</Text>
        </View>
        <Text style={styles.title}>Mzansi</Text>
        <Text style={styles.subtitle}>Distribution Tracker</Text>
      </View>
      <ActivityIndicator size="large" color="#3B82F6" style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1E3A5F',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  iconText: {
    fontSize: 48,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 18,
    color: '#94A3B8',
    marginTop: 4,
  },
  loader: {
    marginTop: 40,
  },
});
