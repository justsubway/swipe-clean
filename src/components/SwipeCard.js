import React, { useState, useEffect } from 'react';
import { View, Image, StyleSheet, Text, Dimensions, ActivityIndicator } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import DuplicateIndicator from './DuplicateIndicator';
import { Colors } from '../constants/colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;
const ROTATION_MAX = 15;

export default function SwipeCard({ photo, onSwipe, index, total }) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const [imageUri, setImageUri] = useState(null);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    // Reset and load image URI when photo changes
    setImageUri(null);
    setImageError(false);
    loadImageUri();
  }, [photo.id]);

  const loadImageUri = async () => {
    if (!photo.id) {
      setImageUri(photo.uri);
      return;
    }

    try {
      // Get asset info to ensure we have the correct local URI format
      // This converts ph:// URIs to file:// URIs that React Native can display
      const assetInfo = await MediaLibrary.getAssetInfoAsync(photo.id, {
        shouldDownloadFromNetwork: false,
      });
      
      // Prefer localUri (file:// format) over regular uri (ph:// format)
      const uri = assetInfo?.localUri || assetInfo?.uri || photo.uri;
      
      if (uri) {
        setImageUri(uri);
        setImageError(false);
      } else {
        setImageUri(photo.uri);
        setImageError(true);
      }
    } catch (error) {
      console.error('Error loading image URI for photo:', photo.id, error);
      // Fallback to original URI - sometimes this works
      setImageUri(photo.uri || null);
      setImageError(true);
    }
  };

  const panGesture = Gesture.Pan()
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      translateX.value = startX.value + event.translationX;
      translateY.value = startY.value + event.translationY;
      
      // Scale down as card moves away
      const distance = Math.sqrt(
        event.translationX ** 2 + event.translationY ** 2
      );
      scale.value = Math.max(0.95, 1 - distance / SCREEN_WIDTH);
    })
    .onEnd((event) => {
      const swipeDistanceX = Math.abs(event.translationX);
      const swipeDistanceY = Math.abs(event.translationY);
      
      if (swipeDistanceX > SWIPE_THRESHOLD) {
        // Horizontal swipe - delete (left) or keep (right)
        const direction = event.translationX > 0 ? 'right' : 'left';
        const action = direction === 'right' ? 'keep' : 'delete';
        
        translateX.value = withSpring(
          direction === 'right' ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5,
          { damping: 15 }
        );
        opacity.value = withTiming(0, { duration: 200 });
        
        runOnJS(onSwipe)(action, photo);
      } else if (swipeDistanceY > SWIPE_THRESHOLD && event.translationY < 0) {
        // Upward swipe - favorite
        translateY.value = withSpring(-SCREEN_HEIGHT * 1.5, { damping: 15 });
        opacity.value = withTiming(0, { duration: 200 });
        
        runOnJS(onSwipe)('favorite', photo);
      } else {
        // Return to center
        translateX.value = withSpring(0, { damping: 15 });
        translateY.value = withSpring(0, { damping: 15 });
        scale.value = withSpring(1, { damping: 15 });
      }
    });

  const cardStyle = useAnimatedStyle(() => {
    const rotateZ = (translateX.value / SCREEN_WIDTH) * ROTATION_MAX;
    
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotateZ: `${rotateZ}deg` },
        { scale: scale.value },
      ],
      opacity: opacity.value,
    };
  });

  const deleteOverlayStyle = useAnimatedStyle(() => {
    const opacity = translateX.value < 0 
      ? Math.min(Math.abs(translateX.value) / SWIPE_THRESHOLD, 1) 
      : 0;
    return { opacity };
  });

  const keepOverlayStyle = useAnimatedStyle(() => {
    const opacity = translateX.value > 0 
      ? Math.min(translateX.value / SWIPE_THRESHOLD, 1) 
      : 0;
    return { opacity };
  });

  const favoriteOverlayStyle = useAnimatedStyle(() => {
    const opacity = translateY.value < 0 
      ? Math.min(Math.abs(translateY.value) / SWIPE_THRESHOLD, 1) 
      : 0;
    return { opacity };
  });

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.card, cardStyle]}>
        {imageUri ? (
          <Image 
            source={{ uri: imageUri }} 
            style={styles.image}
            resizeMode="cover"
            onError={(error) => {
              console.error('Image load error for URI:', imageUri, error);
              setImageError(true);
              // Try fallback URI if available
              if (photo.uri && photo.uri !== imageUri) {
                setImageUri(photo.uri);
              }
            }}
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <ActivityIndicator size="large" color={Colors.primary} />
            {imageError && (
              <Text style={styles.errorText}>Failed to load image</Text>
            )}
          </View>
        )}
        
        {/* Overlay indicators */}
        <Animated.View 
          style={[
            styles.overlay, 
            styles.deleteOverlay,
            deleteOverlayStyle
          ]}
        >
          <Text style={styles.overlayText}>DELETE</Text>
        </Animated.View>
        
        <Animated.View 
          style={[
            styles.overlay, 
            styles.keepOverlay,
            keepOverlayStyle
          ]}
        >
          <Text style={styles.overlayText}>KEEP</Text>
        </Animated.View>
        
        <Animated.View 
          style={[
            styles.overlay, 
            styles.favoriteOverlay,
            favoriteOverlayStyle
          ]}
        >
          <Text style={styles.overlayText}>⭐ FAVORITE</Text>
        </Animated.View>
        
        {/* Duplicate indicator */}
        <DuplicateIndicator photo={photo} />

        {/* Photo info */}
        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            {index + 1} / {total}
          </Text>
          {photo.categories && photo.categories.length > 0 && (
            <View style={styles.categoryContainer}>
              {photo.categories.map((cat, idx) => (
                <View key={idx} style={styles.categoryBadge}>
                  <Text style={styles.categoryText}>
                    {cat.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    width: SCREEN_WIDTH * 0.9,
    height: SCREEN_HEIGHT * 0.7,
    alignSelf: 'center',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: Colors.background,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.accent,
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
  },
  deleteOverlay: {
    borderColor: Colors.error,
    backgroundColor: `${Colors.error}20`,
  },
  keepOverlay: {
    borderColor: Colors.success,
    backgroundColor: `${Colors.success}20`,
  },
  favoriteOverlay: {
    borderColor: Colors.warning,
    backgroundColor: `${Colors.warning}20`,
  },
  overlayText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.text,
  },
  infoContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
  },
  infoText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  categoryBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    marginTop: 4,
  },
  categoryText: {
    color: Colors.background,
    fontSize: 12,
    fontWeight: '600',
  },
});

