import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Text, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as MediaLibrary from 'expo-media-library';
import SwipeCard from '../components/SwipeCard';
import { detectDuplicatesAndSimilar } from '../utils/photoDetection';
import { saveDeletedPhoto, saveFavoritePhoto, saveCleanupSession, getDeletedPhotos, getFavoritePhotos, restorePhoto } from '../utils/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../constants/colors';

export default function SwipeScreen({ navigation, route }) {
  const [photos, setPhotos] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [deletedCount, setDeletedCount] = useState(0);
  const [keptCount, setKeptCount] = useState(0);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [storageCleared, setStorageCleared] = useState(0);
  const [swipeHistory, setSwipeHistory] = useState([]); // Track swiped photos for undo
  const [showInstructions, setShowInstructions] = useState(false);
  const cleanupMode = route?.params?.mode || 'all';

  useEffect(() => {
    loadPhotos();
  }, []);

  const loadPhotos = async () => {
    try {
      setLoading(true);
      setAnalysisProgress(0);
      
      // Request permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'SwipeClean needs access to your photos to help you organize and clean up storage.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
        setLoading(false);
        return;
      }

      // Load all photos with pagination
      let allAssets = [];
      let hasNextPage = true;
      let after = null;
      const pageSize = 100;
      let totalCount = 0;
      let pageCount = 0;

      // Get initial count first
      const firstResult = await MediaLibrary.getAssetsAsync({
        mediaType: ['photo'],
        sortBy: ['creationTime'],
        first: 1,
      });
      totalCount = firstResult.totalCount || 1;
      setAnalysisProgress(5); // Start at 5%

      // Reset and load all
      allAssets = [];
      hasNextPage = true;
      after = null;

      while (hasNextPage) {
        const result = await MediaLibrary.getAssetsAsync({
          mediaType: ['photo'],
          sortBy: ['creationTime'],
          first: pageSize,
          after: after,
        });

        allAssets = [...allAssets, ...result.assets];
        hasNextPage = result.hasNextPage;
        after = result.endCursor;
        pageCount++;
        
        // Update progress while loading (5-45%)
        // Use page estimation if totalCount not reliable
        const estimatedTotal = totalCount > 0 ? totalCount : allAssets.length + (hasNextPage ? pageSize : 0);
        const loadProgress = Math.min(45, 5 + (allAssets.length / Math.max(estimatedTotal, 1)) * 40);
        setAnalysisProgress(loadProgress);
        
        // Safety check - limit to prevent infinite loops
        if (pageCount > 1000) {
          console.warn('Photo loading limit reached');
          break;
        }
      }

      if (allAssets.length === 0) {
        Alert.alert('No Photos', 'No photos found in your library.');
        setLoading(false);
        return;
      }

      // Map assets to photo format
      // We'll get local URIs on-demand in SwipeCard to avoid blocking
      const photoData = allAssets.map(asset => ({
        id: asset.id,
        uri: asset.uri, // Keep original URI, SwipeCard will convert if needed
        width: asset.width || 0,
        height: asset.height || 0,
        size: asset.fileSize || 0,
        creationTime: asset.creationTime * 1000, // Convert to milliseconds
      }));

      // Start analysis
      setLoading(false);
      setAnalyzing(true);
      setAnalysisProgress(50);

      // Process photos and detect duplicates/similar with progress
      const processedPhotos = await detectDuplicatesAndSimilar(
        photoData,
        (progress) => {
          // Progress from 50% to 100% during analysis
          setAnalysisProgress(50 + (progress * 0.5));
        }
      );

      // Filter photos based on cleanup mode
      let filteredPhotos = processedPhotos;
      
      switch (cleanupMode) {
        case 'screenshots':
          filteredPhotos = processedPhotos.filter(p => 
            p.categories?.includes('screenshot')
          );
          break;
        case 'duplicates':
          filteredPhotos = processedPhotos.filter(p => 
            p.isDuplicate || p.categories?.includes('duplicate') || p.categories?.includes('similar')
          );
          break;
        case 'large':
          // Filter photos larger than 5MB
          filteredPhotos = processedPhotos.filter(p => 
            (p.size || 0) > 5 * 1024 * 1024
          ).sort((a, b) => (b.size || 0) - (a.size || 0)); // Largest first
          break;
        case 'old':
          // Filter photos older than 1 year or marked as old_unused
          const oneYearAgo = Date.now() - (365 * 24 * 60 * 60 * 1000);
          filteredPhotos = processedPhotos.filter(p => 
            p.categories?.includes('old_unused') || p.creationTime < oneYearAgo
          ).sort((a, b) => a.creationTime - b.creationTime); // Oldest first
          break;
        case 'lowquality':
          filteredPhotos = processedPhotos.filter(p => 
            p.categories?.includes('low_quality')
          );
          break;
        case 'all':
        default:
          // Prioritize duplicates and low-quality photos
          filteredPhotos = processedPhotos.sort((a, b) => {
            const aScore = (a.isDuplicate ? 10 : 0) +
                          (a.categories?.includes('low_quality') ? 5 : 0) +
                          (a.categories?.includes('screenshot') ? 3 : 0);
            const bScore = (b.isDuplicate ? 10 : 0) +
                          (b.categories?.includes('low_quality') ? 5 : 0) +
                          (b.categories?.includes('screenshot') ? 3 : 0);
            return bScore - aScore;
          });
          break;
      }
      
      if (filteredPhotos.length === 0 && cleanupMode !== 'all') {
        Alert.alert(
          'No Photos Found', 
          `No photos found matching the ${cleanupMode} filter. Try a different cleanup mode.`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
        setLoading(false);
        return;
      }
      
      const sortedPhotos = filteredPhotos;

      setPhotos(sortedPhotos);
      setAnalyzing(false);
      setAnalysisProgress(100);
      
      // Reset stats for new session
      setCurrentIndex(0);
      setDeletedCount(0);
      setKeptCount(0);
      setFavoriteCount(0);
      setStorageCleared(0);
    } catch (error) {
      console.error('Error loading photos:', error);
      Alert.alert(
        'Error', 
        `Failed to load photos: ${error.message || 'Unknown error'}. Please try again.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
      setLoading(false);
      setAnalyzing(false);
    }
  };

  const finishSession = useCallback(async () => {
    // Don't save session here - only save when photos are actually deleted
    // Marked photos haven't been deleted yet, just saved for review
    const stats = {
      photosReviewed: photos.length,
      deleted: deletedCount, // This is count marked, not actually deleted
      kept: keptCount,
      favorited: favoriteCount,
      storageCleared: 0, // Don't count storage until actually deleted
    };

    // Don't save session with storageCleared=0, only navigate
    navigation.navigate('SessionSummary', { stats });
  }, [photos.length, deletedCount, keptCount, favoriteCount, navigation]);


  const handleSwipe = useCallback(async (action, photo) => {
    try {
      // Add to history for undo
      setSwipeHistory(prev => [...prev, {
        index: currentIndex,
        photo: photo,
        action: action,
        timestamp: Date.now()
      }]);

      if (action === 'delete') {
        // Mark for deletion (save to storage, but don't delete from device yet)
        await saveDeletedPhoto(photo);
        setDeletedCount(prev => prev + 1);
        // Accumulate storage that will be freed when actually deleted
        const photoSize = Number(photo.size) || 0;
        setStorageCleared(prev => prev + photoSize);
      } else if (action === 'keep') {
        setKeptCount(prev => prev + 1);
      } else if (action === 'favorite') {
        await saveFavoritePhoto(photo);
        setFavoriteCount(prev => prev + 1);
      }

      // Small delay to let card animation complete, then move to next photo
      setTimeout(() => {
        setCurrentIndex(prev => {
          const nextIndex = prev + 1;
          if (nextIndex < photos.length) {
            return nextIndex;
          } else {
            // All photos reviewed - finish session
            setTimeout(() => finishSession(), 300);
            return prev;
          }
        });
      }, 300); // Wait for card animation to complete
    } catch (error) {
      console.error('Error handling swipe:', error);
    }
  }, [photos.length, finishSession, currentIndex]);

  const handleUndo = useCallback(async () => {
    if (swipeHistory.length === 0) return;

    const lastSwipe = swipeHistory[swipeHistory.length - 1];
    
    try {
      // Restore photo from deleted list if it was deleted
      if (lastSwipe.action === 'delete') {
        await restorePhoto(lastSwipe.photo.id);
        setDeletedCount(prev => Math.max(0, prev - 1));
        const photoSize = Number(lastSwipe.photo.size) || 0;
        setStorageCleared(prev => Math.max(0, prev - photoSize));
      } else if (lastSwipe.action === 'favorite') {
        // Remove from favorites if favorited
        const favorites = await getFavoritePhotos();
        const filtered = favorites.filter(p => p.id !== lastSwipe.photo.id);
        await AsyncStorage.setItem('swipeclean:favorite_photos', JSON.stringify(filtered));
        setFavoriteCount(prev => Math.max(0, prev - 1));
      }

      // Go back to previous photo
      setCurrentIndex(lastSwipe.index);
      setSwipeHistory(prev => prev.slice(0, -1));
    } catch (error) {
      console.error('Error undoing swipe:', error);
    }
  }, [swipeHistory]);

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  const goToNext = useCallback(() => {
    if (currentIndex < photos.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, photos.length]);


  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading || analyzing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>
          {loading ? 'Loading photos from library...' : 'Analyzing photos for duplicates...'}
        </Text>
        {analysisProgress > 0 && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${analysisProgress}%` }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>{Math.round(analysisProgress)}%</Text>
          </View>
        )}
      </View>
    );
  }

  if (photos.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No photos to review</Text>
        <TouchableOpacity style={styles.button} onPress={loadPhotos}>
          <Text style={styles.buttonText}>Reload Photos</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentPhoto = photos[currentIndex];
  const remaining = photos.length - currentIndex;

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      
      {/* Header with home button */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.homeButton}
          onPress={() => navigation.navigate('Dashboard')}
        >
          <Text style={styles.homeButtonText}>🏠</Text>
        </TouchableOpacity>
        
        <View style={styles.headerStats}>
          {cleanupMode !== 'all' && (
            <View style={styles.modeBadge}>
              <Text style={styles.modeBadgeText}>
                {cleanupMode === 'screenshots' ? '📱 Screenshots' :
                 cleanupMode === 'duplicates' ? '🔄 Duplicates' :
                 cleanupMode === 'large' ? '📦 Large Files' :
                 cleanupMode === 'old' ? '📅 Old Photos' :
                 cleanupMode === 'lowquality' ? '🌫️ Low Quality' : ''}
              </Text>
            </View>
          )}
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{deletedCount}</Text>
            <Text style={styles.statLabel}>Deleted</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{remaining}</Text>
            <Text style={styles.statLabel}>Remaining</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{formatBytes(storageCleared)}</Text>
            <Text style={styles.statLabel}>Cleared</Text>
          </View>
        </View>
      </View>
      

      {/* Swipe cards stack */}
      <View style={styles.cardsContainer}>
        {currentIndex < photos.length && currentPhoto && (
          <SwipeCard
            key={`photo-${currentPhoto.id}-${currentIndex}`}
            photo={currentPhoto}
            onSwipe={handleSwipe}
            index={currentIndex}
            total={photos.length}
          />
        )}
        
        {/* Next card preview (stack effect) */}
        {currentIndex + 1 < photos.length && (
          <View style={styles.nextCard}>
            {/* Placeholder for next card */}
          </View>
        )}
      </View>

      {/* Bottom Controls - Delicate and Small */}
      <View style={styles.bottomControls}>
        <View style={styles.navigationControls}>
          <TouchableOpacity 
            style={[styles.navButton, currentIndex === 0 && styles.navButtonDisabled]}
            onPress={goToPrevious}
            disabled={currentIndex === 0}
          >
            <Text style={styles.navButtonText}>←</Text>
          </TouchableOpacity>

          {/* Undo Button */}
          {swipeHistory.length > 0 && (
            <TouchableOpacity 
              style={styles.undoButton}
              onPress={handleUndo}
            >
              <Text style={styles.undoButtonText}>↶</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={[styles.navButton, currentIndex >= photos.length - 1 && styles.navButtonDisabled]}
            onPress={goToNext}
            disabled={currentIndex >= photos.length - 1}
          >
            <Text style={styles.navButtonText}>→</Text>
          </TouchableOpacity>
        </View>

        {/* Help Button */}
        <TouchableOpacity 
          style={styles.helpButton}
          onPress={() => setShowInstructions(!showInstructions)}
        >
          <Text style={styles.helpButtonText}>?</Text>
        </TouchableOpacity>

        {/* Instructions Modal */}
        {showInstructions && (
          <View style={styles.instructionsModal}>
            <View style={styles.instructionsContent}>
              <TouchableOpacity 
                style={styles.closeInstructions}
                onPress={() => setShowInstructions(false)}
              >
                <Text style={styles.closeInstructionsText}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.instructionsTitle}>How to Use</Text>
              <View style={styles.instructionRow}>
                <Text style={styles.instructionIcon}>← Swipe Left</Text>
                <Text style={styles.instructionLabel}>DELETE</Text>
              </View>
              <View style={styles.instructionRow}>
                <Text style={styles.instructionIcon}>→ Swipe Right</Text>
                <Text style={styles.instructionLabel}>KEEP</Text>
              </View>
              <View style={styles.instructionRow}>
                <Text style={styles.instructionIcon}>↑ Swipe Up</Text>
                <Text style={styles.instructionLabel}>FAVORITE</Text>
              </View>
              <View style={styles.instructionRow}>
                <Text style={styles.instructionIcon}>← →</Text>
                <Text style={styles.instructionLabel}>Navigate</Text>
              </View>
              <View style={styles.instructionRow}>
                <Text style={styles.instructionIcon}>↶</Text>
                <Text style={styles.instructionLabel}>Undo</Text>
              </View>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  progressContainer: {
    marginTop: 20,
    width: '80%',
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: Colors.accent,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  progressText: {
    marginTop: 8,
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  button: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  buttonText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: Colors.accent,
  },
  homeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  homeButtonText: {
    fontSize: 24,
  },
  headerStats: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  modeBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 8,
  },
  modeBadgeText: {
    color: Colors.background,
    fontSize: 12,
    fontWeight: '600',
  },
  pendingDeletionsBadge: {
    backgroundColor: Colors.warning,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  pendingDeletionsText: {
    color: Colors.background,
    fontSize: 12,
    fontWeight: '600',
  },
  statBox: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  cardsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100, // Space for bottom controls
  },
  nextCard: {
    position: 'absolute',
    width: '85%',
    height: '65%',
    backgroundColor: Colors.accent,
    borderRadius: 20,
    zIndex: -1,
    marginTop: 10,
    marginLeft: 5,
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    paddingTop: 12,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  navigationControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 198, 174, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
    marginHorizontal: 12,
  },
  navButtonDisabled: {
    opacity: 0.3,
    backgroundColor: 'rgba(102, 102, 102, 0.7)',
  },
  navButtonText: {
    fontSize: 22,
    color: Colors.background,
    fontWeight: '600',
  },
  undoButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 149, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
    marginHorizontal: 12,
  },
  undoButtonText: {
    color: Colors.background,
    fontSize: 22,
    fontWeight: '600',
  },
  helpButton: {
    position: 'absolute',
    top: -40,
    right: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 198, 174, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  helpButtonText: {
    color: Colors.background,
    fontSize: 18,
    fontWeight: 'bold',
  },
  instructionsModal: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  instructionsContent: {
    backgroundColor: Colors.background,
    borderRadius: 20,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  closeInstructions: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeInstructionsText: {
    fontSize: 18,
    color: Colors.text,
    fontWeight: 'bold',
  },
  instructionsTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  instructionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.accent,
  },
  instructionIcon: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
    flex: 1,
  },
  instructionLabel: {
    fontSize: 16,
    color: Colors.text,
    flex: 1,
    textAlign: 'right',
  },
});
