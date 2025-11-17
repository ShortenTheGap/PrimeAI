/**
 * API Configuration
 * Automatically switches between local development and production
 */

// Determine if we're in development or production
const ENV = {
  dev: {
    apiUrl: 'http://localhost:5000',
    name: 'Development'
  },
  prod: {
    apiUrl: 'https://your-railway-app.up.railway.app', // Update this after Railway deployment
    name: 'Production'
  }
};

// Function to get the correct environment
const getEnvVars = () => {
  // __DEV__ is set by React Native packager
  // When running with 'expo start', __DEV__ is true
  // When built for TestFlight/production, __DEV__ is false
  if (__DEV__) {
    return ENV.dev;
  } else {
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
