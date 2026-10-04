// Connectivity Monitoring Runtime Module
// Monitors and handles online/offline states for both driver and customer apps

import * as Network from 'expo-network';
import * as TaskManager from 'expo-task-manager';

// Define task name for connectivity monitoring
const CONNECTIVITY_TASK = 'CONNECTIVITY_MONITORING_TASK';

// Store the callback for connectivity changes
let connectivityCallback: ((isOnline: boolean) => void) | null = null;

// Setup connectivity monitoring
export const setupConnectivityMonitoring = (
  callback: (isOnline: boolean) => void
): { cleanup: () => void } => {
  // Store the callback
  connectivityCallback = callback;

  // Register the task if not already registered
  if (!TaskManager.isTaskRegistered(CONNECTIVITY_TASK)) {
    TaskManager.defineTask(CONNECTIVITY_TASK, ({ data, error }: any) => {
      if (error) {
        console.error('Connectivity monitoring error:', error);
        return;
      }
      if (data) {
        const { isConnected } = data;
        // Call the callback with connectivity status
        if (connectivityCallback) {
          connectivityCallback(isConnected);
        }
      }
    });
  }

  // Start listening to connectivity changes
  Network.setNetworkStateListenerAsync((state) => {
    const isConnected = state.isConnected ?? false;
    if (connectivityCallback) {
      connectivityCallback(isConnected);
    }
  });

  // Return cleanup function
  return {
    cleanup: () => {
      connectivityCallback = null;
      // Note: We don't unregister the task as it might be used elsewhere
      // In a real app, you might want to track usage and unregister when no longer needed
    }
  };
};

// Check if device is currently online
export const isDeviceOnline = async (): Promise<boolean> => {
  try {
    const networkState = await Network.getNetworkStateAsync();
    return networkState.isConnected ?? false;
  } catch (error) {
    console.error('Failed to get network state:', error);
    // Assume offline if we can't determine
    return false;
  }
};

// Wait until device comes online (with timeout)
export const waitUntilOnline = async (timeoutMs: number = 30000): Promise<boolean> => {
  return new Promise((resolve) => {
    const checkConnectivity = async () => {
      const isOnline = await isDeviceOnline();
      if (isOnline) {
        resolve(true);
      } else {
        // Check again after a short delay
        setTimeout(checkConnectivity, 1000);
      }
    };

    // Start checking
    checkConnectivity();

    // Set timeout
    setTimeout(() => resolve(false), timeoutMs);
  });
};

// Execute a function when device comes online
export const executeWhenOnline = async <T>(
  fn: () => Promise<T> | T,
  timeoutMs: number = 30000
): Promise<T> => {
  // First check if we're already online
  const isOnline = await isDeviceOnline();
  if (isOnline) {
    return fn() as Promise<T>;
  }

  // Wait until online
  const online = await waitUntilOnline(timeoutMs);
  if (!online) {
    throw new Error('Timeout waiting for device to come online');
  }

  // Execute the function
  return fn() as Promise<T>;
};

// Get detailed network information
export const getNetworkInfo = async (): Promise<Network.NetworkState | null> => {
  try {
    return await Network.getNetworkStateAsync();
  } catch (error) {
    console.error('Failed to get network info:', error);
    return null;
  }
};

// Check internet reachability (try to reach a known host)
export const isInternetReachable = async (): Promise<boolean> => {
  try {
    // Try to fetch a small resource to check connectivity
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch('https://www.google.com/generate_204', {
      method: 'HEAD',
      mode: 'no-cors',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    // If we get here, the device is likely not connected to the internet
    return false;
  }
};

// Get connection type (wifi, cellular, etc.)
export const getConnectionType = async (): Promise<string | null> => {
  try {
    const networkState = await Network.getNetworkStateAsync();
    // This is a simplified version - expo-network doesn't directly give connection type
    // You might need to use additional libraries or native code for detailed connection info
    if (networkState.isConnected) {
      // Return a basic indication - in practice, you'd want more detailed info
      return networkState.isConnected ? 'connected' : 'disconnected';
    }
    return null;
  } catch (error) {
    console.error('Failed to get connection type:', error);
    return null;
  }
};