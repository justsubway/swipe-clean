import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { getDeletedPhotos, restorePhoto } from '../utils/storage';
import { Colors } from '../constants/colors';

export default function UndoButton({ onUndo }) {
  const [recentDeleted, setRecentDeleted] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    checkRecentDeletions();
    const interval = setInterval(checkRecentDeletions, 1000);
    return () => clearInterval(interval);
  }, []);

  const checkRecentDeletions = async () => {
    try {
      const deleted = await getDeletedPhotos();
      if (deleted.length > 0) {
        const mostRecent = deleted[deleted.length - 1];
        const timeSinceDeletion = Date.now() - mostRecent.deletedAt;
        
        // Show undo button if deleted within last 5 seconds
        if (timeSinceDeletion < 5000) {
          setRecentDeleted(mostRecent);
          setVisible(true);
        } else {
          setVisible(false);
        }
      } else {
        setVisible(false);
      }
    } catch (error) {
      console.error('Error checking deleted photos:', error);
    }
  };

  const handleUndo = async () => {
    if (!recentDeleted) return;

    try {
      await restorePhoto(recentDeleted.id);
      setVisible(false);
      
      if (onUndo) {
        onUndo(recentDeleted);
      }
    } catch (error) {
      console.error('Error restoring photo:', error);
    }
  };

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.button} onPress={handleUndo}>
        <Text style={styles.buttonText}>↶ Undo Delete</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    zIndex: 1000,
  },
  button: {
    backgroundColor: Colors.primary,
    padding: 12,
    borderRadius: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  buttonText: {
    color: Colors.background,
    fontSize: 14,
    fontWeight: '600',
  },
});

