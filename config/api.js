/**
 * API Configuration
 * Automatically switches between local development and production
 */
import Constants from 'expo-constants';

// Determine if we're in development or production
const ENV = {
  dev: {
    apiUrl: 'http://localhost:5000',
    name: 'Development'
  },
  prod: {
    apiUrl: 'https://primeai-production-ec82.up.railway.app',
    name: 'Production'
  }
};

// Function to get the correct environment
const getEnvVars = () => {
  // Check if running in Expo Go (development) or standalone build (production)
  // Constants.appOwnership:
  // - 'expo' = running in Expo Go (development)
  // - 'standalone' = built app (TestFlight/App Store)
  const isExpoGo = Constants.appOwnership === 'expo';

  if (isExpoGo || __DEV__) {
    console.log('🔧 Using DEVELOPMENT environment (localhost)');
    return ENV.dev;
  } else {
    console.log('☁️ Using PRODUCTION environment (Railway)');
    return ENV.prod;
  }
};

const config = getEnvVars();

export default {
  API_URL: config.apiUrl,
  ENV_NAME: config.name,

  // API Endpoints
  endpoints: {
    health: '/api/health',
    contacts: '/api/contacts',
    transcribe: '/api/transcribe',
    analyzeContext: '/api/analyze-context',
    generateMessage: '/api/generate-message'
  },

  // Helper function to get full URL
  getUrl: (endpoint) => {
    return `${config.apiUrl}${endpoint}`;
  }
};
