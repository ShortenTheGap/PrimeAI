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

  // Get Google Client ID from app.json
  const googleClientId = Constants.expoConfig?.extra?.googleClientId;

  // Get slug from app.json
  const slug = Constants.expoConfig?.slug || 'context-crm';

  // Explicitly construct Expo auth proxy URL
  // This will be: https://auth.expo.io/@owner/context-crm
  const redirectUri = AuthSession.makeRedirectUri({
    useProxy: true,
    scheme: undefined, // Don't use custom scheme, force proxy
  });

  console.log('🔗 OAuth Config:', {
    slug,
    redirectUri,
    isExpoGo: Constants.appOwnership === 'expo',
  });

  // Configure Google Sign-In
  // Using Web client ID with Expo auth proxy for Expo Go compatibility
  const [request, response, promptAsync] = Google.useAuthRequest({
    expoClientId: googleClientId,
    iosClientId: googleClientId,
    webClientId: googleClientId,
    redirectUri: redirectUri,
  });

  // Check for existing session on mount
  useEffect(() => {
    checkStoredAuth();
  }, []);

  // Handle OAuth response
  useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      fetchUserInfo(authentication.accessToken);
    }
  }, [response]);

  const checkStoredAuth = async () => {
    try {
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
