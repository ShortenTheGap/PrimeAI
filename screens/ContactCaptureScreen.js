import React, { useState, useEffect, useRef } from 'react';
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
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Calendar from 'expo-calendar';
import apiClient from '../services/ApiService';
import API from '../config/api';

// Cache keys (must match ContactListScreen)
const CACHE_KEY = '@contacts:list';
const CACHE_TIMESTAMP_KEY = '@contacts:timestamp';

const ContactCaptureScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const scrollViewRef = useRef(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState(null);
  const [recordingUri, setRecordingUri] = useState(null);
  const [hasRecording, setHasRecording] = useState(false);
  const [transcript, setTranscript] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);

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
          phone: rawContact.phone,
          email: rawContact.email,
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

        // Convert relative photo URLs to absolute URLs for React Native Image component
        let displayPhotoUrl = transformedContact.photoUrl || null;
        if (displayPhotoUrl && displayPhotoUrl.startsWith('/uploads/')) {
          displayPhotoUrl = `${API.API_URL}${displayPhotoUrl}`;
          console.log('📸 Converted relative photo URL to absolute:', displayPhotoUrl);
        }
        setPhotoUrl(displayPhotoUrl);

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

  // Scroll to top when adding a new contact
  useEffect(() => {
    const currentMode = route.params?.mode || 'add';
    if (currentMode === 'add' && scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: 0, animated: true });
    }
  }, [route.params?.mode]);

  // Track if there are unsaved changes
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [savedSuccessfully, setSavedSuccessfully] = useState(false);
  const [originalData, setOriginalData] = useState(null);

  // Store original data when loading contact
  useEffect(() => {
    const rawContact = route.params?.contact;
    const currentMode = route.params?.mode || 'add';

    if (currentMode === 'edit' && rawContact) {
      // Convert relative photo URL to absolute for proper comparison
      let originalPhotoUrl = rawContact.photo_url || rawContact.photoUrl || null;
      if (originalPhotoUrl && originalPhotoUrl.startsWith('/uploads/')) {
        originalPhotoUrl = `${API.API_URL}${originalPhotoUrl}`;
      }

      setOriginalData({
        name: rawContact.name || '',
        phone: rawContact.phone || '',
        email: rawContact.email || '',
        recordingUri: rawContact.recording_uri || rawContact.recordingUri || null,
        photoUrl: originalPhotoUrl,
      });
      console.log('📝 Stored original data for edit mode:', {
        name: rawContact.name,
        phone: rawContact.phone,
        email: rawContact.email,
        photoUrl: originalPhotoUrl,
      });
    } else {
      setOriginalData(null);
    }
  }, [route.params]);

  // Mark as having unsaved changes when user modifies form or adds recording
  useEffect(() => {
    const mode = route.params?.mode || 'add';

    if (mode === 'add') {
      // Add mode: any data means unsaved changes
      const hasData = formData.name || formData.phone || formData.email || recordingUri;
      console.log('🔍 Unsaved changes check (add mode):', {
        mode,
        hasName: !!formData.name,
        hasPhone: !!formData.phone,
        hasEmail: !!formData.email,
        hasRecording: !!recordingUri,
        willSetUnsaved: !!hasData,
      });

      if (hasData) {
        console.log('✅ Setting hasUnsavedChanges = true (add mode)');
        setHasUnsavedChanges(true);
        // Reset savedSuccessfully if user is editing again
        if (savedSuccessfully) {
          console.log('🔄 Resetting savedSuccessfully flag - user is editing again');
          setSavedSuccessfully(false);
        }
      }
    } else if (mode === 'edit' && originalData) {
      // Edit mode: check if current data differs from original
      const nameChanged = formData.name !== originalData.name;
      const phoneChanged = formData.phone !== originalData.phone;
      const emailChanged = formData.email !== originalData.email;
      const recordingChanged = recordingUri !== originalData.recordingUri;
      const photoChanged = photoUrl !== originalData.photoUrl;

      const hasChanges = nameChanged || phoneChanged || emailChanged || recordingChanged || photoChanged;

      console.log('🔍 Unsaved changes check (edit mode):', {
        mode,
        nameChanged,
        phoneChanged,
        emailChanged,
        recordingChanged,
        photoChanged,
        hasChanges,
        current: { name: formData.name, phone: formData.phone, email: formData.email, photoUrl },
        original: { name: originalData.name, phone: originalData.phone, email: originalData.email, photoUrl: originalData.photoUrl },
      });

      if (hasChanges) {
        console.log('✅ Setting hasUnsavedChanges = true (edit mode - data changed)');
        setHasUnsavedChanges(true);
        // Reset savedSuccessfully if user is editing again
        if (savedSuccessfully) {
          console.log('🔄 Resetting savedSuccessfully flag - user is editing again');
          setSavedSuccessfully(false);
        }
      } else {
        console.log('ℹ️ No changes detected in edit mode');
        setHasUnsavedChanges(false);
      }
    }
  }, [formData.name, formData.phone, formData.email, recordingUri, photoUrl, originalData, savedSuccessfully]);

  // Update global flag when unsaved changes state changes
  useEffect(() => {
    global.hasUnsavedContactChanges = hasUnsavedChanges && !savedSuccessfully && !isSaving;
    console.log('🌐 Updated global unsaved changes flag:', global.hasUnsavedContactChanges);

    // Clear the alert function if there are no unsaved changes
    if (!global.hasUnsavedContactChanges) {
      console.log('🧹 No unsaved changes - clearing alert function');
      global.showUnsavedChangesAlert = null;
    }
  }, [hasUnsavedChanges, savedSuccessfully, isSaving]);

  // Provide global function to show unsaved changes alert
  useEffect(() => {
    // Only create the alert function if there are unsaved changes
    if (!hasUnsavedChanges || savedSuccessfully || isSaving) {
      console.log('🔧 No unsaved changes - clearing alert function');
      global.showUnsavedChangesAlert = null;
      return;
    }

    // Capture current values in closure so they don't get lost during navigation
    const currentFormData = { ...formData };
    const currentMode = route.params?.mode || 'add';
    const currentContact = route.params?.contact;
    const currentRecordingUri = recordingUri;
    const currentPhotoUrl = photoUrl;

    console.log('🔧 Setting up alert function with captured state:', {
      mode: currentMode,
      hasName: !!currentFormData.name,
      hasPhone: !!currentFormData.phone,
      hasEmail: !!currentFormData.email,
    });

    global.showUnsavedChangesAlert = (onConfirm) => {
      console.log('🚨 Showing unsaved changes alert with captured state:', {
        mode: currentMode,
        formData: currentFormData,
      });

      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes. What would you like to do?',
        [
          {
            text: "Don't Leave",
            style: 'cancel',
            onPress: () => {
              console.log('User chose to stay');
              // Don't change any state - let user continue editing
            }
          },
          {
            text: 'Save Changes',
            onPress: async () => {
              try {
                console.log('🚀 User chose to save changes - using captured formData');

                // Manually save using captured values instead of current state
                await saveContactWithData(
                  currentFormData,
                  currentMode,
                  currentContact,
                  currentRecordingUri,
                  currentPhotoUrl,
                  true // skipSuccessAlert
                );

                console.log('💾 Save completed successfully - navigating...');
                // Navigate immediately after save completes
                if (onConfirm) onConfirm();
              } catch (error) {
                console.error('❌ Error in Save Changes button:', error);
                Alert.alert('Error', 'Failed to save: ' + error.message);
              }
            },
          },
          {
            text: 'Discard Changes',
            style: 'destructive',
            onPress: () => {
              console.log('User chose to discard changes - resetting state and navigating');
              setHasUnsavedChanges(false);
              setSavedSuccessfully(true);
              global.hasUnsavedContactChanges = false;
              global.showUnsavedChangesAlert = null;
              if (onConfirm) onConfirm();
            },
          },
        ]
      );
    };

    return () => {
      console.log('🧹 Alert function useEffect cleanup');
      global.showUnsavedChangesAlert = null;
    };
  }, [formData, route.params, recordingUri, photoUrl, hasUnsavedChanges, savedSuccessfully, isSaving]);

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
        'You have unsaved changes. What would you like to do?',
        [
          {
            text: "Don't Leave",
            style: 'cancel',
            onPress: () => console.log('User chose to stay')
          },
          {
            text: 'Save Changes',
            onPress: async () => {
              try {
                console.log('🚀 User chose to save changes (hardware back) - starting save...');
                await saveContact(null, true); // Skip success alert, we'll navigate directly
                console.log('💾 Save completed - going back...');
                navigation.goBack();
              } catch (error) {
                console.error('❌ Error in Save Changes (hardware back):', error);
                Alert.alert('Error', 'Failed to save: ' + error.message);
              }
            },
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
        'You have unsaved changes. What would you like to do?',
        [
          { text: "Don't Leave", style: 'cancel', onPress: () => console.log('User chose to stay') },
          {
            text: 'Save Changes',
            onPress: async () => {
              try {
                console.log('🚀 User chose to save changes (beforeRemove) - starting save...');
                await saveContact(null, true); // Skip success alert, we'll navigate directly
                console.log('💾 Save completed - dispatching navigation...');
                navigation.dispatch(e.data.action);
              } catch (error) {
                console.error('❌ Error in Save Changes (beforeRemove):', error);
                Alert.alert('Error', 'Failed to save: ' + error.message);
              }
            },
          },
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
      // Store local photo URI - will be uploaded to backend when saving contact
      const localUri = result.assets[0].uri;
      setPhotoUrl(localUri);
      console.log('📸 Photo captured locally:', localUri);
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
      // Store local photo URI - will be uploaded to backend when saving contact
      const localUri = result.assets[0].uri;
      setPhotoUrl(localUri);
      console.log('📸 Photo selected locally:', localUri);
    }
  };

    // Save contact using captured parameters (used by unsaved changes alert)
    const saveContactWithData = async (
      formDataParam,
      modeParam,
      contactParam,
      recordingUriParam,
      photoUrlParam,
      skipSuccessAlert = false
    ) => {
      console.log('💾 saveContactWithData called with captured parameters:', {
        mode: modeParam,
        formData: formDataParam,
        hasRecording: !!recordingUriParam,
        hasPhoto: !!photoUrlParam,
      });

      // Validation: require at least name or phone for new contacts
      if (modeParam === 'add' && !formDataParam.name && !formDataParam.phone) {
        Alert.alert('Error', 'Please provide at least a name or phone number');
        return;
      }

      setIsSaving(true);

      try {
        const contactId = contactParam?.contact_id;

        console.log('💾 Preparing to save contact with captured data:', {
          mode: modeParam,
          hasRecordingUri: !!recordingUriParam,
          recordingUri: recordingUriParam,
        });

        // Prepare contact data for API
        const contactFormData = new FormData();

        // Always send name (required for new contacts)
        contactFormData.append('name', formDataParam.name);

        // Only send phone/email if they have values
        if (formDataParam.phone) {
          contactFormData.append('phone', formDataParam.phone);
        } else if (modeParam === 'add') {
          contactFormData.append('phone', '');
        }

        if (formDataParam.email) {
          contactFormData.append('email', formDataParam.email);
        } else if (modeParam === 'add') {
          contactFormData.append('email', '');
        }

        console.log('📝 Captured form data:', {
          name: formDataParam.name,
          phone: formDataParam.phone,
          email: formDataParam.email,
          nameLength: formDataParam.name?.length,
          phoneLength: formDataParam.phone?.length,
          emailLength: formDataParam.email?.length,
        });

        console.log('📤 Fields being sent to API:', {
          name: 'ALWAYS SENT: ' + formDataParam.name,
          phone: formDataParam.phone ? `SENT: ${formDataParam.phone}` : (modeParam === 'add' ? 'SENT: empty string' : 'NOT SENT - will preserve existing'),
          email: formDataParam.email ? `SENT: ${formDataParam.email}` : (modeParam === 'add' ? 'SENT: empty string' : 'NOT SENT - will preserve existing'),
          mode: modeParam,
          contactId: contactId,
        });

        // Add voice recording ONLY if it's a NEW local file (not an existing server path)
        // Local recordings start with "file://" - server paths start with "/uploads/" or "http"
        if (recordingUriParam && typeof recordingUriParam === 'string' && recordingUriParam.length > 0) {
          // Check if this is a local file URI (new recording) or server path (existing recording)
          const isLocalFile = recordingUriParam.startsWith('file://');
          const isServerPath = recordingUriParam.startsWith('/uploads/') ||
                              recordingUriParam.startsWith('http://') ||
                              recordingUriParam.startsWith('https://');

          if (isLocalFile) {
            console.log('🎙️ Adding NEW audio recording to upload:', recordingUriParam);
            const uriParts = recordingUriParam.split('.');
            const fileType = uriParts[uriParts.length - 1];

            contactFormData.append('audio', {
              uri: recordingUriParam,
              type: `audio/${fileType}`,
              name: `voice-note.${fileType}`,
            });
          } else if (isServerPath) {
            console.log('ℹ️ Skipping upload - recording already exists on server:', recordingUriParam);
            // Don't upload - the recording is already on the server
          } else {
            console.warn('⚠️ Unknown recording URI format:', recordingUriParam);
          }
        } else {
          console.log('ℹ️ No recording to upload');
        }

        // Add photo - upload if it's a local file, or send URL if already on server
        if (photoUrlParam && typeof photoUrlParam === 'string' && photoUrlParam.length > 0) {
          const isLocalFile = photoUrlParam.startsWith('file://');
          const isServerPath = photoUrlParam.startsWith('/uploads/') ||
                              photoUrlParam.startsWith('http://') ||
                              photoUrlParam.startsWith('https://');

          if (isLocalFile) {
            console.log('📸 Adding NEW photo to upload:', photoUrlParam);
            contactFormData.append('photo', {
              uri: photoUrlParam,
              type: 'image/jpeg',
              name: 'contact-photo.jpg',
            });
          } else if (isServerPath) {
            console.log('ℹ️ Photo already on server, sending URL:', photoUrlParam);
            contactFormData.append('photoUrl', photoUrlParam);
          } else {
            console.warn('⚠️ Unknown photo URI format:', photoUrlParam);
          }
        }

        console.log(`${modeParam === 'edit' ? 'Updating' : 'Creating'} contact in cloud (${API.ENV_NAME})...`);

        let response;
        if (modeParam === 'edit' && contactId) {
          // Update existing contact
          response = await apiClient.put(
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
          response = await apiClient.post(
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
          photo_url: savedContact.photo_url,
          webhook_status: savedContact.webhook_status,
        });

        // Update photoUrl with server URL for N8N webhooks
        if (savedContact.photo_url) {
          let serverPhotoUrl = savedContact.photo_url;
          // Convert relative URL to absolute
          if (serverPhotoUrl.startsWith('/uploads/')) {
            serverPhotoUrl = `${API.API_URL}${serverPhotoUrl}`;
          }
          setPhotoUrl(serverPhotoUrl);
          console.log('📸 Updated photoUrl with server URL:', serverPhotoUrl);
        }

        // Mark as saved successfully to prevent unsaved changes warning
        setSavedSuccessfully(true);
        setHasUnsavedChanges(false);
        global.hasUnsavedContactChanges = false;
        global.showUnsavedChangesAlert = null;

        // Set transcript immediately if it was returned (instant transcription!)
        if (savedContact.transcript) {
          console.log('✅ Instant transcript received:', savedContact.transcript.substring(0, 50) + '...');
          setTranscript(savedContact.transcript);
        }

        // Invalidate contacts cache to force refresh on list screen
        await AsyncStorage.multiRemove([CACHE_KEY, CACHE_TIMESTAMP_KEY]);
        console.log('🗑️ Contacts cache invalidated - list will refresh from server');

        // Only show success alert if not skipped
        if (!skipSuccessAlert) {
          let successMessage = `Contact ${modeParam === 'edit' ? 'updated' : 'saved'} to cloud!\n\n☁️ Your data is safely backed up.`;

          if (savedContact.has_recording) {
            if (savedContact.transcript) {
              successMessage += '\n\n🎙️ Voice note transcribed instantly!';
            } else {
              successMessage += '\n\n🎙️ Voice note saved (transcription unavailable).';
            }

            // N8N is now optional for power users
            if (savedContact.webhook_status === 'sent') {
              successMessage += '\n📤 Data sent to N8N webhook for custom integrations.';
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
        } else {
          console.log('✅ Contact saved - skipping success alert (will navigate from warning dialog)');
        }
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
        throw error; // Re-throw so the caller knows it failed
      } finally {
        setIsSaving(false);
      }
    };

    const saveContact = async (overrideRecordingUri = null, skipSuccessAlert = false) => {
      const mode = route.params?.mode || 'add';

      // Validation: require at least name or phone for new contacts
      // For edit mode, only validate if we're not just adding additional info
      if (mode === 'add' && !formData.name && !formData.phone) {
        Alert.alert('Error', 'Please provide at least a name or phone number');
        return;
      }

      setIsSaving(true);

      try {
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

        // Always send name (required for new contacts)
        contactFormData.append('name', formData.name);

        // Only send phone/email if they have values (to avoid overwriting with empty strings)
        if (formData.phone) {
          contactFormData.append('phone', formData.phone);
        } else if (mode === 'add') {
          // For add mode, send empty string if no phone
          contactFormData.append('phone', '');
        }

        if (formData.email) {
          contactFormData.append('email', formData.email);
        } else if (mode === 'add') {
          // For add mode, send empty string if no email
          contactFormData.append('email', '');
        }

        console.log('📝 Form data state:', {
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
          nameLength: formData.name?.length,
          phoneLength: formData.phone?.length,
          emailLength: formData.email?.length,
        });

        console.log('📤 Fields being sent to API:', {
          name: 'ALWAYS SENT: ' + formData.name,
          phone: formData.phone ? `SENT: ${formData.phone}` : (mode === 'add' ? 'SENT: empty string' : 'NOT SENT - will preserve existing'),
          email: formData.email ? `SENT: ${formData.email}` : (mode === 'add' ? 'SENT: empty string' : 'NOT SENT - will preserve existing'),
          mode,
          contactId: rawContact?.contact_id,
        });

        // Add voice recording ONLY if it's a NEW local file (not an existing server path)
        // Local recordings start with "file://" - server paths start with "/uploads/" or "http"
        if (uriToUse && typeof uriToUse === 'string' && uriToUse.length > 0) {
          // Check if this is a local file URI (new recording) or server path (existing recording)
          const isLocalFile = uriToUse.startsWith('file://');
          const isServerPath = uriToUse.startsWith('/uploads/') ||
                              uriToUse.startsWith('http://') ||
                              uriToUse.startsWith('https://');

          if (isLocalFile) {
            console.log('🎙️ Adding NEW audio recording to upload:', uriToUse);
            const uriParts = uriToUse.split('.');
            const fileType = uriParts[uriParts.length - 1];

            contactFormData.append('audio', {
              uri: uriToUse,
              type: `audio/${fileType}`,
              name: `voice-note.${fileType}`,
            });
          } else if (isServerPath) {
            console.log('ℹ️ Skipping upload - recording already exists on server:', uriToUse);
            // Don't upload - the recording is already on the server
          } else {
            console.warn('⚠️ Unknown recording URI format:', uriToUse);
          }
        } else {
          console.log('ℹ️ No recording to upload');
        }

        // Add photo - upload if it's a local file, or send URL if already on server
        if (photoUrl && typeof photoUrl === 'string' && photoUrl.length > 0) {
          const isLocalFile = photoUrl.startsWith('file://');
          const isServerPath = photoUrl.startsWith('/uploads/') ||
                              photoUrl.startsWith('http://') ||
                              photoUrl.startsWith('https://');

          if (isLocalFile) {
            console.log('📸 Adding NEW photo to upload:', photoUrl);
            contactFormData.append('photo', {
              uri: photoUrl,
              type: 'image/jpeg',
              name: 'contact-photo.jpg',
            });
          } else if (isServerPath) {
            console.log('ℹ️ Photo already on server, sending URL:', photoUrl);
            contactFormData.append('photoUrl', photoUrl);
          } else {
            console.warn('⚠️ Unknown photo URI format:', photoUrl);
          }
        }

        console.log(`${mode === 'edit' ? 'Updating' : 'Creating'} contact in cloud (${API.ENV_NAME})...`);

        let response;
        if (mode === 'edit' && contactId) {
          // Update existing contact
          response = await apiClient.put(
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
          response = await apiClient.post(
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
          photo_url: savedContact.photo_url,
          webhook_status: savedContact.webhook_status,
        });

        // Update photoUrl with server URL for N8N webhooks
        if (savedContact.photo_url) {
          let serverPhotoUrl = savedContact.photo_url;
          // Convert relative URL to absolute
          if (serverPhotoUrl.startsWith('/uploads/')) {
            serverPhotoUrl = `${API.API_URL}${serverPhotoUrl}`;
          }
          setPhotoUrl(serverPhotoUrl);
          console.log('📸 Updated photoUrl with server URL:', serverPhotoUrl);
        }

        // Mark as saved successfully to prevent unsaved changes warning
        setSavedSuccessfully(true);
        setHasUnsavedChanges(false);

        // Set transcript immediately if it was returned (instant transcription!)
        if (savedContact.transcript) {
          console.log('✅ Instant transcript received:', savedContact.transcript.substring(0, 50) + '...');
          setTranscript(savedContact.transcript);
        }

        // Invalidate contacts cache to force refresh on list screen
        await AsyncStorage.multiRemove([CACHE_KEY, CACHE_TIMESTAMP_KEY]);
        console.log('🗑️ Contacts cache invalidated - list will refresh from server');

        // Only show success alert if not skipped (when called from warning dialog, we skip it)
        if (!skipSuccessAlert) {
          Alert.alert(
            '✅ Success!',
            'contact saved!',
            [
              {
                text: 'OK',
                onPress: () => navigation.navigate('ContactList'),
              },
            ]
          );
        } else {
          console.log('✅ Contact saved - skipping success alert (will navigate from warning dialog)');
        }
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

  // Route message sending based on user's delivery method preference
  const handleSendMessage = async (action) => {
    try {
      setIsSendingMessage(true);

      // Check delivery method preference
      const deliveryMethod = await AsyncStorage.getItem('@sms:delivery_method') || 'native';
      console.log('📤 SMS delivery method:', deliveryMethod);

      if (deliveryMethod === 'n8n') {
        // Use N8N webhook
        await sendMasterWebhook(action);
      } else {
        // Use native SMS
        await sendMessage(action);
      }
    } catch (error) {
      console.error('Error handling message send:', error);
      Alert.alert('❌ Error', `Failed to send message: ${error.message}`);
    } finally {
      setIsSendingMessage(false);
    }
  };

  const sendMessage = async (action) => {
    try {
      if (!formData.phone) {
        Alert.alert('Error', 'Phone number is required to send SMS');
        return;
      }

      // Load message template from AsyncStorage
      const templateKey = action === 'welcome' ? '@sms:welcome_message' : '@sms:link_message';
      let messageTemplate = await AsyncStorage.getItem(templateKey);

      // Use default if template not set
      if (!messageTemplate) {
        if (action === 'welcome') {
          messageTemplate = "Hi {name}!  It was so great to meet you. Looking forward to staying in touch! Here's my booking link: [insert your booking link] \noh... BTW here's the picture I took from us 😎 {photo}";
        } else if (action === 'link') {
          messageTemplate = "Hi {name}! It was so great to meet you. Looking forward to staying in touch! Here's the link to [insert link to your product/service] we discussed. oh... BTW here's the picture I took from us 😎 \n{photo}";
        }
      }

      // Replace {name} with actual contact name
      let messageBody = messageTemplate.replace(/{name}/g, formData.name || 'there');

      // Replace {photo} with photo URL if available
      // Only include photo if it's already uploaded to server (http/https URL, not local file://)
      if (photoUrl && (photoUrl.startsWith('http://') || photoUrl.startsWith('https://'))) {
        messageBody = messageBody.replace(/{photo}/g, photoUrl);
        console.log('📸 Including photo URL in message:', photoUrl);
      } else {
        // Remove {photo} placeholder if no server photo available
        messageBody = messageBody.replace(/{photo}/g, '');
        if (messageTemplate.includes('{photo}')) {
          console.log('ℹ️ No server photo URL available - placeholder removed from message');
        }
      }

      console.log('📤 Opening SMS app with pre-filled message:', { action, phone: formData.phone });

      // Format phone number (remove any non-numeric characters except +)
      const cleanPhone = formData.phone.replace(/[^\d+]/g, '');

      // Create SMS URL with phone number and message body
      const smsUrl = `sms:${cleanPhone}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(messageBody)}`;

      // Check if SMS is supported
      const supported = await Linking.canOpenURL(smsUrl);

      if (supported) {
        await Linking.openURL(smsUrl);
        console.log('✅ SMS app opened successfully');
      } else {
        Alert.alert('Error', 'SMS is not supported on this device');
      }
    } catch (error) {
      console.error('Error opening SMS app:', error);
      Alert.alert('❌ Error', `Failed to open SMS app: ${error.message}`);
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
      let audioUrl = null;

      if (recordingUri) {
        // Check if this is a local file or server path
        const isLocalFile = recordingUri.startsWith('file://');
        const isServerPath = recordingUri.startsWith('/uploads/') ||
                            recordingUri.startsWith('http://') ||
                            recordingUri.startsWith('https://');

        if (isLocalFile) {
          // Convert local file to base64 for N8N
          console.log('🔄 Converting local recording to base64');
          audioBase64 = await convertRecordingToBase64(recordingUri);
        } else if (isServerPath) {
          // Recording already on server, send URL
          audioUrl = recordingUri.startsWith('/uploads/')
            ? `${API.API_URL}${recordingUri}`
            : recordingUri;
          console.log('🔗 Recording already on server:', audioUrl);
        }
      }

      const payload = {
        action: action,
        contact: {
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
        },
        audio_base64: audioBase64,
        audio_url: audioUrl,
        hasRecording: hasRecording,
        photoUrl: photoUrl,
        hasPhoto: !!photoUrl,
        timestamp: new Date().toISOString(),
      };

      console.log('📤 Sending webhook with payload:', {
        action,
        contactName: formData.name,
        photoUrl: photoUrl,
        photoUrlType: typeof photoUrl,
        hasPhoto: !!photoUrl,
        hasAudioBase64: !!audioBase64,
        hasAudioUrl: !!audioUrl,
      });

      const response = await fetch(masterFlowUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        Alert.alert('✅ Success!', 'message sent successfully!');
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
      console.log('🔄 Converting recording to base64:', uri);

      // Read the audio file as base64
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });

      // Return as data URI format for N8N
      const dataUri = `data:audio/m4a;base64,${base64}`;
      console.log('✅ Recording converted to base64 (length:', dataUri.length, ')');
      return dataUri;
    } catch (error) {
      console.error('❌ Error converting recording to base64:', error);
      return null;
    }
  };

  // Route calendar event creation based on user's delivery method preference
  const handleCreateCalendarEvent = async () => {
    try {
      // Debug: Show ALL delivery method values
      const smsMethod = await AsyncStorage.getItem('@sms:delivery_method');
      const calendarMethod = await AsyncStorage.getItem('@calendar:delivery_method');

      console.log('🔍 DEBUG - ALL delivery methods in AsyncStorage:');
      console.log('  SMS method:', smsMethod);
      console.log('  Calendar method:', calendarMethod);

      // Check delivery method preference
      const deliveryMethod = calendarMethod || 'native';
      console.log('📅 Calendar delivery method (with fallback):', deliveryMethod);

      if (deliveryMethod === 'n8n') {
        console.log('🔗 ROUTE CHOSEN: Using N8N webhook for calendar event');
        await sendCalendarWebhook();
      } else {
        console.log('📱 ROUTE CHOSEN: Using NATIVE calendar for event (no N8N involved)');
        await createNativeCalendarEvent();
      }
    } catch (error) {
      console.error('❌ Error handling calendar event:', error);
      Alert.alert('❌ Error', `Failed to create calendar event: ${error.message}`);
    }
  };

  const createNativeCalendarEvent = async () => {
    try {
      console.log('📱 createNativeCalendarEvent started - this does NOT use N8N');

      // Request calendar permissions
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      console.log('📅 Calendar permission status:', status);

      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Calendar permission is required to create events.');
        return;
      }

      // Get default calendar
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      console.log('📅 Found calendars:', calendars.length);

      const defaultCalendar = calendars.find(cal => cal.isPrimary) || calendars[0];

      if (!defaultCalendar) {
        Alert.alert('Error', 'No calendar found on this device.');
        return;
      }

      console.log('📅 Using calendar:', defaultCalendar.title);

      // Create event details
      const eventTitle = `Follow up: ${formData.name || 'New Contact'}`;
      const eventNotes = `Contact: ${formData.name || 'N/A'}\nPhone: ${formData.phone || 'N/A'}\nEmail: ${formData.email || 'N/A'}`;

      // Set event for tomorrow at 10 AM
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 1);
      startDate.setHours(10, 0, 0, 0);

      const endDate = new Date(startDate);
      endDate.setHours(11, 0, 0, 0);

      console.log('📅 Creating event:', eventTitle);
      console.log('📅 Start time:', startDate.toISOString());

      // Create event
      const eventId = await Calendar.createEventAsync(defaultCalendar.id, {
        title: eventTitle,
        startDate,
        endDate,
        notes: eventNotes,
        timeZone: 'America/New_York',
      });

      console.log('✅ Native calendar event created successfully! ID:', eventId);
      Alert.alert('✅ Success!!', 'Calendar reminder saved!');
    } catch (error) {
      console.error('❌ Error creating native calendar event:', error);
      Alert.alert('❌ Error', `Failed to create calendar event: ${error.message}`);
    }
  };

  const sendCalendarWebhook = async () => {
    try {
      const masterFlowUrl = await AsyncStorage.getItem('@webhook:master_flow');

      if (!masterFlowUrl) {
        Alert.alert('Webhook Not Configured', 'Please configure the N8N Master Flow URL in Settings first.');
        return;
      }

      // Set event for tomorrow at 10 AM
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 1);
      startDate.setHours(10, 0, 0, 0);

      const endDate = new Date(startDate);
      endDate.setHours(11, 0, 0, 0);

      const payload = {
        action: 'create_calendar_event',
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
        photoUrl: photoUrl,
        hasPhoto: !!photoUrl,
        timestamp: new Date().toISOString(),
      };

      console.log('📅 Sending calendar event webhook:', {
        action: 'create_calendar_event',
        contactName: formData.name,
        startTime: startDate.toISOString(),
      });

      const response = await fetch(masterFlowUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        Alert.alert('✅ Success!!', 'Calendar reminder saved!');
      } else {
        Alert.alert('❌ Error', `Webhook failed with status: ${response.status}`);
      }
    } catch (error) {
      console.error('Calendar webhook error:', error);
      Alert.alert('❌ Error', `Failed to send calendar webhook: ${error.message}`);
    }
  };


  // Cleanup: Clear global flags when screen loses focus or unmounts
  useEffect(() => {
    console.log('📍 ContactCaptureScreen mounted');

    // Subscribe to navigation focus events
    const unsubscribeBlur = navigation.addListener('blur', () => {
      console.log('👋 ContactCaptureScreen lost focus - cleaning up global flags');
      console.log('  - global.hasUnsavedContactChanges:', global.hasUnsavedContactChanges);

      // Clear flags immediately when leaving the screen
      // Use the GLOBAL flag (not closure variable) to check current state
      if (!global.hasUnsavedContactChanges) {
        console.log('  - No unsaved changes, clearing alert function');
        global.showUnsavedChangesAlert = null;
      } else {
        console.log('  - Has unsaved changes, keeping alert function');
      }
    });

    return () => {
      console.log('🧹 ContactCaptureScreen unmounting - final cleanup');
      console.log('  - global.hasUnsavedContactChanges:', global.hasUnsavedContactChanges);
      unsubscribeBlur();

      // Only force clear on unmount if no unsaved changes
      if (!global.hasUnsavedContactChanges) {
        console.log('  - No unsaved changes, clearing globals');
        global.showUnsavedChangesAlert = null;
      } else {
        console.log('  - Has unsaved changes, keeping globals for tab navigation');
      }
    };
  }, [navigation]);

  const mode = route.params?.mode || 'add';
  const prefilledContact = route.params?.contactData;

  return (
    <ScrollView ref={scrollViewRef} style={styles.container}>
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

        {isSendingMessage && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={styles.loadingText}>Sending message...</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.actionButton, isSendingMessage && styles.actionButtonDisabled]}
          onPress={() => handleSendMessage('welcome')}
          disabled={isSendingMessage}
        >
          <Text style={styles.actionButtonText}>📧 Send Welcome Message</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonSecondary, isSendingMessage && styles.actionButtonDisabled]}
          onPress={() => handleSendMessage('link')}
          disabled={isSendingMessage}
        >
          <Text style={styles.actionButtonText}>🔗 Send Invitation Link</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonSecondary]}
          onPress={handleCreateCalendarEvent}
        >
          <Text style={styles.actionButtonText}>📅 Create Calendar Event</Text>
        </TouchableOpacity>
      </View>

      {/* Save Button */}
      <TouchableOpacity
        style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
        onPress={() => saveContact()}
        disabled={isSaving}
      >
        <Text style={styles.saveButtonText}>
          {isSaving
            ? '☁️ Saving to Cloud...'
            : `💾 ${mode === 'edit' ? 'Update Contact' : 'Save Contact'}`
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
  transcriptWaiting: {
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#6366f1',
    alignItems: 'center',
  },
  transcriptWaitingText: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '600',
    marginBottom: 4,
  },
  transcriptWaitingSubtext: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
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
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderRadius: 12,
  },
  loadingText: {
    marginTop: 12,
    color: '#f1f5f9',
    fontSize: 16,
    fontWeight: '600',
  },
  actionButton: {
    backgroundColor: '#6366f1',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  actionButtonDisabled: {
    backgroundColor: '#64748b',
    opacity: 0.6,
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
