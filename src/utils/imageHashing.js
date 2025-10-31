// Image hashing utilities for duplicate detection
// Uses metadata-based approach that works in Expo Go
// (ImageManipulator requires development build, so we use metadata only)

/**
 * Create a simple hash from a string
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Generate a signature for an image based on its properties
 * This creates a fingerprint that can be used to identify duplicates
 * Uses metadata-only approach (works in Expo Go without native modules)
 */
export function generateImageSignature(photo) {
  // Create signature from metadata:
  // 1. Image dimensions (exact match = likely duplicate)
  // 2. File size (similar size = likely duplicate)
  // 3. Creation time rounded to minute (burst shots)
  // 4. Filename base (for copy detection)
  const filename = extractFileName(photo.uri);
  const filenameBase = filename.replace(/\s*\([0-9]+\)\s*/g, '')
                               .replace(/-copy/i, '')
                               .replace(/-\d+$/i, '')
                               .toLowerCase();
  
  // Round creation time to nearest minute for burst shot detection
  const timeRounded = Math.floor(photo.creationTime / 60000); // Minutes
  
  // Create signature string
  const signatureString = [
    photo.width,
    photo.height,
    Math.round(photo.size / 1000), // Round to nearest KB for flexibility
    timeRounded,
    filenameBase,
  ].join('|');

  return simpleHash(signatureString);
}

/**
 * Calculate similarity between two image signatures
 * Returns a value between 0 (identical) and 1 (completely different)
 */
export function calculateSimilarity(sig1, sig2) {
  if (sig1 === sig2) return 0; // Identical
  
  // Calculate Hamming distance for similarity
  let distance = 0;
  const minLength = Math.min(sig1.length, sig2.length);
  
  for (let i = 0; i < minLength; i++) {
    if (sig1[i] !== sig2[i]) distance++;
  }
  
  // Normalize to 0-1 range
  return distance / Math.max(sig1.length, sig2.length);
}

/**
 * Extract file name from URI for additional duplicate detection
 */
export function extractFileName(uri) {
  const parts = uri.split('/');
  return parts[parts.length - 1] || '';
}

/**
 * Check if two photos are likely duplicates based on filename patterns
 */
export function areLikelyDuplicatesByFilename(uri1, uri2) {
  const name1 = extractFileName(uri1);
  const name2 = extractFileName(uri2);
  
  // Check for common duplicate patterns:
  // - IMG_1234.jpg vs IMG_1234 (1).jpg
  // - photo.jpg vs photo-copy.jpg
  // - etc.
  
  const base1 = name1.replace(/\s*\([0-9]+\)\s*/g, '').replace(/-copy/i, '').replace(/-\d+$/i, '');
  const base2 = name2.replace(/\s*\([0-9]+\)\s*/g, '').replace(/-copy/i, '').replace(/-\d+$/i, '');
  
  return base1 === base2 && name1 !== name2;
}

