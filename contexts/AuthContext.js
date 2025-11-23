import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Google from 'expo-auth-session/providers/google';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';

// Complete the auth session when the browser redirects back
WebBrowser.maybeCompleteAuthSession();

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Get Google Client IDs from app.json
  const googleIosClientId = Constants.expoConfig?.extra?.googleIosClientId;
  const googleWebClientId = Constants.expoConfig?.extra?.googleWebClientId;

  // Detect environment
  const isExpoGo = Constants.appOwnership === 'expo';
  const BYPASS_AUTH_IN_EXPO_GO = true; // Expo Go OAuth doesn't work reliably

  console.log('🔧 Auth Environment:', {
    isExpoGo,
    appOwnership: Constants.appOwnership,
    willBypass: isExpoGo && BYPASS_AUTH_IN_EXPO_GO,
    hasIosClientId: !!googleIosClientId,
    hasWebClientId: !!googleWebClientId,
  });

  // Configure redirect URI based on environment
  // Expo Go: Use auth proxy
  // TestFlight/Production: Let expo-auth-session auto-generate the scheme-based URI from iOS client
  const redirectUri = isExpoGo
    ? 'https://auth.expo.io/@gvandender/context-crm'
    : undefined; // Auto-generated from iOS client ID

  console.log('🔗 OAuth Redirect URI:', redirectUri || 'auto-generated from iOS client ID');

  // Configure Google Sign-In with proper client IDs
  // iOS client ID for native app, Web client ID for server-side token exchange
  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: googleIosClientId,
    webClientId: googleWebClientId,
    ...(redirectUri && { redirectUri }), // Only set if explicitly defined
  });

  // Log the actual redirect URI being used after initialization
  useEffect(() => {
    if (request?.redirectUri) {
      console.log('✅ OAuth Request initialized with redirect URI:', request.redirectUri);
    }
  }, [request]);

  // Check for existing session on mount
  useEffect(() => {
    checkStoredAuth();
  }, []);

  // Handle OAuth response
  useEffect(() => {
    if (response) {
      console.log('🔄 OAuth Response Type:', response.type);
      console.log('🔄 Full OAuth Response:', JSON.stringify(response, null, 2));

      if (response?.type === 'success') {
        console.log('✅ OAuth success, fetching user info...');
        const { authentication } = response;
        fetchUserInfo(authentication.accessToken);
      } else if (response?.type === 'error') {
        console.error('❌ OAuth error:', response.error);
        console.error('❌ Error params:', response.params);
      } else if (response?.type === 'cancel') {
        console.log('⚠️ OAuth cancelled by user');
      } else if (response?.type === 'dismiss') {
        console.log('⚠️ OAuth dismissed');
      }
    }
  }, [response]);

  const checkStoredAuth = async () => {
    try {
      // Development bypass: Auto-login ONLY in Expo Go (OAuth doesn't work there)
      // TestFlight/Production will use real Google auth
      if (isExpoGo && BYPASS_AUTH_IN_EXPO_GO) {
        console.log('🔧 DEV MODE: Bypassing authentication in Expo Go');
        const mockUser = {
          id: 'dev-user-123',
          email: 'dev@example.com',
          name: 'Development User',
          picture: 'https://via.placeholder.com/150',
        };
        setUser(mockUser);
        setIsLoading(false);
        return;
      }

      console.log('🔍 Checking for stored authentication...');
      const storedUser = await AsyncStorage.getItem('@user:auth');
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        console.log('✅ Found stored user:', userData.email);
        setUser(userData);
      } else {
        console.log('📭 No stored authentication found');
      }
    } catch (error) {
      console.error('❌ Error loading auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserInfo = async (token) => {
    try {
      console.log('📡 Fetching user info from Google...');
      const response = await fetch(
        'https://www.googleapis.com/userinfo/v2/me',
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const userInfo = await response.json();

      const userData = {
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        accessToken: token,
      };

      console.log('✅ User authenticated:', {
        id: userData.id,
        email: userData.email,
        name: userData.name,
      });

      await AsyncStorage.setItem('@user:auth', JSON.stringify(userData));
      setUser(userData);
    } catch (error) {
      console.error('❌ Error fetching user info:', error);
    }
  };

  const signIn = async () => {
    try {
      console.log('🚀 Initiating Google Sign-In...');
      const result = await promptAsync();

      if (result?.type === 'cancel') {
        console.log('⚠️ User cancelled sign-in');
      } else if (result?.type === 'error') {
        console.error('❌ Sign-in error:', result.error);
      }
      // Success handled in useEffect above
    } catch (error) {
      console.error('❌ Sign in error:', error);
    }
  };

  const signOut = async () => {
    try {
      console.log('👋 Signing out...');
      await AsyncStorage.removeItem('@user:auth');
      setUser(null);
      console.log('✅ Signed out successfully');
    } catch (error) {
      console.error('❌ Sign out error:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
