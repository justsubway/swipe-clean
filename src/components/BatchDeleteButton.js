import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Modal, Alert } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { Colors } from '../constants/colors';

export default function BatchDeleteButton({ selectedPhotos, onDeleteComplete }) {
  const [modalVisible, setModalVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleBatchDelete = async () => {
    if (selectedPhotos.length === 0) {
      Alert.alert('No Selection', 'Please select photos to delete.');
      return;
    }

    Alert.alert(
      'Confirm Deletion',
      `Are you sure you want to delete ${selectedPhotos.length} photo${selectedPhotos.length > 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const ids = selectedPhotos.map(p => p.id);
              await MediaLibrary.deleteAssetsAsync(ids);
              
              if (onDeleteComplete) {
                onDeleteComplete(selectedPhotos.length);
              }
              
              Alert.alert('Success', `Deleted ${selectedPhotos.length} photo${selectedPhotos.length > 1 ? 's' : ''}.`);
            } catch (error) {
              console.error('Error deleting photos:', error);
              Alert.alert('Error', 'Failed to delete some photos. Please try again.');
            } finally {
              setDeleting(false);
              setModalVisible(false);
            }
          },
        },
      ]
    );
  };

  if (selectedPhotos.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, deleting && styles.buttonDisabled]}
        onPress={handleBatchDelete}
        disabled={deleting}
      >
        <Text style={styles.buttonText}>
          {deleting ? 'Deleting...' : `Delete ${selectedPhotos.length} Photo${selectedPhotos.length > 1 ? 's' : ''}`}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    zIndex: 1000,
  },
  button: {
    backgroundColor: Colors.error,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

