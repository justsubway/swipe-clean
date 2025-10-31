import React, { useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as MediaLibrary from 'expo-media-library';
import { Colors } from '../constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function OnboardingScreen({ navigation, onComplete }) {
  const [loading, setLoading] = useState(false);

  const requestPermissions = async () => {
    try {
      setLoading(true);
      const { status } = await MediaLibrary.requestPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'SwipeClean needs access to your photos to help you organize and clean up storage.',
        );
        setLoading(false);
        return;
      }
      
      // Permissions granted
      if (onComplete) {
        onComplete();
        navigation.replace('Dashboard');
      } else {
        navigation.replace('Dashboard');
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
      Alert.alert('Error', 'Failed to request permissions. Please try again.');
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>📸</Text>
        </View>
        
        <Text style={styles.title}>Welcome to SwipeClean</Text>
        <Text style={styles.subtitle}>
          Organize your photos with intuitive swipe gestures
        </Text>
        
        <View style={styles.features}>
          <View style={styles.feature}>
            <Text style={styles.featureIcon}>👆</Text>
            <Text style={styles.featureText}>
              Swipe left to delete, right to keep, up to favorite
            </Text>
          </View>
          
          <View style={styles.feature}>
            <Text style={styles.featureIcon}>🔍</Text>
            <Text style={styles.featureText}>
              Automatically detect duplicates and similar photos
            </Text>
          </View>
          
          <View style={styles.feature}>
            <Text style={styles.featureIcon}>🔒</Text>
            <Text style={styles.featureText}>
              All processing happens on your device for privacy
            </Text>
          </View>
        </View>
        
        <TouchableOpacity 
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={requestPermissions}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Requesting Access...' : 'Get Started'}
          </Text>
        </TouchableOpacity>
        
        <Text style={styles.permissionText}>
          SwipeClean needs access to your photo library to help you organize and clean up storage.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 80,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  icon: {
    fontSize: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.background,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: Colors.background,
    opacity: 0.9,
    textAlign: 'center',
    marginBottom: 40,
  },
  features: {
    width: '100%',
    marginBottom: 40,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  featureIcon: {
    fontSize: 28,
    marginRight: 15,
  },
  featureText: {
    flex: 1,
    fontSize: 16,
    color: Colors.background,
    opacity: 0.9,
  },
  button: {
    backgroundColor: Colors.background,
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  permissionText: {
    fontSize: 12,
    color: Colors.background,
    opacity: 0.7,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});

