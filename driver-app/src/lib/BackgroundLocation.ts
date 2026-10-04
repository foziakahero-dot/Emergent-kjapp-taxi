// Background Location Tracking Runtime Module
// Implements continuous location tracking for drivers even when app is in background

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

// Define task name for background location
const BACKGROUND_LOCATION_TASK = 'BACKGROUND_LOCATION_TASK';

// Request background location permissions
export const requestBackgroundLocationPermissions = async (): Promise<boolean> => {
  const { status } = await Location.requestBackgroundPermissionsAsync();
  return status === 'granted';
};

// Check if background location permissions are granted
export const hasBackgroundLocationPermissions = async (): Promise<boolean> => {
  const { status } = await Location.getBackgroundPermissionsAsync();
  return status === 'granted';
};

// Start background tracking
export const startBackgroundTracking = async (options: {
  distanceInterval?: number; // meters
  timeInterval?: number; // milliseconds
  accuracy?: Location.LocationAccuracy;
}): Promise<void> => {
  try {
    // Ensure we have permissions
    const hasPermission = await hasBackgroundLocationPermissions();
    if (!hasPermission) {
      const granted = await requestBackgroundLocationPermissions();
      if (!granted) {
        throw new Error('Background location permission not granted');
      }
    }

    // Set default options
    const config = {
      distanceInterval: options.distanceInterval ?? 10, // 10 meters
      timeInterval: options.timeInterval ?? 10000, // 10 seconds
      accuracy: options.accuracy ?? Location.LocationAccuracy.High,
      showsBackgroundLocationIndicator: Platform.ios ? true : undefined,
      pausesUpdatesAutomatically: false,
    };

    // Register background task (if not already registered)
    if (!TaskManager.isTaskRegistered(BACKGROUND_LOCATION_TASK)) {
      TaskManager.defineTask(BACKGROUND_LOCATION_TASK, ({ data, error }: any) => {
        if (error) {
          console.error('Background location error:', error);
          return;
        }
        if (data) {
          const { locations } = data;
          // Process location updates here
          // In a real app, you might send these to a server or store locally
          console.log('Background location update:', locations.length, 'locations');

          // Example: Send to backend or process locations
          locations.forEach((location: Location.LocationObject) => {
            // Process each location point
            // console.log('Location:', location.coords.latitude, location.coords.longitude);
          });
        }
      });
    }

    // Start location updates
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, config);
    console.log('Background location tracking started');
  } catch (error) {
    console.error('Failed to start background location tracking:', error);
    throw error;
  }
};

// Stop background tracking
export const stopBackgroundTracking = async (): Promise<void> => {
  try {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    console.log('Background location tracking stopped');
  } catch (error) {
    console.error('Failed to stop background location tracking:', error);
    throw error;
  }
};

// Get current location (foreground)
export const getCurrentLocation = async (): Promise<Location.LocationObject | null> => {
  try {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Permission to access location was denied');
    }

    const location = await Location.getCurrentPositionAsync({});
    return location;
  } catch (error) {
    console.error('Failed to get current location:', error);
    return null;
  }
};

// Check if location services are enabled
export const isLocationServicesEnabled = async (): Promise<boolean> => {
  const { status } = await Location.hasServicesAsync();
  return status === 'available';
};