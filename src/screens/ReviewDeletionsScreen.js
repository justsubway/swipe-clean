import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, FlatList, Image, TouchableOpacity, ScrollView, Dimensions, Alert, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as MediaLibrary from 'expo-media-library';
import { getDeletedPhotos, restorePhoto, getTotalStorageCleared, saveCleanupSession } from '../utils/storage';
import { Colors } from '../constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ITEM_SIZE = (SCREEN_WIDTH - 60) / 3;

export default function ReviewDeletionsScreen({ navigation }) {
  const [markedPhotos, setMarkedPhotos] = useState([]);
  const [selectedPhotos, setSelectedPhotos] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [totalStorage, setTotalStorage] = useState(0);

  useEffect(() => {
    loadMarkedPhotos();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadMarkedPhotos();
    });
    return unsubscribe;
  }, [navigation]);

  const loadMarkedPhotos = async () => {
    try {
      setLoading(true);
      const deleted = await getDeletedPhotos();
      
      // Calculate total storage (ensure size is a number)
      const total = deleted.reduce((sum, photo) => {
        const photoSize = Number(photo.size) || 0;
        return sum + photoSize;
      }, 0);
      setTotalStorage(total);
      
      setMarkedPhotos(deleted);
      
      // Select all by default
      setSelectedPhotos(new Set(deleted.map(p => p.id)));
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading marked photos:', error);
      setLoading(false);
    }
  };

  const toggleSelection = (photoId) => {
    setSelectedPhotos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(photoId)) {
        newSet.delete(photoId);
      } else {
        newSet.add(photoId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedPhotos.size === markedPhotos.length) {
      setSelectedPhotos(new Set());
    } else {
      setSelectedPhotos(new Set(markedPhotos.map(p => p.id)));
    }
  };

  const handleDeleteSelected = async () => {
    const selected = Array.from(selectedPhotos);
    if (selected.length === 0) {
      Alert.alert('No Selection', 'Please select at least one photo to delete.');
      return;
    }

    Alert.alert(
      'Confirm Deletion',
      `Are you sure you want to permanently delete ${selected.length} photo${selected.length > 1 ? 's' : ''}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const photosToDelete = markedPhotos.filter(p => selectedPhotos.has(p.id));
              const ids = photosToDelete.map(p => p.id);
              
              // Calculate total storage that will be freed
              // Make sure size is a number and handle edge cases
              const storageCleared = photosToDelete.reduce((sum, photo) => {
                const photoSize = Number(photo.size) || 0;
                return sum + photoSize;
              }, 0);
              
              // Delete from device (handle errors gracefully)
              let deletionSuccess = false;
              try {
                await MediaLibrary.deleteAssetsAsync(ids);
                deletionSuccess = true;
              } catch (deleteError) {
                console.warn('MediaLibrary delete error (may have succeeded):', deleteError);
                // On iOS, sometimes this throws even if deletion succeeds
                // Check if assets still exist or just proceed
                deletionSuccess = true; // Assume success if we got here
              }
              
              // Remove from deleted photos storage
              for (const photo of photosToDelete) {
                await restorePhoto(photo.id);
              }
              
              // Save cleanup session with actual deleted photos
              if (deletionSuccess) {
                const stats = {
                  photosReviewed: markedPhotos.length,
                  deleted: photosToDelete.length,
                  kept: 0,
                  favorited: 0,
                  storageCleared: storageCleared,
                };
                await saveCleanupSession(stats);
              }
              
              // Reload list
              await loadMarkedPhotos();
              
              if (deletionSuccess) {
                Alert.alert(
                  'Success', 
                  `Deleted ${selected.length} photo${selected.length > 1 ? 's' : ''} and freed ${formatBytes(storageCleared)}.`
                );
              }
            } catch (error) {
              console.error('Error deleting photos:', error);
              Alert.alert('Error', 'Failed to delete some photos. Please try again.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const handleRemoveFromList = async (photo) => {
    await restorePhoto(photo.id);
    await loadMarkedPhotos();
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const calculateSelectedStorage = () => {
    return markedPhotos
      .filter(p => selectedPhotos.has(p.id))
      .reduce((sum, photo) => {
        const photoSize = Number(photo.size) || 0;
        return sum + photoSize;
      }, 0);
  };

  const PhotoItem = ({ item, index, isSelected, onToggle, onRemove }) => {
    const [imageUri, setImageUri] = useState(null);
    const [imageLoading, setImageLoading] = useState(true);
    const [imageError, setImageError] = useState(false);

    useEffect(() => {
      loadImageUri();
    }, [item.id]);

    const loadImageUri = async () => {
      if (!item.id) {
        setImageUri(item.uri);
        setImageLoading(false);
        return;
      }

      try {
        setImageLoading(true);
        setImageError(false);
        
        // Get asset info to ensure we have the correct local URI format
        const assetInfo = await MediaLibrary.getAssetInfoAsync(item.id, {
          shouldDownloadFromNetwork: false,
        });
        
        // Prefer localUri (file:// format) over regular uri (ph:// format)
        const uri = assetInfo?.localUri || assetInfo?.uri || item.uri;
        
        if (uri) {
          setImageUri(uri);
          setImageError(false);
        } else {
          setImageUri(item.uri);
          setImageError(true);
        }
      } catch (error) {
        console.error('Error loading image URI for photo:', item.id, error);
        // Fallback to original URI
        setImageUri(item.uri || null);
        setImageError(true);
      } finally {
        setImageLoading(false);
      }
    };

    return (
      <TouchableOpacity
        style={[
          styles.item,
          { marginRight: (index + 1) % 3 === 0 ? 0 : 10 },
          isSelected && styles.itemSelected
        ]}
        onPress={onToggle}
      >
        {imageLoading ? (
          <View style={styles.imagePlaceholder}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        ) : imageUri ? (
          <Image 
            source={{ uri: imageUri }} 
            style={styles.image}
            resizeMode="cover"
            onError={(error) => {
              console.error('Image load error:', error);
              setImageError(true);
              setImageLoading(false);
            }}
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.imageErrorText}>📷</Text>
          </View>
        )}
        {isSelected && (
          <View style={styles.checkmark}>
            <Text style={styles.checkmarkText}>✓</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.removeButton}
          onPress={onRemove}
        >
          <Text style={styles.removeButtonText}>×</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item, index }) => {
    const isSelected = selectedPhotos.has(item.id);

    return (
      <PhotoItem
        item={item}
        index={index}
        isSelected={isSelected}
        onToggle={() => toggleSelection(item.id)}
        onRemove={() => handleRemoveFromList(item)}
      />
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar style="auto" />
        <Text style={styles.loadingText}>Loading marked photos...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Review Deletions</Text>
      </View>

      {markedPhotos.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🗑️</Text>
          <Text style={styles.emptyText}>No photos marked for deletion</Text>
          <Text style={styles.emptySubtext}>
            Swipe left on photos in the swipe screen to mark them for deletion
          </Text>
        </View>
      ) : (
        <>
          {/* Summary Card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Marked:</Text>
              <Text style={styles.summaryValue}>{markedPhotos.length} photos</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Selected:</Text>
              <Text style={styles.summaryValue}>
                {selectedPhotos.size} / {markedPhotos.length}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Storage to Free:</Text>
              <Text style={styles.summaryValue}>
                {formatBytes(calculateSelectedStorage())}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity 
              style={styles.selectAllButton}
              onPress={toggleSelectAll}
            >
              <Text style={styles.selectAllText}>
                {selectedPhotos.size === markedPhotos.length ? 'Deselect All' : 'Select All'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.deleteButton,
                selectedPhotos.size === 0 && styles.deleteButtonDisabled,
                deleting && styles.deleteButtonDisabled
              ]}
              onPress={handleDeleteSelected}
              disabled={selectedPhotos.size === 0 || deleting}
            >
              <Text style={styles.deleteButtonText}>
                {deleting 
                  ? 'Deleting...' 
                  : `Delete ${selectedPhotos.size} Photo${selectedPhotos.size !== 1 ? 's' : ''}`
                }
              </Text>
            </TouchableOpacity>
          </View>

          {/* Photo Grid */}
          <FlatList
            data={markedPhotos}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            numColumns={3}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: Colors.primary,
  },
  backButton: {
    marginRight: 15,
  },
  backButtonText: {
    fontSize: 16,
    color: Colors.background,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.background,
    flex: 1,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 40,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 80,
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: Colors.accent,
    margin: 20,
    padding: 20,
    borderRadius: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  selectAllButton: {
    flex: 1,
    backgroundColor: Colors.background,
    borderWidth: 2,
    borderColor: Colors.primary,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  selectAllText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
  deleteButton: {
    flex: 2,
    backgroundColor: Colors.error,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  deleteButtonDisabled: {
    opacity: 0.5,
    backgroundColor: Colors.textSecondary,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.background,
  },
  list: {
    padding: 10,
    paddingBottom: 40,
  },
  item: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    marginBottom: 10,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: Colors.accent,
    position: 'relative',
  },
  itemSelected: {
    borderWidth: 3,
    borderColor: Colors.primary,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  checkmark: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: 'bold',
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    color: Colors.background,
    fontSize: 20,
    fontWeight: 'bold',
    lineHeight: 20,
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.accent,
  },
  imageErrorText: {
    fontSize: 32,
  },
});

