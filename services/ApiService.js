import axios from 'axios';
import userService from './UserService';
import API from '../config/api';

/**
 * Create axios instance with automatic user_id header injection
 */
const apiClient = axios.create({
  baseURL: API.API_URL,
  timeout: 30000,
});

// Request interceptor to add authentication headers
apiClient.interceptors.request.use(
  async (config) => {
    try {
      // Try to get JWT token first (email/password auth)
      const token = await userService.getToken();

      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
        console.log('📤 API Request:', config.method?.toUpperCase(), config.url, '| Auth: JWT');
      } else {
        // Fallback to device-based auth
        try {
          const userId = userService.getUserId();
          config.headers['x-user-id'] = userId;
          console.log('📤 API Request:', config.method?.toUpperCase(), config.url, '| User:', userId);
        } catch (error) {
          console.warn('⚠️ No authentication available for API request:', config.url);
        }
      }
    } catch (error) {
      console.warn('⚠️ Error setting auth headers:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for logging
apiClient.interceptors.response.use(
  (response) => {
    console.log('📥 API Response:', response.config.method?.toUpperCase(), response.config.url, '| Status:', response.status);
    return response;
  },
  (error) => {
    console.error('❌ API Error:', error.config?.method?.toUpperCase(), error.config?.url, '| Status:', error.response?.status);
    return Promise.reject(error);
  }
);

export default apiClient;
