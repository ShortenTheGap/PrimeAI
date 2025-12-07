import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';

const PRIVACY_CONSENT_KEY = '@privacy:consent_given';
const PRIVACY_CONSENT_DATE_KEY = '@privacy:consent_date';

const PrivacyConsentScreen = ({ onConsentGiven }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleAccept = async () => {
    setIsLoading(true);
    try {
      await AsyncStorage.setItem(PRIVACY_CONSENT_KEY, 'true');
      await AsyncStorage.setItem(PRIVACY_CONSENT_DATE_KEY, new Date().toISOString());
      console.log('Privacy consent recorded');
      onConsentGiven();
    } catch (error) {
      console.error('Error saving privacy consent:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDecline = () => {
    // Show info about what happens if they decline
    // For now, they simply can't proceed
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Feather name="shield" size={48} color="#10b981" />
          </View>
          <Text style={styles.title}>Your Privacy Matters</Text>
          <Text style={styles.subtitle}>
            Before you start, please review how we handle your data
          </Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="database" size={20} color="#3b82f6" />
            <Text style={styles.sectionTitle}>What We Collect</Text>
          </View>
          <Text style={styles.sectionText}>
            When you add contacts in this app, we collect and store:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• Contact name, phone, and email</Text>
            <Text style={styles.bulletItem}>• Voice notes you record (optional)</Text>
            <Text style={styles.bulletItem}>• Photos you take (optional)</Text>
            <Text style={styles.bulletItem}>• Notes and context you add</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="cloud" size={20} color="#8b5cf6" />
            <Text style={styles.sectionTitle}>Where It's Stored</Text>
          </View>
          <Text style={styles.sectionText}>
            Your contact data is securely uploaded to and stored on our cloud servers. This enables:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• Syncing across your devices</Text>
            <Text style={styles.bulletItem}>• Voice note transcription</Text>
            <Text style={styles.bulletItem}>• Backup and recovery</Text>
            <Text style={styles.bulletItem}>• Follow-up reminders</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="lock" size={20} color="#10b981" />
            <Text style={styles.sectionTitle}>How We Protect It</Text>
          </View>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• Data is encrypted in transit and at rest</Text>
            <Text style={styles.bulletItem}>• Only you can access your contacts</Text>
            <Text style={styles.bulletItem}>• We never share your data with third parties</Text>
            <Text style={styles.bulletItem}>• You can delete your account and all data anytime</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="trash-2" size={20} color="#ef4444" />
            <Text style={styles.sectionTitle}>Your Rights</Text>
          </View>
          <Text style={styles.sectionText}>
            You can delete your account and all associated data at any time from Settings.
            Upon deletion, all your contacts, voice notes, and photos are permanently removed from our servers.
          </Text>
        </View>

        <View style={styles.consentBox}>
          <Text style={styles.consentText}>
            By tapping "I Agree", you consent to the collection and storage of your contact
            information on our servers as described above.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.acceptButton, isLoading && styles.buttonDisabled]}
          onPress={handleAccept}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="check" size={20} color="#fff" />
              <Text style={styles.acceptButtonText}>I Agree</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

export const checkPrivacyConsent = async () => {
  try {
    const consent = await AsyncStorage.getItem(PRIVACY_CONSENT_KEY);
    return consent === 'true';
  } catch (error) {
    console.error('Error checking privacy consent:', error);
    return false;
  }
};

export const PRIVACY_CONSENT_STORAGE_KEY = PRIVACY_CONSENT_KEY;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 120,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    paddingTop: 40,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#10b981',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f1f5f9',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 24,
  },
  section: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f1f5f9',
  },
  sectionText: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 22,
    marginBottom: 12,
  },
  bulletList: {
    gap: 8,
  },
  bulletItem: {
    fontSize: 14,
    color: '#cbd5e1',
    lineHeight: 22,
    paddingLeft: 8,
  },
  consentBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#10b981',
    marginTop: 8,
  },
  consentText: {
    fontSize: 14,
    color: '#10b981',
    lineHeight: 22,
    textAlign: 'center',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    paddingBottom: 40,
    backgroundColor: '#0f172a',
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  acceptButton: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 16,
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default PrivacyConsentScreen;
