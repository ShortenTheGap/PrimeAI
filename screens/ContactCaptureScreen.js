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
import apiClient from '../services/ApiService';
import API from '../config/api';

// Cache keys (must match ContactListScreen)
const CACHE_KEY = '@contacts:list';
const CACHE_TIMESTAMP_KEY = '@contacts:timestamp';

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
  const [originalData, setOriginalData] = useState(null);

  // Store original data when loading contact
  useEffect(() => {
    const rawContact = route.params?.contact;
    const currentMode = route.params?.mode || 'add';

    if (currentMode === 'edit' && rawContact) {
      setOriginalData({
        name: rawContact.name || '',
        phone: rawContact.phone || '',
        email: rawContact.email || '',
        recordingUri: rawContact.recording_uri || rawContact.recordingUri || null,
        photoUrl: rawContact.photo_url || rawContact.photoUrl || null,
      });
      console.log('📝 Stored original data for edit mode:', {
        name: rawContact.name,
        phone: rawContact.phone,
        email: rawContact.email,
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
        current: { name: formData.name, phone: formData.phone, email: formData.email },
        original: { name: originalData.name, phone: originalData.phone, email: originalData.email },
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
  }, [hasUnsavedChanges, savedSuccessfully, isSaving]);

  // Provide global function to show unsaved changes alert
  useEffect(() => {
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
              if (onConfirm) onConfirm();
            },
          },
        ]
      );
    };

    return () => {
      global.showUnsavedChangesAlert = null;
    };
  }, [formData, route.params, recordingUri, photoUrl]);

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

        // Add photo URL if exists
        if (photoUrlParam) {
          contactFormData.append('photoUrl', photoUrlParam);
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
          webhook_status: savedContact.webhook_status,
        });

        // Mark as saved successfully to prevent unsaved changes warning
        setSavedSuccessfully(true);
        setHasUnsavedChanges(false);
        global.hasUnsavedContactChanges = false;

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

        // Add photo URL if exists
        if (photoUrl) {
          contactFormData.append('photoUrl', photoUrl);
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
          webhook_status: savedContact.webhook_status,
        });

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
          // Build success message with webhook status
          let successMessage = `Contact ${mode === 'edit' ? 'updated' : 'saved'} to cloud!\n\n☁️ Your data is safely backed up.`;

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


  // Cleanup: Clear global flags when screen loses focus or unmounts
  useEffect(() => {
    console.log('📍 ContactCaptureScreen mounted');

    // Subscribe to navigation focus events
    const unsubscribeBlur = navigation.addListener('blur', () => {
      console.log('👋 ContactCaptureScreen lost focus - cleaning up global flags');
      // Clear flags immediately when leaving the screen
      // Only keep them if there are actual unsaved changes
      if (!hasUnsavedChanges) {
        global.hasUnsavedContactChanges = false;
        global.showUnsavedChangesAlert = null;
      }
    });

    return () => {
      console.log('🧹 ContactCaptureScreen unmounting - final cleanup');
      unsubscribeBlur();
      // Force clear on unmount regardless
      global.hasUnsavedContactChanges = false;
      global.showUnsavedChangesAlert = null;
    };
  }, [hasUnsavedChanges, navigation]);

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
