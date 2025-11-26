import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import { Platform } from 'react-native';
import axios from 'axios';
import { API_URL } from '../config/api';

const USER_STORAGE_KEY = '@primeai:user';
const TOKEN_STORAGE_KEY = '@primeai:token';

class UserService {
  constructor() {
    this.currentUser = null;
    this.authToken = null;
  }

  /**
   * Get or create the device-based user
   */
  async initializeUser() {
    try {
      // Check if user already exists in storage
      const storedUser = await AsyncStorage.getItem(USER_STORAGE_KEY);

      if (storedUser) {
        this.currentUser = JSON.parse(storedUser);
        console.log('✅ User loaded from storage:', this.currentUser.userId);
        return this.currentUser;
      }

      // Get device ID
      const deviceId = await this.getDeviceId();
      const deviceName = await this.getDeviceName();

      console.log('📱 Device ID:', deviceId);
      console.log('📱 Device Name:', deviceName);

      // Register user with backend
      const response = await axios.post(`${API_URL}/api/users/register`, {
        deviceId,
        deviceName
      });

      this.currentUser = {
        userId: response.data.userId,
        deviceId: response.data.deviceId,
        deviceName: response.data.deviceName,
        isNewUser: response.data.isNewUser
      };

      // Store user data
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(this.currentUser));

      console.log('✅ User initialized:', this.currentUser.userId);
      console.log('🆕 Is new user:', this.currentUser.isNewUser);

      return this.currentUser;
    } catch (error) {
      console.error('❌ Error initializing user:', error);
      throw error;
    }
  }

  /**
   * Get unique device ID
   */
  async getDeviceId() {
    try {
      if (Platform.OS === 'ios') {
        // For iOS, use vendor ID
        const vendorId = await Application.getIosIdForVendorAsync();
        return vendorId || `ios_${Date.now()}`;
      } else if (Platform.OS === 'android') {
        // For Android, use Android ID
        return Application.androidId || `android_${Date.now()}`;
      } else {
        // For web/other platforms
        return `web_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      }
    } catch (error) {
      console.error('Error getting device ID:', error);
      // Fallback to timestamp + random
      return `device_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
  }

  /**
   * Get device name
   */
  async getDeviceName() {
    try {
      const deviceName = Application.applicationName || 'Unknown Device';
      const osName = Platform.OS;
      const osVersion = Platform.Version;

      return `${deviceName} (${osName} ${osVersion})`;
    } catch (error) {
      console.error('Error getting device name:', error);
      return 'Unknown Device';
    }
  }

  /**
   * Get current user ID
   */
  getUserId() {
    if (!this.currentUser) {
      throw new Error('User not initialized. Call initializeUser() first.');
    }
    return this.currentUser.userId;
  }

  /**
   * Get current user data
   */
  getUser() {
    return this.currentUser;
  }

  /**
   * Save authentication token
   */
  async saveToken(token) {
    this.authToken = token;
    await AsyncStorage.setItem(TOKEN_STORAGE_KEY, token);
  }

  /**
   * Get authentication token
   */
  async getToken() {
    if (this.authToken) {
      return this.authToken;
    }
    this.authToken = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
    return this.authToken;
  }

  /**
   * Check if user is authenticated (has valid token or device-based user)
   */
  async isAuthenticated() {
    const token = await this.getToken();
    const storedUser = await AsyncStorage.getItem(USER_STORAGE_KEY);
    return !!(token || storedUser);
  }

  /**
   * Login with email and password
   */
  async login(token, user) {
    this.currentUser = {
      userId: user.userId,
      email: user.email,
      authMethod: 'email'
    };
    this.authToken = token;

    await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(this.currentUser));
    await AsyncStorage.setItem(TOKEN_STORAGE_KEY, token);

    console.log('✅ User logged in:', this.currentUser.email);
    return this.currentUser;
  }

  /**
   * Logout user
   */
  async logout() {
    this.currentUser = null;
    this.authToken = null;
    await AsyncStorage.removeItem(USER_STORAGE_KEY);
    await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
    console.log('👋 User logged out');
  }

  /**
   * Clear user data (for testing/logout)
   */
  async clearUser() {
    await this.logout();
  }
}

// Export singleton instance
const userService = new UserService();
export default userService;
