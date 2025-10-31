import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, FlatList, Image, TouchableOpacity, Dimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { getFavoritePhotos } from '../utils/storage';
import { Colors } from '../constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ITEM_SIZE = (SCREEN_WIDTH - 40) / 3;

export default function FavoritesScreen({ navigation }) {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFavorites();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadFavorites();
    });
    return unsubscribe;
  }, [navigation]);

  const loadFavorites = async () => {
    try {
      const photos = await getFavoritePhotos();
      setFavorites(photos);
      setLoading(false);
    } catch (error) {
      console.error('Error loading favorites:', error);
      setLoading(false);
    }
  };

  const renderItem = ({ item, index }) => (
    <TouchableOpacity 
      style={[
        styles.item,
        { marginRight: (index + 1) % 3 === 0 ? 0 : 10 }
      ]}
      onPress={() => {
        // Could navigate to a full-screen view
        console.log('View favorite:', item.id);
      }}
    >
      <Image 
        source={{ uri: item.uri }} 
        style={styles.image}
        resizeMode="cover"
      />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading favorites...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      
      <View style={styles.header}>
        <Text style={styles.title}>Favorites</Text>
        <Text style={styles.subtitle}>{favorites.length} photos</Text>
      </View>

      {favorites.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>⭐</Text>
          <Text style={styles.emptyText}>No favorites yet</Text>
          <Text style={styles.emptySubtext}>
            Swipe up on photos to add them to favorites
          </Text>
          <TouchableOpacity 
            style={styles.button}
            onPress={() => navigation.navigate('Swipe')}
          >
            <Text style={styles.buttonText}>Start Swiping</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={favorites}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          numColumns={3}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
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
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: Colors.primary,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.background,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.background,
    opacity: 0.9,
  },
  list: {
    padding: 10,
  },
  item: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    marginBottom: 10,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: Colors.accent,
  },
  image: {
    width: '100%',
    height: '100%',
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
  },
  emptySubtext: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 30,
  },
  button: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 24,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.background,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 40,
  },
});

