import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  PermissionsAndroid,
  Platform,
  Alert,
  ScrollView,
  Switch,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import ContactMonitorService from '../services/ContactMonitorService';
import BackgroundTaskService from '../services/BackgroundTaskService';

const ContactCaptureScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();

  // Pre-populated contact data from notification
  const prefilledContact = route.params?.contactData || null;

  const [isRecording, setIsRecording] = useState(false);
  const [formData, setFormData] = useState({
    name: prefilledContact?.name || '',
    phone: prefilledContact?.phone || '',
    email: prefilledContact?.email || '',
    recordID: prefilledContact?.recordID || null,
  });

  useEffect(() => {
    // If we came from a notification, show immediate prompt
    if (prefilledContact) {
      Alert.alert(
        '🎙️ Capture Context',
        `Ready to capture context for ${prefilledContact.name}?\n\nPress RECORD to start speaking about where you met and what you discussed.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Record Now', onPress: () => startRecording() },
        ]
      );
    }
  }, [prefilledContact]);

  const startRecording = () => {
    // Voice recording logic here
    setIsRecording(true);
    console.log('Started recording for:', formData.name);
  };

  const stopRecording = () => {
    setIsRecording(false);
    console.log('Stopped recording');
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Add Contact Context</Text>
        {prefilledContact && (
          <View style={styles.autoPopulatedBanner}>
            <Text style={styles.bannerText}>
              ✨ Auto-populated from phone contact
            </Text>
          </View>
        )}
      </View>

      {/* Voice Recording Section */}
      <View style={styles.recordingSection}>
        <Text style={styles.sectionTitle}>🎙️ Voice Context Capture</Text>
        <Text style={styles.subtitle}>
          Record your thoughts while they're fresh:{'\n'}
          Where did you meet? What did you discuss?
        </Text>

        <TouchableOpacity
          style={[styles.recordButton, isRecording && styles.recordingActive]}
          onPress={isRecording ? stopRecording : startRecording}
        >
          <Text style={styles.recordButtonText}>
            {isRecording ? '⏹ Stop Recording' : '🎙️ Press to Record'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Contact Details (Pre-populated) */}
      <View style={styles.detailsSection}>
        <Text style={styles.sectionTitle}>Contact Details</Text>

        <View style={styles.formField}>
          <Text style={styles.label}>Name</Text>
          <Text style={styles.value}>{formData.name || 'Not available'}</Text>
        </View>

        <View style={styles.formField}>
          <Text style={styles.label}>Phone</Text>
          <Text style={styles.value}>{formData.phone || 'Not available'}</Text>
        </View>

        <View style={styles.formField}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{formData.email || 'Not available'}</Text>
        </View>
      </View>

      {/* Save Button */}
      <TouchableOpacity style={styles.saveButton}>
        <Text style={styles.saveButtonText}>💾 Save Contact</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f1f5f9',
    marginBottom: 8,
  },
  autoPopulatedBanner: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  bannerText: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '600',
  },
  recordingSection: {
    padding: 20,
    backgroundColor: '#1e293b',
    margin: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f1f5f9',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 20,
    lineHeight: 20,
  },
  recordButton: {
    backgroundColor: '#ef4444',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  recordingActive: {
    backgroundColor: '#dc2626',
  },
  recordButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  detailsSection: {
    padding: 20,
    backgroundColor: '#1e293b',
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
  },
  formField: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: 16,
    color: '#f1f5f9',
    padding: 12,
    backgroundColor: '#334155',
    borderRadius: 8,
  },
  saveButton: {
    backgroundColor: '#10b981',
    padding: 18,
    margin: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ContactCaptureScreen;
