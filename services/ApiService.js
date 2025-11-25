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

// Request interceptor to add user_id header
apiClient.interceptors.request.use(
  (config) => {
    try {
      const userId = userService.getUserId();
      config.headers['x-user-id'] = userId;
      console.log('📤 API Request:', config.method?.toUpperCase(), config.url, '| User:', userId);
    } catch (error) {
      console.warn('⚠️ User not initialized for API request:', config.url);
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
