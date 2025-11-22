import React, { useContext } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Constants from 'expo-constants';
import AuthContext from '../contexts/AuthContext';

const SignInScreen = () => {
  const { signIn, isLoading } = useContext(AuthContext);

  console.log('📱 SignInScreen rendered', {
    isLoading,
    appOwnership: Constants.appOwnership,
  });

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Debug Info - Shows environment */}
        {__DEV__ && (
          <View style={styles.debugBanner}>
            <Text style={styles.debugText}>
              {Constants.appOwnership === 'expo' ? '🔧 Expo Go' : '📱 TestFlight/Production'}
            </Text>
          </View>
        )}

        {/* App Icon */}
        <Image
          source={require('../assets/icon.png')}
          style={styles.logo}
        />

        {/* Title */}
        <Text style={styles.title}>Welcome to PrimeAI</Text>
        <Text style={styles.subtitle}>
          Context-Aware Contact Management
        </Text>

        {/* Features */}
        <View style={styles.featuresContainer}>
          <View style={styles.feature}>
            <Text style={styles.featureIcon}>🎙️</Text>
            <Text style={styles.featureText}>Voice Notes</Text>
          </View>
          <View style={styles.feature}>
            <Text style={styles.featureIcon}>📸</Text>
            <Text style={styles.featureText}>Photo Capture</Text>
          </View>
          <View style={styles.feature}>
            <Text style={styles.featureIcon}>☁️</Text>
            <Text style={styles.featureText}>Cloud Sync</Text>
          </View>
        </View>

        {/* Google Sign-In Button */}
        <TouchableOpacity style={styles.googleButton} onPress={signIn}>
          <View style={styles.googleIconContainer}>
            <Text style={styles.googleIcon}>G</Text>
          </View>
          <Text style={styles.googleText}>Sign in with Google</Text>
        </TouchableOpacity>

        {/* Privacy Notice */}
        <Text style={styles.privacy}>
          By signing in, you agree to our Terms of Service{'\n'}
          and Privacy Policy
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: '100%',
    maxWidth: 400,
    padding: 20,
    alignItems: 'center',
  },
  debugBanner: {
    backgroundColor: '#1e293b',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  debugText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#f1f5f9',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 40,
    textAlign: 'center',
  },
  featuresContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 50,
  },
  feature: {
    alignItems: 'center',
  },
  featureIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  featureText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 12,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  googleIconContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  googleIcon: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4285F4',
  },
  googleText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  privacy: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
  },
});

export default SignInScreen;
