import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { getTotalStorageCleared } from '../utils/storage';
import { Colors } from '../constants/colors';

export default function SessionSummaryScreen({ route, navigation }) {
  const { stats } = route.params || {};
  const [totalCleared, setTotalCleared] = useState(0);

  useEffect(() => {
    loadTotalStorage();
  }, []);

  const loadTotalStorage = async () => {
    const total = await getTotalStorageCleared();
    setTotalCleared(total);
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <ScrollView style={styles.container}>
      <StatusBar style="auto" />
      
      <View style={styles.header}>
        <Text style={styles.emoji}>🎉</Text>
        <Text style={styles.title}>Session Complete!</Text>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats?.photosReviewed || 0}</Text>
          <Text style={styles.statLabel}>Photos Reviewed</Text>
        </View>
        
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats?.deleted || 0}</Text>
          <Text style={styles.statLabel}>Deleted</Text>
        </View>
        
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats?.favorited || 0}</Text>
          <Text style={styles.statLabel}>Favorited</Text>
        </View>
      </View>

      <View style={styles.storageCard}>
        <Text style={styles.storageLabel}>Storage Cleared This Session</Text>
        <Text style={styles.storageAmount}>
          {formatBytes(stats?.storageCleared || 0)}
        </Text>
      </View>

      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Total Storage Cleared</Text>
        <Text style={styles.totalAmount}>
          {formatBytes(totalCleared)}
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity 
          style={styles.button}
          onPress={() => navigation.navigate('Swipe')}
        >
          <Text style={styles.buttonText}>Review More Photos</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, styles.buttonSecondary]}
          onPress={() => navigation.navigate('Dashboard')}
        >
          <Text style={[styles.buttonText, styles.buttonTextSecondary]}>
            Go to Dashboard
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.accent,
  },
  header: {
    paddingTop: 80,
    paddingBottom: 40,
    alignItems: 'center',
    backgroundColor: Colors.primary,
  },
  emoji: {
    fontSize: 80,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.background,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
  },
  statCard: {
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 20,
    borderRadius: 16,
    minWidth: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  storageCard: {
    backgroundColor: Colors.background,
    margin: 20,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  storageLabel: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  storageAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: Colors.success,
  },
  totalCard: {
    backgroundColor: Colors.primary,
    margin: 20,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 16,
    color: Colors.background,
    opacity: 0.9,
    marginBottom: 12,
  },
  totalAmount: {
    fontSize: 40,
    fontWeight: 'bold',
    color: Colors.background,
  },
  actions: {
    padding: 20,
    paddingBottom: 40,
  },
  button: {
    backgroundColor: Colors.primary,
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonSecondary: {
    backgroundColor: Colors.background,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.background,
  },
  buttonTextSecondary: {
    color: Colors.primary,
  },
});

