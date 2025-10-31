// Production-ready photo detection utilities for identifying duplicates and similar images

import { generateImageSignature, calculateSimilarity, areLikelyDuplicatesByFilename, extractFileName } from './imageHashing';

export const PhotoCategory = {
  DUPLICATE: 'duplicate',
  SIMILAR: 'similar',
  SCREENSHOT: 'screenshot',
  LOW_QUALITY: 'low_quality',
  BURST: 'burst',
  OLD_UNUSED: 'old_unused',
};

const SIMILARITY_THRESHOLD = 0.1; // Images with similarity < 0.1 are considered duplicates
const TIME_THRESHOLD = 60000; // 1 minute for burst shots

/**
 * Detect duplicates and similar photos using image signatures
 * @param {Array} photos - Array of photo objects with {uri, width, height, size, creationTime, id}
 * @param {Function} onProgress - Optional callback for progress updates
 * @returns {Promise<Array>} Categorized photos with metadata
 */
export async function detectDuplicatesAndSimilar(photos, onProgress) {
  if (!photos || photos.length === 0) {
    return [];
  }

  // Generate signatures for all photos (in batches for better performance)
  const photosWithSignatures = [];
  const total = photos.length;
  const batchSize = 50;
  
  for (let batchStart = 0; batchStart < photos.length; batchStart += batchSize) {
    const batchEnd = Math.min(batchStart + batchSize, photos.length);
    
    for (let i = batchStart; i < batchEnd; i++) {
      const photo = photos[i];
      
      try {
        const signature = generateImageSignature(photo);
        photosWithSignatures.push({
          ...photo,
          signature,
        });
      } catch (error) {
        console.error(`Error processing photo ${photo.id}:`, error);
        // Continue with metadata-only signature
        photosWithSignatures.push({
          ...photo,
          signature: `${photo.width}|${photo.height}|${photo.size}`,
        });
      }
    }

    // Report progress after each batch
    if (onProgress) {
      const progress = Math.round((batchEnd / total) * 100);
      onProgress(progress);
    }
    
    // Allow UI to update between batches
    if (batchEnd < photos.length) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  // Find duplicates and similar photos (optimized comparison)
  const categorized = [];
  const signatureMap = new Map(); // For faster duplicate lookup
  
  // First pass: group by signature (for O(n) duplicate detection instead of O(n²))
  for (let i = 0; i < photosWithSignatures.length; i++) {
    const photo = photosWithSignatures[i];
    if (!signatureMap.has(photo.signature)) {
      signatureMap.set(photo.signature, []);
    }
    signatureMap.get(photo.signature).push({ photo, index: i });
  }
  
  // Report progress after signature grouping
  if (onProgress) {
    onProgress(50);
  }
  
  // Second pass: categorize photos (process in batches to avoid blocking)
  for (let index = 0; index < photosWithSignatures.length; index++) {
    const photo = photosWithSignatures[index];
    const categories = [];
    const duplicates = [];
    const similar = [];
    
    // Allow UI updates every 25 photos
    if (index > 0 && index % 25 === 0) {
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    
    // Check for duplicates using signature map (much faster - O(1) lookup)
    const sameSignaturePhotos = signatureMap.get(photo.signature) || [];
    const duplicateIds = new Set();
    
    for (const { photo: otherPhoto, index: otherIndex } of sameSignaturePhotos) {
      if (otherIndex === index) continue;
      duplicates.push(otherPhoto);
      duplicateIds.add(otherPhoto.id);
    }
    
    // Check filename-based duplicates (only check if we have < 10 duplicates to avoid slowdown)
    if (duplicates.length < 10) {
      const filenameBase = extractFileName(photo.uri)
        .replace(/\s*\([0-9]+\)\s*/g, '')
        .replace(/-copy/i, '')
        .replace(/-\d+$/i, '')
        .toLowerCase();
      
      for (let i = 0; i < photosWithSignatures.length && duplicates.length < 20; i++) {
        if (i === index || duplicateIds.has(photosWithSignatures[i].id)) continue;
        const otherPhoto = photosWithSignatures[i];
        const otherFilenameBase = extractFileName(otherPhoto.uri)
          .replace(/\s*\([0-9]+\)\s*/g, '')
          .replace(/-copy/i, '')
          .replace(/-\d+$/i, '')
          .toLowerCase();
        
        if (filenameBase === otherFilenameBase && filenameBase.length > 0) {
          duplicates.push(otherPhoto);
          duplicateIds.add(otherPhoto.id);
        }
      }
    }
    
    // Check for similar photos (only check nearby photos in sorted array for performance)
    // Skip if we already have duplicates (they're prioritized)
    if (duplicates.length === 0) {
      // Only check 50 nearby photos (before and after in array)
      const checkRange = 25;
      const start = Math.max(0, index - checkRange);
      const end = Math.min(photosWithSignatures.length, index + checkRange);
      
      for (let i = start; i < end; i++) {
        if (i === index || duplicateIds.has(photosWithSignatures[i].id)) continue;
        const otherPhoto = photosWithSignatures[i];
        
        // Only check photos with same dimensions (quick filter)
        if (photo.width !== otherPhoto.width || photo.height !== otherPhoto.height) continue;
        
        const similarSize = Math.abs(photo.size - otherPhoto.size) < Math.max(photo.size * 0.1, 10000);
        const timeDiff = Math.abs(photo.creationTime - otherPhoto.creationTime);
        
        // Similar photos or burst shots
        if (similarSize && timeDiff < TIME_THRESHOLD && similar.length < 5) {
          similar.push(otherPhoto);
        }
      }
    }

    // Categorize
    if (duplicates.length > 0) {
      categories.push(PhotoCategory.DUPLICATE);
      photo.duplicateCount = duplicates.length;
      photo.duplicateIds = duplicates.map(d => d.id);
    }
    
    if (similar.length > 0) {
      if (similar.length > 2) {
        categories.push(PhotoCategory.BURST);
      } else {
        categories.push(PhotoCategory.SIMILAR);
      }
      photo.similarCount = similar.length;
    }

    // Screenshot detection (common device dimensions)
    const isSquare = Math.abs(photo.width - photo.height) < 10;
    const commonScreenshotSizes = [
      { width: 1080, height: 1920 }, // iPhone X
      { width: 1242, height: 2208 }, // iPhone 6/7/8 Plus
      { width: 750, height: 1334 }, // iPhone 6/7/8
      { width: 1440, height: 2560 }, // Android common
      { width: 1080, height: 2340 }, // iPhone 12/13
      { width: 1170, height: 2532 }, // iPhone 14
      { width: 1179, height: 2556 }, // iPhone 14 Pro
      { width: 1284, height: 2778 }, // iPhone 14 Pro Max
    ];
    
    const isScreenshot = isSquare || commonScreenshotSizes.some(
      size => Math.abs(photo.width - size.width) < 50 && 
              Math.abs(photo.height - size.height) < 50
    );
    
    if (isScreenshot) {
      categories.push(PhotoCategory.SCREENSHOT);
    }
    
    // Low quality detection (small file size relative to dimensions)
    const pixels = photo.width * photo.height;
    if (pixels > 0) {
      const bytesPerPixel = photo.size / pixels;
      // Very small files or very low bytes per pixel indicates compression/low quality
      if (photo.size < 50000 || (pixels > 1000000 && bytesPerPixel < 0.1)) {
        categories.push(PhotoCategory.LOW_QUALITY);
      }
    }
    
    // Old unused detection (check creation time)
    const now = Date.now();
    const daysSinceCreation = (now - photo.creationTime) / (1000 * 60 * 60 * 24);
    if (daysSinceCreation > 365) {
      categories.push(PhotoCategory.OLD_UNUSED);
    }
    
    categorized.push({
      ...photo,
      categories: [...new Set(categories)], // Remove duplicates
      isDuplicate: duplicates.length > 0,
      duplicateIds: duplicates.map(d => d.id),
      duplicateCount: duplicates.length,
    });
    
    // Report progress more frequently during categorization
    if (onProgress && (index % 25 === 0 || index === photosWithSignatures.length - 1)) {
      // Progress from 50% to 95% (leave 5% for final sorting)
      const categorizationProgress = 50 + ((index + 1) / photosWithSignatures.length) * 45;
      onProgress(Math.round(categorizationProgress));
    }
  }
  
  // Final progress update
  if (onProgress) {
    onProgress(100);
  }
  
  return categorized;
}

/**
 * Group photos by category for batch operations
 * @param {Array} categorizedPhotos - Photos with categories
 * @returns {Object} Grouped photos by category
 */
export function groupPhotosByCategory(categorizedPhotos) {
  const grouped = {
    [PhotoCategory.DUPLICATE]: [],
    [PhotoCategory.SIMILAR]: [],
    [PhotoCategory.SCREENSHOT]: [],
    [PhotoCategory.LOW_QUALITY]: [],
    [PhotoCategory.BURST]: [],
    [PhotoCategory.OLD_UNUSED]: [],
  };
  
  categorizedPhotos.forEach(photo => {
    photo.categories.forEach(category => {
      if (grouped[category]) {
        grouped[category].push(photo);
      }
    });
  });
  
  return grouped;
}

/**
 * Get duplicate groups (photos that are duplicates of each other)
 * @param {Array} categorizedPhotos - Photos with duplicate info
 * @returns {Array} Array of duplicate groups
 */
export function getDuplicateGroups(categorizedPhotos) {
  const duplicates = categorizedPhotos.filter(p => p.isDuplicate);
  const groups = [];
  const processed = new Set();
  
  duplicates.forEach(photo => {
    if (processed.has(photo.id)) return;
    
    const group = [photo];
    if (photo.duplicateIds) {
      photo.duplicateIds.forEach(dupId => {
        const dupPhoto = categorizedPhotos.find(p => p.id === dupId);
        if (dupPhoto && !processed.has(dupId)) {
          group.push(dupPhoto);
          processed.add(dupId);
        }
      });
    }
    
    if (group.length > 1) {
      groups.push(group);
      processed.add(photo.id);
    }
  });
  
  return groups;
}
