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
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';

const ContactCaptureScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();

  const mode = route.params?.mode || 'add';
  const editContact = route.params?.contact || null;
  const prefilledContact = route.params?.contactData || null;

  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState(null);
  const [recordingUri, setRecordingUri] = useState(editContact?.recordingUri || null);
  const [hasRecording, setHasRecording] = useState(editContact?.hasRecording || false);
  const [photoUrl, setPhotoUrl] = useState(editContact?.photoUrl || null);

  const [formData, setFormData] = useState({
    name: editContact?.name || prefilledContact?.name || '',
    phone: editContact?.phone || prefilledContact?.phone || '',
    email: editContact?.email || prefilledContact?.email || '',
    recordID: editContact?.recordID || prefilledContact?.recordID || null,
  });

    // Update form when route params change
    useEffect(() => {
      if (mode === 'edit' && editContact) {
        // Editing existing contact - populate with contact data
        setFormData({
          name: editContact.name || '',
          phone: editContact.phone || '',
          email: editContact.email || '',
          recordID: editContact.recordID || null,
        });
        setRecordingUri(editContact.recordingUri || null);
        setHasRecording(editContact.hasRecording || false);
        setPhotoUrl(editContact.photoUrl || null);
      } else if (mode === 'add' && prefilledContact) {
        // New contact from notification - populate with prefilled data
        setFormData({
          name: prefilledContact.name || '',
          phone: prefilledContact.phone || '',
          email: prefilledContact.email || '',
          recordID: prefilledContact.recordID || null,
        });
        setRecordingUri(null);
        setHasRecording(false);
        setPhotoUrl(null);
      } else if (mode === 'add' && !prefilledContact) {
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
      }
    }, [mode, editContact, prefilledContact]);

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

      console.log('Recording stopped, saved to:', uri);
      Alert.alert('Success', 'Recording saved!');
    } catch (error) {
      console.error('Failed to stop recording:', error);
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

    const saveContact = async () => {
      if (!formData.name && !formData.phone) {
        Alert.alert('Error', 'Please provide at least a name or phone number');
        return;
      }

      try {
        const newContact = {
          id: editContact?.id || Date.now().toString(),
          ...formData,
          recordingUri,
          hasRecording,
          photoUrl,
          hasPhoto: !!photoUrl,
          createdAt: editContact?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Send update webhook and get transcript
        const transcript = await sendUpdateWebhook(newContact);
        
        // Add transcript to contact if received
        if (transcript) {
          newContact.transcript = transcript;
        }

        const stored = await AsyncStorage.getItem('@contacts:list');
        const contacts = stored ? JSON.parse(stored) : [];

        if (mode === 'edit') {
          const index = contacts.findIndex(c => c.id === editContact.id);
          if (index !== -1) {
            contacts[index] = newContact;
          }
        } else {
          contacts.push(newContact);
        }

        await AsyncStorage.setItem('@contacts:list', JSON.stringify(contacts));

        Alert.alert('Success', `Contact ${mode === 'edit' ? 'updated' : 'saved'}!${transcript ? '\n\nTranscript received!' : ''}`);
        navigation.navigate('ContactList');
      } catch (error) {
        console.error('Error saving contact:', error);
        Alert.alert('Error', 'Failed to save contact');
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
      <TouchableOpacity style={styles.saveButton} onPress={saveContact}>
        <Text style={styles.saveButtonText}>
          💾 {mode === 'edit' ? 'Update Contact' : 'Save Contact'}
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
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ContactCaptureScreen;
