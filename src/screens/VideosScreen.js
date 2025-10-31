import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Text, FlatList, TouchableOpacity, Dimensions, ActivityIndicator, Alert, Image, Modal } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as MediaLibrary from 'expo-media-library';
// Note: expo-av Video component for preview
// Using Image as fallback if Video not available
import { saveDeletedPhoto, restorePhoto, getDeletedPhotos } from '../utils/storage';
import { Colors } from '../constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ITEM_SIZE = (SCREEN_WIDTH - 40) / 2;

export default function VideosScreen({ navigation }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideos, setSelectedVideos] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  const [markedForDeletion, setMarkedForDeletion] = useState([]);
  const [previewVideo, setPreviewVideo] = useState(null);

  useEffect(() => {
    loadVideos();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadVideos();
    });
    return unsubscribe;
  }, [navigation]);

  const loadVideos = async () => {
    try {
      setLoading(true);
      
      // Request permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'SwipeClean needs access to your videos to help you organize storage.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
        setLoading(false);
        return;
      }

      // Load all videos
      let allVideos = [];
      let hasNextPage = true;
      let after = null;
      const pageSize = 100;

      while (hasNextPage) {
        const result = await MediaLibrary.getAssetsAsync({
          mediaType: ['video'],
          sortBy: ['creationTime'], // Use valid sortBy, we'll sort by size manually
          first: pageSize,
          after: after,
        });

        allVideos = [...allVideos, ...result.assets];
        hasNextPage = result.hasNextPage;
        after = result.endCursor;
      }

      // Map videos and get file size info
      // Note: In Expo Go, fileSize might not be available, so we'll try to get it from getAssetInfoAsync
      const videosWithInfo = [];
      const batchSize = 10;
      
      for (let i = 0; i < allVideos.length; i += batchSize) {
        const batch = allVideos.slice(i, i + batchSize);
        
        for (const video of batch) {
          let size = video.fileSize || 0;
          
          // Try to get file size from getAssetInfoAsync if not available
          if (!size) {
            try {
              const assetInfo = await MediaLibrary.getAssetInfoAsync(video.id, {
                shouldDownloadFromNetwork: false,
              });
              // Try multiple possible size properties
              size = assetInfo?.localFileSize || 
                     assetInfo?.fileSize || 
                     assetInfo?.size ||
                     (assetInfo?.duration ? Math.round(assetInfo.duration * 1000 * 100) : 0) || // Estimate based on duration
                     0;
            } catch (error) {
              // In Expo Go, this often fails - file sizes will work in dev/prod builds
              // For now, estimate based on duration if available
              if (video.duration) {
                // Rough estimate: ~1MB per minute of video (very rough)
                size = Math.round(video.duration * 60 * 1024 * 1024);
              }
            }
          }
          
          // If still 0, try duration-based estimation
          if (!size && video.duration) {
            // Estimate: ~1-2MB per minute depending on quality
            size = Math.round(video.duration * 90 * 1024 * 1024); // 1.5MB per minute estimate
          }
          
          videosWithInfo.push({
            id: video.id,
            uri: video.uri, // Use original URI
            width: video.width || 0,
            height: video.height || 0,
            size: size,
            duration: video.duration || 0,
            creationTime: video.creationTime * 1000,
          });
        }
        
        // Small delay to prevent blocking
        if (i + batchSize < allVideos.length) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      // Sort by size (largest first) - put 0-size at end
      const sorted = videosWithInfo.sort((a, b) => {
        const sizeA = Number(a.size) || 0;
        const sizeB = Number(b.size) || 0;
        if (sizeA === 0 && sizeB > 0) return 1; // Put 0-size at end
        if (sizeB === 0 && sizeA > 0) return -1;
        return sizeB - sizeA; // Largest first
      });
      
      console.log('Video sizes sample:', sorted.slice(0, 5).map(v => ({ 
        id: v.id.substring(0, 8), 
        size: formatBytes(v.size),
        hasSize: v.size > 0 
      })));
      
      setVideos(sorted);
      setLoading(false);
    } catch (error) {
      console.error('Error loading videos:', error);
      Alert.alert('Error', 'Failed to load videos. Please try again.');
      setLoading(false);
    }
  };

  const toggleSelection = (videoId) => {
    setSelectedVideos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(videoId)) {
        newSet.delete(videoId);
      } else {
        newSet.add(videoId);
      }
      return newSet;
    });
  };

  const handleDeleteSelected = async () => {
    const selected = Array.from(selectedVideos);
    if (selected.length === 0) {
      Alert.alert('No Selection', 'Please select at least one video to delete.');
      return;
    }

    Alert.alert(
      'Confirm Deletion',
      `Are you sure you want to permanently delete ${selected.length} video${selected.length > 1 ? 's' : ''}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const videosToDelete = videos.filter(v => selectedVideos.has(v.id));
              
              // Calculate storage
              const storageCleared = videosToDelete.reduce((sum, v) => {
                const videoSize = Number(v.size) || 0;
                return sum + videoSize;
              }, 0);

              // Mark for deletion (save to storage)
              for (const video of videosToDelete) {
                await saveDeletedPhoto(video); // Reuse photo storage function
              }

              // Delete from device
              const ids = videosToDelete.map(v => v.id);
              try {
                await MediaLibrary.deleteAssetsAsync(ids);
              } catch (deleteError) {
                console.warn('MediaLibrary delete error (may have succeeded):', deleteError);
              }

              // Remove from marked list
              for (const video of videosToDelete) {
                await restorePhoto(video.id);
              }

              // Reload list
              await loadVideos();
              setSelectedVideos(new Set());
              
              Alert.alert(
                'Success', 
                `Deleted ${selected.length} video${selected.length > 1 ? 's' : ''} and freed ${formatBytes(storageCleared)}.`
              );
            } catch (error) {
              console.error('Error deleting videos:', error);
              Alert.alert('Error', 'Failed to delete some videos. Please try again.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const calculateSelectedStorage = () => {
    return videos
      .filter(v => selectedVideos.has(v.id))
      .reduce((sum, video) => {
        const videoSize = Number(video.size) || 0;
        return sum + videoSize;
      }, 0);
  };

  const VideoThumbnail = ({ item }) => {
    const [thumbnailUri, setThumbnailUri] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
      loadThumbnail();
    }, [item.id]);

    const loadThumbnail = async () => {
      try {
        setLoading(true);
        setError(false);
        
        // For videos, getAssetInfoAsync might fail, so use the video's dimensions
        // to create a colored placeholder with video info
        // In Expo Go, video thumbnails from ph:// URIs don't work well
        // So we'll show a nice placeholder instead
        
        // Try to get local URI if possible (for future development builds)
        try {
          const assetInfo = await MediaLibrary.getAssetInfoAsync(item.id, {
            shouldDownloadFromNetwork: false,
          });
          
          // Only use if it's a file:// URI (works), not ph:// (doesn't work for videos)
          if (assetInfo?.localUri && assetInfo.localUri.startsWith('file://')) {
            setThumbnailUri(assetInfo.localUri);
          } else {
            setThumbnailUri(null); // Use placeholder
          }
        } catch (e) {
          // Fall back to placeholder
          setThumbnailUri(null);
        }
      } catch (error) {
        console.warn('Error loading thumbnail:', error);
        setError(true);
        setThumbnailUri(null);
      } finally {
        setLoading(false);
      }
    };

    return (
      <View style={styles.videoThumbnail}>
        {loading ? (
          <View style={[styles.video, styles.loadingPlaceholder]}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        ) : thumbnailUri ? (
          <Image
            source={{ uri: thumbnailUri }}
            style={styles.video}
            resizeMode="cover"
            onError={() => setError(true)}
          />
        ) : (
          <View style={[styles.video, styles.videoPlaceholder]}>
            <View style={styles.placeholderContent}>
              <Text style={styles.placeholderIcon}>🎥</Text>
              <Text style={styles.placeholderDuration}>{formatDuration(item.duration)}</Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderItem = ({ item, index }) => {
    const isSelected = selectedVideos.has(item.id);

    return (
      <TouchableOpacity
        style={[
          styles.item,
          { marginRight: index % 2 === 0 ? 12 : 0 },
          isSelected && styles.itemSelected
        ]}
        onPress={() => toggleSelection(item.id)}
        onLongPress={() => {
          // Long press to preview video
          setPreviewVideo(item);
        }}
      >
        <VideoThumbnail item={item} />
        <View style={styles.videoOverlay}>
          <Text style={styles.durationText}>▶ {formatDuration(item.duration)}</Text>
          <Text style={styles.sizeText}>{formatBytes(item.size)}</Text>
        </View>
        <View style={styles.playIcon}>
          <Text style={styles.playIconText}>▶</Text>
        </View>
        {isSelected && (
          <View style={styles.checkmark}>
            <Text style={styles.checkmarkText}>✓</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar style="auto" />
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading videos...</Text>
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
        <Text style={styles.title}>Videos ({videos.length})</Text>
      </View>

      {/* Summary */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Videos:</Text>
          <Text style={styles.summaryValue}>{videos.length}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Selected:</Text>
          <Text style={styles.summaryValue}>
            {selectedVideos.size} / {videos.length}
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
          style={[
            styles.deleteButton,
            selectedVideos.size === 0 && styles.deleteButtonDisabled,
            deleting && styles.deleteButtonDisabled
          ]}
          onPress={handleDeleteSelected}
          disabled={selectedVideos.size === 0 || deleting}
        >
          <Text style={styles.deleteButtonText}>
            {deleting 
              ? 'Deleting...' 
              : `Delete ${selectedVideos.size} Video${selectedVideos.size !== 1 ? 's' : ''}`
            }
          </Text>
        </TouchableOpacity>
      </View>

      {/* Video Grid */}
      <FlatList
        data={videos}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🎥</Text>
            <Text style={styles.emptyText}>No videos found</Text>
          </View>
        }
      />

      {/* Video Preview Modal */}
      {previewVideo && (
        <Modal
          visible={!!previewVideo}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setPreviewVideo(null)}
        >
          <View style={styles.previewModal}>
            <TouchableOpacity
              style={styles.previewCloseButton}
              onPress={() => setPreviewVideo(null)}
            >
              <Text style={styles.previewCloseText}>✕</Text>
            </TouchableOpacity>
            
            <View style={styles.previewContent}>
              <TouchableOpacity 
                style={styles.previewVideoContainer}
                onPress={() => {
                  // Could open native video player here if needed
                  console.log('Video URI:', previewVideo.uri);
                }}
                activeOpacity={1}
              >
                <Image
                  source={{ uri: previewVideo.uri }}
                  style={styles.previewImage}
                  resizeMode="contain"
                />
                <View style={styles.previewPlayOverlay}>
                  <Text style={styles.previewPlayIcon}>▶</Text>
                </View>
              </TouchableOpacity>
              <View style={styles.previewInfo}>
                <Text style={styles.previewInfoText}>
                  Duration: {formatDuration(previewVideo.duration)}
                </Text>
                <Text style={styles.previewInfoText}>
                  Size: {formatBytes(previewVideo.size)}
                </Text>
                <Text style={styles.previewInfoText}>
                  Dimensions: {previewVideo.width} x {previewVideo.height}
                </Text>
                <Text style={styles.previewHintText}>
                  Tap to open video
                </Text>
              </View>
            </View>
          </View>
        </Modal>
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
    marginTop: 16,
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
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  deleteButton: {
    backgroundColor: Colors.error,
    padding: 16,
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
    height: ITEM_SIZE * 1.2,
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.accent,
    position: 'relative',
  },
  itemSelected: {
    borderWidth: 3,
    borderColor: Colors.primary,
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  video: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.accent,
  },
  loadingPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    opacity: 0.3,
  },
  placeholderContent: {
    alignItems: 'center',
  },
  placeholderIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  placeholderDuration: {
    fontSize: 12,
    color: Colors.text,
    fontWeight: '600',
  },
  playIcon: {
    position: 'absolute',
    top: '40%',
    left: '40%',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIconText: {
    color: Colors.background,
    fontSize: 20,
    marginLeft: 2,
  },
  videoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  durationText: {
    color: Colors.background,
    fontSize: 12,
    fontWeight: '600',
  },
  sizeText: {
    color: Colors.background,
    fontSize: 12,
    fontWeight: '600',
  },
  checkmark: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: Colors.background,
    fontSize: 18,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 40,
  },
  emptyIcon: {
    fontSize: 80,
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 20,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  previewModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewCloseButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  previewCloseText: {
    color: Colors.background,
    fontSize: 24,
    fontWeight: 'bold',
  },
  previewContent: {
    width: '90%',
    height: '70%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewVideoContainer: {
    width: '100%',
    height: '80%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.accent,
  },
  previewPlayOverlay: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewPlayIcon: {
    color: Colors.background,
    fontSize: 36,
    marginLeft: 4,
  },
  previewInfo: {
    marginTop: 20,
    alignItems: 'center',
  },
  previewInfoText: {
    color: Colors.background,
    fontSize: 16,
    marginVertical: 4,
  },
  previewHintText: {
    color: Colors.background,
    fontSize: 14,
    marginTop: 8,
    opacity: 0.7,
  },
});

