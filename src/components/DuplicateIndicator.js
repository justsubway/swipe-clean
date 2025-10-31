import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Colors } from '../constants/colors';

export default function DuplicateIndicator({ photo }) {
  if (!photo.isDuplicate && !photo.duplicateCount) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>
          {photo.duplicateCount || 0} Duplicate{photo.duplicateCount > 1 ? 's' : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 10,
  },
  badge: {
    backgroundColor: Colors.error,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  badgeText: {
    color: Colors.background,
    fontSize: 12,
    fontWeight: 'bold',
  },
});

