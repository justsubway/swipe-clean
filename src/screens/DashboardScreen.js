import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, ScrollView, TouchableOpacity, Dimensions, Image } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { getTotalStorageCleared, getCleanupHistory, getDeletedPhotos } from '../utils/storage';
import { Colors } from '../constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function DashboardScreen({ navigation }) {
  const [totalStorageCleared, setTotalStorageCleared] = useState(0);
  const [recentSessions, setRecentSessions] = useState([]);
  const [markedForDeletion, setMarkedForDeletion] = useState(0);
  const [markedStorage, setMarkedStorage] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadDashboardData();
    });
    return unsubscribe;
  }, [navigation]);

  const loadDashboardData = async () => {
    try {
      const total = await getTotalStorageCleared();
      const history = await getCleanupHistory();
      
      // Get currently marked photos for deletion
      const markedPhotos = await getDeletedPhotos();
      const markedStorageValue = markedPhotos.reduce((sum, p) => {
        const photoSize = Number(p.size) || 0;
        return sum + photoSize;
      }, 0);
      
      setTotalStorageCleared(total);
      setMarkedForDeletion(markedPhotos.length);
      setMarkedStorage(markedStorageValue);
      setRecentSessions(history.slice(-5).reverse()); // Last 5 sessions
      setLoading(false);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setLoading(false);
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <StatusBar style="auto" />
      
      {/* Header with Logo */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Image 
            source={require('../assets/swipeclean.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
          <View style={styles.titleContainer}>
            <Text style={styles.title}>SwipeClean</Text>
            <Text style={styles.subtitle}>Clean up your photos with a swipe</Text>
          </View>
        </View>
      </View>

      {/* Storage Stats Card */}
      <View style={styles.card}>
        <View style={styles.storageHeader}>
          <View>
            <Text style={styles.cardTitle}>Storage Freed</Text>
            <Text style={styles.storageAmount}>{formatBytes(totalStorageCleared)}</Text>
          </View>
          {totalStorageCleared > 0 && (
            <View style={styles.successBadge}>
              <Text style={styles.successBadgeText}>✓</Text>
            </View>
          )}
        </View>
        {markedStorage > 0 && (
          <View style={styles.pendingCard}>
            <Text style={styles.pendingTitle}>
              ⏳ {markedForDeletion} photo{markedForDeletion > 1 ? 's' : ''} ready to delete
            </Text>
            <Text style={styles.pendingStorage}>{formatBytes(markedStorage)} pending</Text>
          </View>
        )}
      </View>

      {/* Quick Cleanup Modes */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Cleanup</Text>
        <Text style={styles.sectionSubtitle}>Choose what to clean up</Text>
        
        <View style={styles.quickModesGrid}>
          <TouchableOpacity 
            style={styles.quickModeCard}
            onPress={() => navigation.navigate('Swipe', { mode: 'all' })}
          >
            <Text style={styles.quickModeIcon}>🖼️</Text>
            <Text style={styles.quickModeTitle}>All Photos</Text>
            <Text style={styles.quickModeSubtitle}>Complete cleanup</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickModeCard}
            onPress={() => navigation.navigate('Swipe', { mode: 'screenshots' })}
          >
            <Text style={styles.quickModeIcon}>📱</Text>
            <Text style={styles.quickModeTitle}>Screenshots</Text>
            <Text style={styles.quickModeSubtext}>Quick cleanup</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickModeCard}
            onPress={() => navigation.navigate('Swipe', { mode: 'duplicates' })}
          >
            <Text style={styles.quickModeIcon}>🔄</Text>
            <Text style={styles.quickModeTitle}>Duplicates</Text>
            <Text style={styles.quickModeSubtext}>Remove copies</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickModeCard}
            onPress={() => navigation.navigate('Swipe', { mode: 'large' })}
          >
            <Text style={styles.quickModeIcon}>📦</Text>
            <Text style={styles.quickModeTitle}>Large Files</Text>
            <Text style={styles.quickModeSubtext}>Save space</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickModeCard}
            onPress={() => navigation.navigate('Swipe', { mode: 'old' })}
          >
            <Text style={styles.quickModeIcon}>📅</Text>
            <Text style={styles.quickModeTitle}>Old Photos</Text>
            <Text style={styles.quickModeSubtext}>1+ years old</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickModeCard}
            onPress={() => navigation.navigate('Swipe', { mode: 'lowquality' })}
          >
            <Text style={styles.quickModeIcon}>🌫️</Text>
            <Text style={styles.quickModeTitle}>Low Quality</Text>
            <Text style={styles.quickModeSubtext}>Blurry photos</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Secondary Actions */}
      {(markedForDeletion > 0 || recentSessions.length > 0) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          
          {markedForDeletion > 0 && (
            <TouchableOpacity 
              style={styles.secondaryActionButton}
              onPress={() => navigation.navigate('ReviewDeletions')}
            >
              <Text style={styles.secondaryActionIcon}>🗑️</Text>
              <View style={styles.secondaryActionTextContainer}>
                <Text style={styles.secondaryActionText}>
                  Review {markedForDeletion} Photo{markedForDeletion > 1 ? 's' : ''}
                </Text>
                <Text style={styles.secondaryActionSubtext}>
                  {formatBytes(markedStorage)} ready to delete
                </Text>
              </View>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity 
            style={styles.secondaryActionButton}
            onPress={() => navigation.navigate('Favorites')}
          >
            <Text style={styles.secondaryActionIcon}>⭐</Text>
            <View style={styles.secondaryActionTextContainer}>
              <Text style={styles.secondaryActionText}>View Favorites</Text>
              <Text style={styles.secondaryActionSubtext}>See your saved photos</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Recent Sessions */}
      {recentSessions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {recentSessions.slice(0, 3).map((session, index) => (
            <View key={index} style={styles.sessionCard}>
              <View style={styles.sessionHeader}>
                <Text style={styles.sessionDate}>{formatDate(session.timestamp)}</Text>
                <Text style={styles.sessionStorage}>
                  {formatBytes(session.storageCleared || 0)}
                </Text>
              </View>
              <View style={styles.sessionStats}>
                <Text style={styles.sessionStat}>
                  {session.deleted || 0} deleted
                </Text>
                <Text style={styles.sessionStat}>
                  {session.favorited || 0} favorited
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.accent,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
    backgroundColor: Colors.primary,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 60,
    height: 60,
    marginRight: 16,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.background,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.background,
    opacity: 0.9,
  },
  card: {
    backgroundColor: Colors.background,
    margin: 20,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  storageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  storageAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.success,
    marginTop: 4,
  },
  successBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successBadgeText: {
    fontSize: 24,
    color: Colors.background,
  },
  pendingCard: {
    backgroundColor: Colors.warning,
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  pendingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.background,
    marginBottom: 4,
  },
  pendingStorage: {
    fontSize: 14,
    color: Colors.background,
    opacity: 0.9,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 12,
  },
  primaryActionButton: {
    backgroundColor: Colors.primary,
    padding: 24,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  primaryActionIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  primaryActionTextContainer: {
    flex: 1,
  },
  primaryActionText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.background,
    marginBottom: 4,
  },
  primaryActionSubtext: {
    fontSize: 14,
    color: Colors.background,
    opacity: 0.9,
  },
  primaryActionArrow: {
    fontSize: 24,
    color: Colors.background,
    opacity: 0.8,
  },
  secondaryActionButton: {
    backgroundColor: Colors.background,
    padding: 18,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  secondaryActionIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  secondaryActionTextContainer: {
    flex: 1,
  },
  secondaryActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  secondaryActionSubtext: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  sessionCard: {
    backgroundColor: Colors.background,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sessionDate: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  sessionStorage: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  sessionStats: {
    flexDirection: 'row',
    marginTop: 8,
  },
  sessionStat: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginRight: 16,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  quickModesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickModeCard: {
    width: (SCREEN_WIDTH - 60) / 2, // 2 columns with padding
    backgroundColor: Colors.background,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  quickModeIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  quickModeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  quickModeSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  quickModeSubtext: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});

