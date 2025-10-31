import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DashboardScreen from './src/screens/DashboardScreen';
import SwipeScreen from './src/screens/SwipeScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import SessionSummaryScreen from './src/screens/SessionSummaryScreen';
import FavoritesScreen from './src/screens/FavoritesScreen';
import ReviewDeletionsScreen from './src/screens/ReviewDeletionsScreen';
import { Colors } from './src/constants/colors';

const Stack = createNativeStackNavigator();

export default function App() {
  const [hasOnboarded, setHasOnboarded] = useState(null);
  const [initialRoute, setInitialRoute] = useState('Onboarding');

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    try {
      const value = await AsyncStorage.getItem('swipeclean:onboarded');
      const onboarded = value === 'true';
      setHasOnboarded(onboarded);
      setInitialRoute(onboarded ? 'Dashboard' : 'Onboarding');
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      setHasOnboarded(false);
    }
  };

  const handleOnboardingComplete = async () => {
    try {
      await AsyncStorage.setItem('swipeclean:onboarded', 'true');
      setHasOnboarded(true);
    } catch (error) {
      console.error('Error saving onboarding status:', error);
    }
  };

  if (hasOnboarded === null) {
    // Show loading state while checking
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <StatusBar style="auto" />
          <Stack.Navigator
            initialRouteName={initialRoute}
            screenOptions={{
              headerStyle: {
                backgroundColor: Colors.primary,
              },
              headerTintColor: Colors.background,
              headerTitleStyle: {
                fontWeight: 'bold',
              },
            }}
          >
            <Stack.Screen 
              name="Onboarding" 
              options={{ headerShown: false }}
            >
              {(props) => (
                <OnboardingScreen 
                  {...props} 
                  onComplete={handleOnboardingComplete}
                />
              )}
            </Stack.Screen>
            <Stack.Screen 
              name="Dashboard" 
              component={DashboardScreen}
              options={{
                title: 'SwipeClean',
                headerShown: false,
              }}
            />
            <Stack.Screen 
              name="Swipe" 
              component={SwipeScreen}
              options={{
                title: 'Cleanup Session',
                headerShown: false,
                gestureEnabled: true,
              }}
            />
            <Stack.Screen 
              name="SessionSummary" 
              component={SessionSummaryScreen}
              options={{
                title: 'Session Summary',
                headerShown: true,
                presentation: 'modal',
              }}
            />
            <Stack.Screen 
              name="Favorites" 
              component={FavoritesScreen}
              options={{
                title: 'Favorites',
                headerShown: true,
              }}
            />
            <Stack.Screen 
              name="ReviewDeletions" 
              component={ReviewDeletionsScreen}
              options={{
                title: 'Review Deletions',
                headerShown: false,
              }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

