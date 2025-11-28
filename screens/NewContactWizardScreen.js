import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  Image,
  ActivityIndicator,
  Animated,
  Linking,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Calendar from 'expo-calendar';
import apiClient from '../services/ApiService';
import API from '../config/api';

// Cache keys
const CACHE_KEY = '@contacts:list';
const CACHE_TIMESTAMP_KEY = '@contacts:timestamp';

// Wizard steps
const STEPS = {
  CONTACT_INFO: 1,
  PHOTO_PROMPT: 2,
  PHOTO_CONFIRM: 3,
  MESSAGE_PROMPT: 4,
  CALENDAR_PROMPT: 5,
  VOICE_PROMPT: 6,
  SAVING: 7,
};

const NewContactWizardScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();

  // Pre-populated contact data from notification
  const prefilledContact = route.params?.contactData || null;

  const [currentStep, setCurrentStep] = useState(STEPS.CONTACT_INFO);
  const [fadeAnim] = useState(new Animated.Value(1));

  // Form data
  const [formData, setFormData] = useState({
    name: prefilledContact?.name || '',
    phone: prefilledContact?.phone || '',
    email: prefilledContact?.email || '',
    recordID: prefilledContact?.recordID || null,
  });

  // Photo state
  const [photoUrl, setPhotoUrl] = useState(null);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState(null);
  const [recordingUri, setRecordingUri] = useState(null);
  const [hasRecording, setHasRecording] = useState(false);

  // Saving state
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  // Animate step transitions
  const animateTransition = (nextStep) => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();

    setTimeout(() => setCurrentStep(nextStep), 150);
  };

  // Photo functions
  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera permission is required.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      const localUri = result.assets[0].uri;
      setPhotoUrl(localUri);
      animateTransition(STEPS.PHOTO_CONFIRM);
    }
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Photo library permission is required.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      const localUri = result.assets[0].uri;
      setPhotoUrl(localUri);
      animateTransition(STEPS.PHOTO_CONFIRM);
    }
  };

  // Recording functions
  const startRecording = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('Permission Required', 'Microphone permission is required to record audio.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(recording);
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecordingUri(uri);
      setHasRecording(true);
      setRecording(null);

      // Move to saving step
      saveContact();
    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Error', 'Failed to stop recording');
    }
  };

  // Message functions
  const sendMessage = async (action) => {
    try {
      if (!formData.phone) {
        Alert.alert('No Phone Number', 'Skipping message - no phone number available.');
        animateTransition(STEPS.CALENDAR_PROMPT);
        return;
      }

      setIsSendingMessage(true);

      const deliveryMethod = await AsyncStorage.getItem('@sms:delivery_method') || 'native';

      if (deliveryMethod === 'n8n') {
        await sendMasterWebhook(action);
      } else {
        await sendNativeMessage(action);
      }

      // Move to next step after sending
      animateTransition(STEPS.CALENDAR_PROMPT);
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', error.message);
    } finally {
      setIsSendingMessage(false);
    }
  };

  const sendNativeMessage = async (action) => {
    const templateKey = action === 'welcome' ? '@sms:welcome_message' : '@sms:link_message';
    let messageTemplate = await AsyncStorage.getItem(templateKey);

    if (!messageTemplate) {
      if (action === 'welcome') {
        messageTemplate = "Hi {name}! It was so great to meet you. Looking forward to staying in touch!";
      } else {
        messageTemplate = "Hi {name}! Here's the link we discussed.";
      }
    }

    let messageBody = messageTemplate.replace(/{name}/g, formData.name || 'there');

    if (photoUrl && (photoUrl.startsWith('http://') || photoUrl.startsWith('https://'))) {
      messageBody = messageBody.replace(/{photo}/g, photoUrl);
    } else {
      messageBody = messageBody.replace(/{photo}/g, '');
    }

    const cleanPhone = formData.phone.replace(/[^\d+]/g, '');
    const smsUrl = `sms:${cleanPhone}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(messageBody)}`;

    const supported = await Linking.canOpenURL(smsUrl);
    if (supported) {
      await Linking.openURL(smsUrl);
      Alert.alert('Message Ready', 'Your message app has been opened with the pre-filled message.');
    } else {
      Alert.alert('Error', 'SMS is not supported on this device');
    }
  };

  const sendMasterWebhook = async (action) => {
    const masterFlowUrl = await AsyncStorage.getItem('@webhook:master_flow');

    if (!masterFlowUrl) {
      Alert.alert('Webhook Not Configured', 'Please configure the N8N Master Flow URL in Settings first.');
      return;
    }

    const payload = {
      action: action,
      contact: {
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
      },
      photoUrl: photoUrl,
      hasPhoto: !!photoUrl,
      timestamp: new Date().toISOString(),
    };

    const response = await fetch(masterFlowUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      Alert.alert('Message Sent', 'Your message has been sent successfully!');
    } else {
      throw new Error(`Webhook failed with status: ${response.status}`);
    }
  };

  // Calendar functions
  const createCalendarEvent = async () => {
    try {
      const deliveryMethod = await AsyncStorage.getItem('@calendar:delivery_method') || 'native';

      if (deliveryMethod === 'n8n') {
        await sendCalendarWebhook();
      } else {
        await createNativeCalendarEvent();
      }

      animateTransition(STEPS.VOICE_PROMPT);
    } catch (error) {
      console.error('Error creating calendar event:', error);
      Alert.alert('Error', error.message);
    }
  };

  const createNativeCalendarEvent = async () => {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Calendar permission is required to create events.');
      return;
    }

    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const defaultCalendar = calendars.find(cal => cal.isPrimary) || calendars[0];

    if (!defaultCalendar) {
      Alert.alert('Error', 'No calendar found on this device.');
      return;
    }

    const eventTitle = `Follow up: ${formData.name || 'New Contact'}`;
    const eventNotes = `Contact: ${formData.name || 'N/A'}\nPhone: ${formData.phone || 'N/A'}\nEmail: ${formData.email || 'N/A'}`;

    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + 30 * 60 * 1000);

    await Calendar.createEventAsync(defaultCalendar.id, {
      title: eventTitle,
      startDate,
      endDate,
      notes: eventNotes,
      timeZone: 'America/New_York',
    });

    Alert.alert('Success', 'Calendar reminder created!');
  };

  const sendCalendarWebhook = async () => {
    const masterFlowUrl = await AsyncStorage.getItem('@webhook:master_flow');

    if (!masterFlowUrl) {
      Alert.alert('Webhook Not Configured', 'Please configure the N8N Master Flow URL in Settings first.');
      return;
    }

    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + 30 * 60 * 1000);

    const payload = {
      action: 'follow',
      contact: {
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
      },
      event: {
        title: `Follow up: ${formData.name || 'New Contact'}`,
        description: `Follow up with ${formData.name || 'new contact'}`,
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
      },
      timestamp: new Date().toISOString(),
    };

    const response = await fetch(masterFlowUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      Alert.alert('Success', 'Calendar reminder created via webhook!');
    } else {
      throw new Error(`Webhook failed with status: ${response.status}`);
    }
  };

  // Convert recording to base64 for webhook
  const convertRecordingToBase64 = async (uri) => {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });
      return `data:audio/m4a;base64,${base64}`;
    } catch (error) {
      console.error('Error converting recording to base64:', error);
      return null;
    }
  };

  // Send update webhook after saving contact
  const sendUpdateWebhook = async (savedContact, audioUri) => {
    try {
      const masterFlowUrl = await AsyncStorage.getItem('@webhook:master_flow');
      if (!masterFlowUrl) {
        console.log('No master flow URL configured, skipping update webhook');
        return;
      }

      let audioBase64 = null;
      if (audioUri && audioUri.startsWith('file://')) {
        audioBase64 = await convertRecordingToBase64(audioUri);
      }

      // Get server photo URL if available
      let serverPhotoUrl = savedContact.photo_url || photoUrl;
      if (serverPhotoUrl && serverPhotoUrl.startsWith('/uploads/')) {
        serverPhotoUrl = `${API.API_URL}${serverPhotoUrl}`;
      }

      const payload = {
        action: 'update',
        contact: {
          id: savedContact.contact_id,
          name: savedContact.name,
          phone: savedContact.phone,
          email: savedContact.email,
        },
        audio_base64: audioBase64,
        hasRecording: !!audioUri,
        photoUrl: serverPhotoUrl,
        hasPhoto: !!serverPhotoUrl,
        transcript: savedContact.transcript || null,
        timestamp: new Date().toISOString(),
      };

      console.log('📤 Sending update webhook with action:', payload.action);

      const response = await fetch(masterFlowUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        console.log('✅ Update webhook sent successfully');
      } else {
        console.error('❌ Update webhook failed:', response.status);
      }
    } catch (error) {
      console.error('Update webhook error:', error);
    }
  };

  // Save contact
  const saveContact = async () => {
    if (!formData.name && !formData.phone) {
      Alert.alert('Error', 'Please provide at least a name or phone number');
      return;
    }

    setCurrentStep(STEPS.SAVING);
    setIsSaving(true);

    try {
      const contactFormData = new FormData();
      contactFormData.append('name', formData.name || '');
      contactFormData.append('phone', formData.phone || '');
      contactFormData.append('email', formData.email || '');

      // Add photo if exists
      if (photoUrl && photoUrl.startsWith('file://')) {
        contactFormData.append('photo', {
          uri: photoUrl,
          type: 'image/jpeg',
          name: 'contact-photo.jpg',
        });
      }

      // Add recording if exists
      if (recordingUri && recordingUri.startsWith('file://')) {
        const uriParts = recordingUri.split('.');
        const fileType = uriParts[uriParts.length - 1];
        contactFormData.append('audio', {
          uri: recordingUri,
          type: `audio/${fileType}`,
          name: `voice-note.${fileType}`,
        });
      }

      const response = await apiClient.post(
        `${API.API_URL}/api/contacts`,
        contactFormData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 30000,
        }
      );

      const savedContact = response.data;

      // Send update webhook with audio data
      await sendUpdateWebhook(savedContact, recordingUri);

      // Update cache
      try {
        const cachedContactsJson = await AsyncStorage.getItem(CACHE_KEY);
        if (cachedContactsJson) {
          const cachedContacts = JSON.parse(cachedContactsJson);
          cachedContacts.unshift(savedContact);
          await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cachedContacts));
          await AsyncStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
        }
      } catch (cacheError) {
        console.error('Cache update error:', cacheError);
      }

      Alert.alert(
        'Contact Saved!',
        `${formData.name || 'Contact'} has been added successfully.`,
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('ContactList'),
          },
        ]
      );
    } catch (error) {
      console.error('Error saving contact:', error);
      let errorMessage = 'Failed to save contact';
      if (error.response) {
        errorMessage = error.response.data?.error || `Server error: ${error.response.status}`;
      } else if (error.request) {
        errorMessage = 'Cannot reach server. Please check your internet connection.';
      }
      Alert.alert('Error', errorMessage);
      setCurrentStep(STEPS.VOICE_PROMPT);
    } finally {
      setIsSaving(false);
    }
  };

  // Skip to save (from voice step)
  const skipAndSave = () => {
    saveContact();
  };

  // Render step indicator
  const renderStepIndicator = () => {
    const totalSteps = 6;
    const actualStep = Math.min(currentStep, totalSteps);

    return (
      <View style={styles.stepIndicator}>
        {[1, 2, 3, 4, 5, 6].map((step) => (
          <View
            key={step}
            style={[
              styles.stepDot,
              actualStep >= step && styles.stepDotActive,
              actualStep === step && styles.stepDotCurrent,
            ]}
          />
        ))}
      </View>
    );
  };

  // Render current step
  const renderStep = () => {
    switch (currentStep) {
      case STEPS.CONTACT_INFO:
        return (
          <View style={styles.stepCard}>
            <View style={styles.stepHeader}>
              <Feather name="user" size={32} color="#10b981" />
              <Text style={styles.stepTitle}>Contact Information</Text>
              <Text style={styles.stepSubtitle}>
                {prefilledContact ? 'Review and confirm the contact details' : 'Enter the contact details'}
              </Text>
            </View>

            <View style={styles.formField}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder="Enter name"
                placeholderTextColor="#64748b"
              />
            </View>

            <View style={styles.formField}>
              <Text style={styles.label}>Phone</Text>
              <TextInput
                style={styles.input}
                value={formData.phone}
                onChangeText={(text) => setFormData({ ...formData, phone: text })}
                placeholder="Enter phone"
                placeholderTextColor="#64748b"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.formField}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={formData.email}
                onChangeText={(text) => setFormData({ ...formData, email: text })}
                placeholder="Enter email"
                placeholderTextColor="#64748b"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => animateTransition(STEPS.PHOTO_PROMPT)}
            >
              <Feather name="check" size={20} color="#fff" />
              <Text style={styles.primaryButtonText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        );

      case STEPS.PHOTO_PROMPT:
        return (
          <View style={styles.stepCard}>
            <View style={styles.stepHeader}>
              <Feather name="camera" size={32} color="#E67E22" />
              <Text style={styles.stepTitle}>Take a Picture?</Text>
              <Text style={styles.stepSubtitle}>
                Capture a photo to remember this moment
              </Text>
            </View>

            <View style={styles.buttonGroup}>
              <TouchableOpacity style={styles.optionButton} onPress={takePhoto}>
                <Feather name="camera" size={24} color="#fff" />
                <Text style={styles.optionButtonText}>Take Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.optionButton, styles.optionButtonSecondary]} onPress={pickFromGallery}>
                <Feather name="image" size={24} color="#fff" />
                <Text style={styles.optionButtonText}>Gallery</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.skipButton}
                onPress={() => animateTransition(STEPS.MESSAGE_PROMPT)}
              >
                <Text style={styles.skipButtonText}>Skip</Text>
                <Feather name="chevron-right" size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>
          </View>
        );

      case STEPS.PHOTO_CONFIRM:
        return (
          <View style={styles.stepCard}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>Looking Good!</Text>
              <Text style={styles.stepSubtitle}>
                Happy with this photo?
              </Text>
            </View>

            {photoUrl && (
              <Image source={{ uri: photoUrl }} style={styles.photoPreview} />
            )}

            <View style={styles.buttonGroup}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => animateTransition(STEPS.MESSAGE_PROMPT)}
              >
                <Feather name="check" size={20} color="#fff" />
                <Text style={styles.primaryButtonText}>Confirm</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.optionButton, styles.optionButtonSecondary]} onPress={takePhoto}>
                <Feather name="refresh-cw" size={20} color="#fff" />
                <Text style={styles.optionButtonText}>Take Another</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.skipButton}
                onPress={() => {
                  setPhotoUrl(null);
                  animateTransition(STEPS.MESSAGE_PROMPT);
                }}
              >
                <Text style={styles.skipButtonText}>Skip Photo</Text>
                <Feather name="chevron-right" size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>
          </View>
        );

      case STEPS.MESSAGE_PROMPT:
        return (
          <View style={styles.stepCard}>
            <View style={styles.stepHeader}>
              <Feather name="message-square" size={32} color="#9B59B6" />
              <Text style={styles.stepTitle}>Send a Message?</Text>
              <Text style={styles.stepSubtitle}>
                Reach out while you're still connected
              </Text>
            </View>

            {isSendingMessage ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#9B59B6" />
                <Text style={styles.loadingText}>Opening message...</Text>
              </View>
            ) : (
              <View style={styles.buttonGroup}>
                <TouchableOpacity
                  style={styles.optionButton}
                  onPress={() => sendMessage('welcome')}
                >
                  <Feather name="send" size={24} color="#fff" />
                  <Text style={styles.optionButtonText}>Send Welcome Message</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.optionButton, styles.optionButtonSecondary]}
                  onPress={() => sendMessage('link')}
                >
                  <Feather name="link" size={24} color="#fff" />
                  <Text style={styles.optionButtonText}>Send Invitation Link</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.skipButton}
                  onPress={() => animateTransition(STEPS.CALENDAR_PROMPT)}
                >
                  <Text style={styles.skipButtonText}>Skip</Text>
                  <Feather name="chevron-right" size={20} color="#94a3b8" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        );

      case STEPS.CALENDAR_PROMPT:
        return (
          <View style={styles.stepCard}>
            <View style={styles.stepHeader}>
              <Feather name="calendar" size={32} color="#E67E22" />
              <Text style={styles.stepTitle}>Set a Reminder?</Text>
              <Text style={styles.stepSubtitle}>
                Schedule a follow-up so you don't forget
              </Text>
            </View>

            <View style={styles.buttonGroup}>
              <TouchableOpacity style={styles.optionButton} onPress={createCalendarEvent}>
                <Feather name="bell" size={24} color="#fff" />
                <Text style={styles.optionButtonText}>Create Follow-up Reminder</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.skipButton}
                onPress={() => animateTransition(STEPS.VOICE_PROMPT)}
              >
                <Text style={styles.skipButtonText}>Skip</Text>
                <Feather name="chevron-right" size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>
          </View>
        );

      case STEPS.VOICE_PROMPT:
        return (
          <View style={styles.stepCard}>
            <View style={styles.stepHeader}>
              <Feather name="mic" size={32} color="#ef4444" />
              <Text style={styles.stepTitle}>Record a Voice Note?</Text>
              <Text style={styles.stepSubtitle}>
                Capture your thoughts while they're fresh
              </Text>
            </View>

            <View style={styles.buttonGroup}>
              {isRecording ? (
                <TouchableOpacity
                  style={[styles.recordButton, styles.recordingActive]}
                  onPress={stopRecording}
                >
                  <Feather name="square" size={32} color="#fff" />
                  <Text style={styles.recordButtonText}>Stop Recording</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity style={styles.recordButton} onPress={startRecording}>
                    <Feather name="mic" size={32} color="#fff" />
                    <Text style={styles.recordButtonText}>Press to Record</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.skipButton} onPress={skipAndSave}>
                    <Text style={styles.skipButtonText}>Skip & Save Contact</Text>
                    <Feather name="chevron-right" size={20} color="#94a3b8" />
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        );

      case STEPS.SAVING:
        return (
          <View style={styles.stepCard}>
            <View style={styles.stepHeader}>
              <ActivityIndicator size="large" color="#10b981" />
              <Text style={styles.stepTitle}>Saving Contact...</Text>
              <Text style={styles.stepSubtitle}>
                Please wait while we save your contact
              </Text>
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => {
              Alert.alert(
                'Cancel',
                'Are you sure you want to cancel? Your progress will be lost.',
                [
                  { text: 'Keep Going', style: 'cancel' },
                  {
                    text: 'Cancel',
                    style: 'destructive',
                    onPress: () => navigation.goBack(),
                  },
                ]
              );
            }}
          >
            <Feather name="x" size={24} color="#94a3b8" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Contact</Text>
          <View style={{ width: 40 }} />
        </View>

        {renderStepIndicator()}

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={{ opacity: fadeAnim }}>
            {renderStep()}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f1f5f9',
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#334155',
  },
  stepDotActive: {
    backgroundColor: '#10b981',
  },
  stepDotCurrent: {
    width: 24,
    borderRadius: 12,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  stepCard: {
    backgroundColor: '#1e293b',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  stepHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f1f5f9',
    marginTop: 16,
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  formField: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  input: {
    fontSize: 16,
    color: '#f1f5f9',
    padding: 16,
    backgroundColor: '#334155',
    borderRadius: 12,
  },
  buttonGroup: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 16,
    gap: 8,
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  optionButton: {
    backgroundColor: '#9B59B6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 16,
    gap: 12,
  },
  optionButtonSecondary: {
    backgroundColor: '#8E44AD',
  },
  optionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 4,
  },
  skipButtonText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '500',
  },
  photoPreview: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignSelf: 'center',
    marginBottom: 24,
    borderWidth: 4,
    borderColor: '#10b981',
  },
  recordButton: {
    backgroundColor: '#ef4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    borderRadius: 16,
    gap: 12,
  },
  recordingActive: {
    backgroundColor: '#dc2626',
  },
  recordButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 16,
    marginTop: 12,
  },
});

export default NewContactWizardScreen;
