// Storage utilities for managing photo cleanup and local caching

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  DELETED_PHOTOS: 'swipeclean:deleted_photos',
  FAVORITE_PHOTOS: 'swipeclean:favorite_photos',
  CLEANUP_HISTORY: 'swipeclean:cleanup_history',
  SETTINGS: 'swipeclean:settings',
};

/**
 * Save deleted photo reference (for undo functionality)
 */
export async function saveDeletedPhoto(photo) {
  try {
    const deleted = await getDeletedPhotos();
    deleted.push({
      ...photo,
      deletedAt: Date.now(),
    });
    await AsyncStorage.setItem(STORAGE_KEYS.DELETED_PHOTOS, JSON.stringify(deleted));
  } catch (error) {
    console.error('Error saving deleted photo:', error);
  }
}

/**
 * Get list of recently deleted photos (for undo)
 */
export async function getDeletedPhotos() {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.DELETED_PHOTOS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting deleted photos:', error);
    return [];
  }
}

/**
 * Restore a deleted photo (undo)
 */
export async function restorePhoto(photoId) {
  try {
    const deleted = await getDeletedPhotos();
    const filtered = deleted.filter(p => p.id !== photoId);
    await AsyncStorage.setItem(STORAGE_KEYS.DELETED_PHOTOS, JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error('Error restoring photo:', error);
    return false;
  }
}

/**
 * Save favorite photo
 */
export async function saveFavoritePhoto(photo) {
  try {
    const favorites = await getFavoritePhotos();
    if (!favorites.find(p => p.id === photo.id)) {
      favorites.push(photo);
      await AsyncStorage.setItem(STORAGE_KEYS.FAVORITE_PHOTOS, JSON.stringify(favorites));
    }
  } catch (error) {
    console.error('Error saving favorite photo:', error);
  }
}

/**
 * Get favorite photos
 */
export async function getFavoritePhotos() {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.FAVORITE_PHOTOS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting favorite photos:', error);
    return [];
  }
}

/**
 * Save cleanup session statistics
 */
export async function saveCleanupSession(stats) {
  try {
    const history = await getCleanupHistory();
    history.push({
      ...stats,
      timestamp: Date.now(),
    });
    // Keep only last 50 sessions
    const recent = history.slice(-50);
    await AsyncStorage.setItem(STORAGE_KEYS.CLEANUP_HISTORY, JSON.stringify(recent));
  } catch (error) {
    console.error('Error saving cleanup session:', error);
  }
}

/**
 * Get cleanup history
 */
export async function getCleanupHistory() {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.CLEANUP_HISTORY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting cleanup history:', error);
    return [];
  }
}

/**
 * Get total storage cleared across all sessions
 * Only counts actually deleted photos, not just marked ones
 */
export async function getTotalStorageCleared() {
  try {
    const history = await getCleanupHistory();
    // Sum up all storage from sessions where photos were actually deleted
    // Only count sessions where storageCleared > 0 and deleted > 0
    return history.reduce((total, session) => {
      if (session.deleted > 0 && session.storageCleared > 0) {
        const cleared = Number(session.storageCleared) || 0;
        return total + cleared;
      }
      return total;
    }, 0);
  } catch (error) {
    console.error('Error calculating total storage cleared:', error);
    return 0;
  }
}

/**
 * Get count of photos marked for deletion
 */
export async function getMarkedDeletionCount() {
  try {
    const deleted = await getDeletedPhotos();
    return deleted.length;
  } catch (error) {
    console.error('Error getting marked deletion count:', error);
    return 0;
  }
}

