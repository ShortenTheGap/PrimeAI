/**
 * API Configuration
 * Automatically switches between local development and production
 */
import Constants from 'expo-constants';

// Determine if we're in development or production
const ENV = {
  dev: {
    // TEMPORARY: Point to Railway for Expo Go testing (no local server needed)
    // Change back to 'http://localhost:5000' if you want to test with local server
    apiUrl: 'https://primeai-production-ec82.up.railway.app',
    name: 'Development (Railway)'
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
  // - null/undefined = might be in bare workflow

  const isStandaloneBuild = Constants.appOwnership === 'standalone';
  const isExpoGo = Constants.appOwnership === 'expo';

  // Debug logging
  console.log('🔍 Environment Detection:');
  console.log('  - Constants.appOwnership:', Constants.appOwnership);
  console.log('  - __DEV__:', __DEV__);
  console.log('  - isStandaloneBuild:', isStandaloneBuild);
  console.log('  - isExpoGo:', isExpoGo);

  // IMPORTANT: Prioritize standalone builds over __DEV__
  // TestFlight and App Store builds should ALWAYS use production
  if (isStandaloneBuild) {
    console.log('☁️ Using PRODUCTION environment (Railway) - Standalone Build');
    console.log('  - API URL:', ENV.prod.apiUrl);
    return ENV.prod;
  }

  // Only use dev environment if in Expo Go or development mode
  if (isExpoGo || __DEV__) {
    console.log('🔧 Using DEVELOPMENT environment (localhost)');
    console.log('  - API URL:', ENV.dev.apiUrl);
    return ENV.dev;
  }

  // Default to production for any other case
  console.log('☁️ Using PRODUCTION environment (Railway) - Default');
  console.log('  - API URL:', ENV.prod.apiUrl);
  return ENV.prod;
};

const config = getEnvVars();

// Export API_URL for use in services
export const API_URL = config.apiUrl;

export default {
  API_URL: config.apiUrl,
  ENV_NAME: config.name,

  // API Endpoints
  endpoints: {
    health: '/api/health',
    contacts: '/api/contacts',
    users: '/api/users',
    transcribe: '/api/transcribe',
    analyzeContext: '/api/analyze-context',
    generateMessage: '/api/generate-message'
  },

  // Helper function to get full URL
  getUrl: (endpoint) => {
    return `${config.apiUrl}${endpoint}`;
  }
};
