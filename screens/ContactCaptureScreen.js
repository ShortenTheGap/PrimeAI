import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Image,
  TextInput,
  BackHandler,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import API from '../config/api';

const ContactCaptureScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();

  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState(null);
  const [recordingUri, setRecordingUri] = useState(null);
  const [hasRecording, setHasRecording] = useState(false);
  const [transcript, setTranscript] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    recordID: null,
  });

    // Update form when route params change
    useEffect(() => {
      const rawContact = route.params?.contact;
      const contactData = route.params?.contactData;
      const currentMode = route.params?.mode || 'add';

      console.log('📋 Loading contact data:', {
        mode: currentMode,
        rawContact: rawContact ? {
          name: rawContact.name,
          has_recording: rawContact.has_recording,
          recording_uri: rawContact.recording_uri,
          contact_id: rawContact.contact_id,
        } : null,
      });

      // Transform backend snake_case to camelCase if needed
      const transformedContact = rawContact ? {
        ...rawContact,
        recordingUri: rawContact.recording_uri || rawContact.recordingUri,
        hasRecording: rawContact.has_recording !== undefined ? rawContact.has_recording : rawContact.hasRecording,
        photoUrl: rawContact.photo_url || rawContact.photoUrl,
        transcript: rawContact.transcript,
      } : null;

      console.log('🔄 Transformed contact:', {
        hasRecording: transformedContact?.hasRecording,
        recordingUri: transformedContact?.recordingUri,
      });

      if (currentMode === 'edit' && transformedContact) {
        // Editing existing contact - populate with contact data
        setFormData({
          name: transformedContact.name || '',
          phone: transformedContact.phone || '',
          email: transformedContact.email || '',
          recordID: transformedContact.recordID || null,
        });
        setRecordingUri(transformedContact.recordingUri || null);
        setHasRecording(transformedContact.hasRecording || false);
        setPhotoUrl(transformedContact.photoUrl || null);
        setTranscript(transformedContact.transcript || null);

        console.log('✅ Edit mode - state set:', {
          hasRecording: transformedContact.hasRecording,
          recordingUri: transformedContact.recordingUri,
        });
      } else if (currentMode === 'add' && contactData) {
        // New contact from notification - populate with prefilled data
        setFormData({
          name: contactData.name || '',
          phone: contactData.phone || '',
          email: contactData.email || '',
          recordID: contactData.recordID || null,
        });
        setRecordingUri(null);
        setHasRecording(false);
        setPhotoUrl(null);
        setTranscript(null);
      } else if (currentMode === 'add' && !contactData) {
        // New blank contact - reset everything
        setFormData({
          name: '',
          phone: '',
          email: '',
          recordID: null,
        });
        setRecordingUri(null);
        setHasRecording(false);
        setPhotoUrl(null);
        setTranscript(null);
      }
    }, [route.params]);

  // Track if there are unsaved changes
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [savedSuccessfully, setSavedSuccessfully] = useState(false);

  // Mark as having unsaved changes when user modifies form or adds recording
  useEffect(() => {
    const mode = route.params?.mode || 'add';
    console.log('🔍 Unsaved changes check:', {
      mode,
      hasName: !!formData.name,
      hasPhone: !!formData.phone,
      hasRecording: !!recordingUri,
      currentHasUnsavedChanges: hasUnsavedChanges,
    });

    if (mode === 'add' && (formData.name || formData.phone || recordingUri)) {
      console.log('✅ Setting hasUnsavedChanges = true');
      setHasUnsavedChanges(true);
    }
  }, [formData.name, formData.phone, formData.email, recordingUri]);

  // Handle Android hardware back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      console.log('📱 Hardware back button pressed');

      // If no unsaved changes, allow default behavior
      if (!hasUnsavedChanges || savedSuccessfully || isSaving) {
        console.log('✅ No unsaved changes - allowing back');
        return false; // Let default behavior happen
      }

      // Show confirmation dialog
      console.log('⛔ Unsaved changes detected - showing alert');
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes. Are you sure you want to leave?',
        [
          {
            text: "Don't Leave",
            style: 'cancel',
            onPress: () => console.log('User chose to stay')
          },
          {
            text: 'Discard Changes',
            style: 'destructive',
            onPress: () => {
              console.log('User chose to discard changes');
              navigation.goBack();
            },
          },
        ]
      );

      return true; // Prevent default back behavior
    });

    console.log('✅ Hardware back button handler registered');

    return () => {
      console.log('🔧 Cleaning up hardware back handler');
      backHandler.remove();
    };
  }, [hasUnsavedChanges, savedSuccessfully, isSaving, navigation]);

  // Warn user before leaving with unsaved changes (for navigation buttons/gestures)
  useEffect(() => {
    console.log('🔧 Setting up beforeRemove listener, current state:', {
      hasUnsavedChanges,
      savedSuccessfully,
      isSaving,
    });

    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      console.log('🚪 beforeRemove triggered:', {
        hasUnsavedChanges,
        savedSuccessfully,
        isSaving,
        willBlock: hasUnsavedChanges && !savedSuccessfully && !isSaving,
        action: e.data.action,
      });

      // If saved successfully or no unsaved changes, allow navigation
      if (!hasUnsavedChanges || savedSuccessfully || isSaving) {
        console.log('✅ Allowing navigation');
        return;
      }

      // Prevent default navigation
      console.log('⛔ Blocking navigation - showing alert');
      e.preventDefault();

      // Show confirmation dialog
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes. Are you sure you want to leave?',
        [
          { text: "Don't Leave", style: 'cancel', onPress: () => console.log('User chose to stay') },
          {
            text: 'Discard Changes',
            style: 'destructive',
            onPress: () => {
              console.log('User chose to discard changes');
              navigation.dispatch(e.data.action);
            },
          },
        ]
      );
    });

    console.log('✅ beforeRemove listener registered');

    return () => {
      console.log('🔧 Cleaning up beforeRemove listener');
      unsubscribe();
    };
  }, [navigation, hasUnsavedChanges, savedSuccessfully, isSaving]);

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
      console.log('Recording started');
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

      console.log('📼 Recording stopped, saved to:', uri);

      // Auto-save when in edit mode (including first recording on existing contact)
      const currentMode = route.params?.mode || 'add';
      const rawContact = route.params?.contact;

      console.log('🔍 Checking auto-save conditions:', {
        mode: currentMode,
        hasContactId: !!rawContact?.contact_id,
        contactId: rawContact?.contact_id
      });

      if (currentMode === 'edit' && rawContact?.contact_id) {
        console.log('🔄 Edit mode with contact_id detected - auto-saving to server...');
        console.log('📤 Will upload recording URI:', uri);
        // Pass the new URI directly to avoid state timing issues
        await saveContact(uri);
      } else {
        console.log('ℹ️ Not auto-saving - mode:', currentMode, 'contact_id:', rawContact?.contact_id);
        Alert.alert('Success', 'Recording saved! Click "Save to Cloud" when ready.');
      }
    } catch (error) {
      console.error('❌ Failed to stop recording:', error);
      Alert.alert('Error', 'Failed to stop recording');
    }
  };

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
      await uploadToCloudinary(result.assets[0].uri);
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
      await uploadToCloudinary(result.assets[0].uri);
    }
  };

  const uploadToCloudinary = async (imageUri) => {
    try {
      const CLOUDINARY_CLOUD_NAME_KEY = '@cloudinary:cloud_name';
      const CLOUDINARY_UPLOAD_PRESET_KEY = '@cloudinary:upload_preset';

      const cloudName = await AsyncStorage.getItem(CLOUDINARY_CLOUD_NAME_KEY);
      const uploadPreset = await AsyncStorage.getItem(CLOUDINARY_UPLOAD_PRESET_KEY);

      if (!cloudName || !uploadPreset) {
        Alert.alert(
          'Cloudinary Not Configured',
          'Please configure Cloudinary settings first.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Go to Settings', onPress: () => navigation.navigate('Settings') },
          ]
        );
        return;
      }

      const formData = new FormData();
      formData.append('file', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'contact-photo.jpg',
      });
      formData.append('upload_preset', uploadPreset);
      formData.append('folder', 'context-crm');

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      const data = await response.json();

      if (data.secure_url) {
        setPhotoUrl(data.secure_url);
        console.log('Image uploaded successfully:', data.secure_url);
        Alert.alert('Success', 'Photo uploaded!');
      }
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      Alert.alert('Error', 'Failed to upload photo.');
    }
  };

    const saveContact = async (overrideRecordingUri = null) => {
      if (!formData.name && !formData.phone) {
        Alert.alert('Error', 'Please provide at least a name or phone number');
        return;
      }

      setIsSaving(true);

      try {
        const mode = route.params?.mode || 'add';
        const rawContact = route.params?.contact;

        // Transform contact_id if needed
        const contactId = rawContact?.contact_id;

        // Use override URI if provided (for auto-save after recording), otherwise use state
        const uriToUse = overrideRecordingUri || recordingUri;

        console.log('💾 Preparing to save contact:', {
          mode,
          hasOverrideUri: !!overrideRecordingUri,
          hasRecordingUri: !!recordingUri,
          uriToUse,
          uriType: typeof uriToUse,
        });

        // Prepare contact data for API
        const contactFormData = new FormData();
        contactFormData.append('name', formData.name);
        contactFormData.append('phone', formData.phone || '');
        contactFormData.append('email', formData.email || '');

        // Add voice recording if exists and is a valid string
        if (uriToUse && typeof uriToUse === 'string' && uriToUse.length > 0) {
          console.log('🎙️ Adding audio to upload:', uriToUse);
          const uriParts = uriToUse.split('.');
          const fileType = uriParts[uriParts.length - 1];

          contactFormData.append('audio', {
            uri: uriToUse,
            type: `audio/${fileType}`,
            name: `voice-note.${fileType}`,
          });
        } else if (uriToUse) {
          console.warn('⚠️ Invalid recording URI:', { uriToUse, type: typeof uriToUse });
        } else {
          console.log('ℹ️ No recording to upload');
        }

        // Add photo URL if exists
        if (photoUrl) {
          contactFormData.append('photoUrl', photoUrl);
        }

        console.log(`${mode === 'edit' ? 'Updating' : 'Creating'} contact in cloud (${API.ENV_NAME})...`);

        let response;
        if (mode === 'edit' && contactId) {
          // Update existing contact
          response = await axios.put(
            `${API.API_URL}/api/contacts/${contactId}`,
            contactFormData,
            {
              headers: {
                'Content-Type': 'multipart/form-data',
              },
              timeout: 30000, // 30 second timeout
            }
          );
        } else {
          // Create new contact
          response = await axios.post(
            `${API.API_URL}/api/contacts`,
            contactFormData,
            {
              headers: {
                'Content-Type': 'multipart/form-data',
              },
              timeout: 30000, // 30 second timeout
            }
          );
        }

        const savedContact = response.data;
        console.log('✅ Contact saved to cloud:', {
          contact_id: savedContact.contact_id,
          name: savedContact.name,
          has_recording: savedContact.has_recording,
          recording_uri: savedContact.recording_uri,
          webhook_status: savedContact.webhook_status,
        });

        // Mark as saved successfully to prevent unsaved changes warning
        setSavedSuccessfully(true);
        setHasUnsavedChanges(false);

        // Build success message with webhook status
        let successMessage = `Contact ${mode === 'edit' ? 'updated' : 'saved'} to cloud!\n\n☁️ Your data is safely backed up.`;

        if (savedContact.has_recording) {
          if (savedContact.webhook_status === 'sent') {
            successMessage += '\n\n🎙️ Voice note sent to N8N for processing!';
          } else if (savedContact.webhook_status === 'not_configured') {
            successMessage += '\n\n⚠️ Voice note saved but N8N webhook is not configured.\nConfigure N8N_WEBHOOK_URL on Railway to enable processing.';
          }
        }

        Alert.alert(
          '✅ Success!',
          successMessage,
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
        } else {
          errorMessage = error.message;
        }

        Alert.alert('❌ Error', errorMessage);
      } finally {
        setIsSaving(false);
      }
    };

    const sendUpdateWebhook = async (contact) => {
      try {
        const masterFlowUrl = await AsyncStorage.getItem('@webhook:master_flow');

        if (!masterFlowUrl) {
          console.log('No master flow URL configured, skipping update webhook');
          return null;
        }

        let audioBase64 = null;
        if (contact.recordingUri) {
          audioBase64 = await convertRecordingToBase64(contact.recordingUri);
        }

        const payload = {
          action: 'update',
          contact: {
            name: contact.name,
            phone: contact.phone,
            email: contact.email,
          },
          audio_base64: audioBase64,
          hasRecording: contact.hasRecording,
          photoUrl: contact.photoUrl,
          hasPhoto: contact.hasPhoto,
          timestamp: new Date().toISOString(),
        };

        console.log('Sending update webhook');

        const response = await fetch(masterFlowUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          const responseData = await response.json();
          console.log('N8N Response:', responseData);
          
          // Check if transcript exists in response
          if (responseData.transcript) {
            return responseData.transcript;
          }
        }
        
        return null;
      } catch (error) {
        console.error('Update webhook error:', error);
        return null;
      }
    };

  const sendMasterWebhook = async (action) => {
    try {
      const masterFlowUrl = await AsyncStorage.getItem('@webhook:master_flow');

      if (!masterFlowUrl) {
        Alert.alert('Webhook Not Configured', 'Please configure the N8N Master Flow URL in Settings first.');
        return;
      }

      let audioBase64 = null;
      if (recordingUri) {
        audioBase64 = await convertRecordingToBase64(recordingUri);
      }

      const payload = {
        action: action,
        contact: {
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
        },
        audio_base64: audioBase64,
        hasRecording: hasRecording,
        photoUrl: photoUrl,
        hasPhoto: !!photoUrl,
        timestamp: new Date().toISOString(),
      };

      console.log('Sending webhook with action:', action);

      const response = await fetch(masterFlowUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        Alert.alert(
          '✅ Success!',
          `Message sent successfully!\n\nAction: ${action}\nContact: ${formData.name || 'N/A'}`
        );
      } else {
        Alert.alert('❌ Error', `Webhook failed with status: ${response.status}`);
      }
    } catch (error) {
      console.error('Webhook error:', error);
      Alert.alert('❌ Error', `Failed to send webhook: ${error.message}`);
    }
  };

  const convertRecordingToBase64 = async (uri) => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error converting recording to base64:', error);
      return null;
    }
  };

  const mode = route.params?.mode || 'add';
  const prefilledContact = route.params?.contactData;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {mode === 'edit' ? 'Edit Contact' : 'Add Contact Context'}
        </Text>
        {prefilledContact && (
          <View style={styles.autoPopulatedBanner}>
            <Text style={styles.bannerText}>
              ✨ Auto-populated from phone contact
            </Text>
          </View>
        )}
        <View style={styles.cloudBanner}>
          <Text style={styles.cloudBannerText}>
            ☁️ Saving to: {API.ENV_NAME}
          </Text>
        </View>
      </View>

      {/* Contact Details - TOP */}
      <View style={styles.detailsSection}>
        <Text style={styles.sectionTitle}>Contact Details</Text>

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
      </View>

      {/* Voice Recording Section - BELOW CONTACT DETAILS */}
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
            {isRecording ? '⏹ Stop Recording' : hasRecording ? '🎙️ Re-record' : '🎙️ Press to Record'}
          </Text>
        </TouchableOpacity>

        {hasRecording && (
          <View style={styles.recordingStatus}>
            <Text style={styles.recordingStatusText}>✅ Recording saved</Text>
          </View>
        )}

        {transcript && (
          <View style={styles.transcriptSection}>
            <Text style={styles.transcriptLabel}>📝 Transcript:</Text>
            <Text style={styles.transcriptText}>{transcript}</Text>
          </View>
        )}
      </View>

      {/* Photo Capture Section */}
      <View style={styles.photoSection}>
        <Text style={styles.sectionTitle}>📷 Photo Capture</Text>

        {photoUrl && (
          <Image source={{ uri: photoUrl }} style={styles.photoPreview} />
        )}

        <View style={styles.photoButtons}>
          <TouchableOpacity style={styles.photoButton} onPress={takePhoto}>
            <Text style={styles.photoButtonText}>📷 Take Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.photoButton, styles.photoButtonSecondary]} onPress={pickFromGallery}>
            <Text style={styles.photoButtonText}>🖼️ Gallery</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsSection}>
        <Text style={styles.sectionTitle}>Actions</Text>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => sendMasterWebhook('welcome')}
        >
          <Text style={styles.actionButtonText}>📧 Send Welcome Message</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonSecondary]}
          onPress={() => sendMasterWebhook('link')}
        >
          <Text style={styles.actionButtonText}>🔗 Send Invitation Link</Text>
        </TouchableOpacity>
      </View>

      {/* Save Button */}
      <TouchableOpacity
        style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
        onPress={saveContact}
        disabled={isSaving}
      >
        <Text style={styles.saveButtonText}>
          {isSaving
            ? '☁️ Saving to Cloud...'
            : `💾 ${mode === 'edit' ? 'Update Contact' : 'Save to Cloud'}`
          }
        </Text>
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
  cloudBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  cloudBannerText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '600',
  },
  detailsSection: {
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
  input: {
    fontSize: 16,
    color: '#f1f5f9',
    padding: 12,
    backgroundColor: '#334155',
    borderRadius: 8,
  },
  recordingSection: {
    padding: 20,
    backgroundColor: '#1e293b',
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
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
  recordingStatus: {
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  recordingStatusText: {
    color: '#10b981',
    fontSize: 14,
    textAlign: 'center',
  },
  transcriptSection: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#6366f1',
  },
  transcriptLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6366f1',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  transcriptText: {
    fontSize: 14,
    color: '#cbd5e1',
    lineHeight: 20,
  },
  photoSection: {
    padding: 20,
    backgroundColor: '#1e293b',
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
  },
  photoPreview: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginVertical: 12,
    alignSelf: 'center',
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  photoButton: {
    flex: 1,
    backgroundColor: '#6366f1',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  photoButtonSecondary: {
    backgroundColor: '#8b5cf6',
  },
  photoButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  actionsSection: {
    padding: 20,
    backgroundColor: '#1e293b',
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
  },
  actionButton: {
    backgroundColor: '#6366f1',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  actionButtonSecondary: {
    backgroundColor: '#8b5cf6',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#10b981',
    padding: 18,
    margin: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#64748b',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ContactCaptureScreen;
