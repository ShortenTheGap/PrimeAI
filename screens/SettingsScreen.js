import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Linking,
  TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import ContactMonitorService from '../services/ContactMonitorService';
import BackgroundTaskService from '../services/BackgroundTaskService';
import userService from '../services/UserService';
import API from '../config/api';

const SettingsScreen = () => {
  const [monitoringEnabled, setMonitoringEnabled] = useState(false);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [masterFlowUrl, setMasterFlowUrl] = useState('');
  const [cloudinaryCloudName, setCloudinaryCloudName] = useState('');
  const [cloudinaryUploadPreset, setCloudinaryUploadPreset] = useState('');
  const [userInfo, setUserInfo] = useState(null);

  useEffect(() => {
    checkPermissions();
    loadSettings();
    loadUserInfo();
  }, []);

  const loadUserInfo = async () => {
    const user = await userService.getUser();
    const token = await userService.getToken();
    if (user || token) {
      setUserInfo(user);
    }
  };

  const loadSettings = async () => {
    try {
      const savedUrl = await AsyncStorage.getItem('@webhook:master_flow');
      const savedCloudName = await AsyncStorage.getItem('@cloudinary:cloud_name');
      const savedUploadPreset = await AsyncStorage.getItem('@cloudinary:upload_preset');

      if (savedUrl) setMasterFlowUrl(savedUrl);
      if (savedCloudName) setCloudinaryCloudName(savedCloudName);
      if (savedUploadPreset) setCloudinaryUploadPreset(savedUploadPreset);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            if (global.handleLogout) {
              await global.handleLogout();
            }
          },
        },
      ]
    );
  };

  const saveMasterFlowUrl = async (value) => {
    setMasterFlowUrl(value);
    try {
      await AsyncStorage.setItem('@webhook:master_flow', value);
    } catch (error) {
      console.error('Error saving master flow URL:', error);
    }
  };

  const saveCloudinaryCloudName = async (value) => {
    setCloudinaryCloudName(value);
    try {
      await AsyncStorage.setItem('@cloudinary:cloud_name', value);
    } catch (error) {
      console.error('Error saving cloudinary cloud name:', error);
    }
  };

  const saveCloudinaryUploadPreset = async (value) => {
    setCloudinaryUploadPreset(value);
    try {
      await AsyncStorage.setItem('@cloudinary:upload_preset', value);
    } catch (error) {
      console.error('Error saving cloudinary upload preset:', error);
    }
  };

  const checkPermissions = async () => {
    const granted = await ContactMonitorService.requestPermissions();
    setHasPermissions(granted);
    if (granted) {
      setMonitoringEnabled(ContactMonitorService.isMonitoring);
    }
  };

  const toggleMonitoring = async (value) => {
    if (!hasPermissions) {
      Alert.alert(
        'Permission Required',
        'Contact access is required to monitor for new contacts. Please grant permission in Settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }

    if (value) {
      await ContactMonitorService.initialize();
      await BackgroundTaskService.register();
    } else {
      ContactMonitorService.stopMonitoring();
      await BackgroundTaskService.unregister();
    }

    setMonitoringEnabled(value);
  };

  const testNotification = () => {
    ContactMonitorService.testNotification();
    Alert.alert('Test Notification', 'A test notification has been sent!');
  };

  const testMasterWebhook = async () => {
    if (!masterFlowUrl) {
      Alert.alert('Error', 'Please enter the N8N Master Flow URL first');
      return;
    }

    Alert.alert('Testing Webhooks', 'Sending 3 test payloads with different action tags...');

    // Mock base64 audio (very short sample)
    const mockAudioBase64 = 'data:audio/mp4;base64,AAAAGGZ0eXBNNEEgAAAAAE00QSBpc29tAAAA';

    // Mock photo URL
    const mockPhotoUrl = 'https://res.cloudinary.com/demo/image/upload/sample.jpg';

    // Mock contact data
    const mockContact = {
      name: 'John Doe',
      phone: '+1234567890',
      email: 'john.doe@example.com',
    };

    const testPayloads = [
      {
        action: 'welcome',
        contact: mockContact,
        audio_base64: mockAudioBase64,
        hasRecording: true,
        photoUrl: mockPhotoUrl,
        hasPhoto: true,
        timestamp: new Date().toISOString(),
        test: true,
      },
      {
        action: 'link',
        contact: mockContact,
        audio_base64: mockAudioBase64,
        hasRecording: true,
        photoUrl: mockPhotoUrl,
        hasPhoto: true,
        timestamp: new Date().toISOString(),
        test: true,
      },
      {
        action: 'follow',
        contact: mockContact,
        audio_base64: mockAudioBase64,
        hasRecording: true,
        photoUrl: mockPhotoUrl,
        hasPhoto: true,
        timestamp: new Date().toISOString(),
        test: true,
      },
    ];

    try {
      const results = await Promise.all(
        testPayloads.map(async (payload) => {
          const response = await fetch(masterFlowUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });
          return { action: payload.action, status: response.status, ok: response.ok };
        })
      );

      const successCount = results.filter(r => r.ok).length;

      Alert.alert(
        'Test Complete',
        `Sent ${successCount}/${results.length} test webhooks successfully:\n\n` +
        results.map(r => `• ${r.action}: ${r.ok ? '✅ Success' : '❌ Failed'} (${r.status})`).join('\n') +
        '\n\nCheck your N8N workflow to see the data.'
      );
    } catch (error) {
      console.error('Webhook test error:', error);
      Alert.alert('Error', `Failed to send test webhooks: ${error.message}`);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      {/* API Environment Debug Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🔧 API Configuration</Text>
        </View>
        <View style={styles.debugCard}>
          <Text style={styles.debugLabel}>Environment:</Text>
          <Text style={styles.debugValue}>{API.ENV_NAME}</Text>

          <Text style={styles.debugLabel}>API URL:</Text>
          <Text style={styles.debugValue}>{API.API_URL}</Text>

          <Text style={styles.debugLabel}>Build Type:</Text>
          <Text style={styles.debugValue}>
            {Constants.appOwnership === 'standalone' ? 'Standalone (TestFlight/App Store)' :
             Constants.appOwnership === 'expo' ? 'Expo Go (Development)' :
             Constants.appOwnership || 'Unknown'}
          </Text>

          <Text style={styles.debugLabel}>Constants.appOwnership:</Text>
          <Text style={styles.debugValue}>{Constants.appOwnership || 'null/undefined'}</Text>

          <Text style={styles.debugLabel}>__DEV__ flag:</Text>
          <Text style={styles.debugValue}>{__DEV__ ? 'true' : 'false'}</Text>
        </View>
      </View>

      {/* Account Section */}
      {userInfo && userInfo.email && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>👤 Account</Text>
          </View>
          <View style={styles.debugCard}>
            <Text style={styles.debugLabel}>Email:</Text>
            <Text style={styles.debugValue}>{userInfo.email}</Text>

            <Text style={styles.debugLabel}>User ID:</Text>
            <Text style={styles.debugValue}>{userInfo.userId}</Text>
          </View>
          <TouchableOpacity
            style={[styles.testButton, { backgroundColor: '#ef4444', marginTop: 12 }]}
            onPress={handleLogout}
          >
            <Text style={styles.testButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Contact Monitoring Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>📱 Contact Monitoring</Text>
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Auto-Detect New Contacts</Text>
            <Text style={styles.settingDescription}>
              Get notified when you add a new contact to your phone
            </Text>
          </View>
          <Switch
            value={monitoringEnabled}
            onValueChange={toggleMonitoring}
            trackColor={{ false: '#334155', true: '#6366f1' }}
            thumbColor={monitoringEnabled ? '#fff' : '#94a3b8'}
          />
        </View>

        {!hasPermissions && (
          <View style={styles.permissionWarning}>
            <Text style={styles.warningText}>
              ⚠️ Contact permission is required for automatic monitoring
            </Text>
            <TouchableOpacity
              style={styles.permissionButton}
              onPress={() => Linking.openSettings()}
            >
              <Text style={styles.permissionButtonText}>Grant Permission</Text>
            </TouchableOpacity>
          </View>
        )}

        {monitoringEnabled && (
          <View style={styles.statusCard}>
            <Text style={styles.statusText}>
              ✅ Monitoring Active{'\n'}
              You'll receive a notification within 60 seconds when you add a new contact.
            </Text>
          </View>
        )}
      </View>

      {/* N8N Master Flow Webhook */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🔗 N8N Master Flow</Text>
        </View>

        <View style={styles.webhookCard}>
          <Text style={styles.webhookLabel}>Master Webhook URL</Text>
          <TextInput
            style={styles.webhookInput}
            value={masterFlowUrl}
            onChangeText={saveMasterFlowUrl}
            placeholder="https://your-n8n-instance.com/webhook/..."
            placeholderTextColor="#64748b"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.webhookHint}>
            All actions (welcome, link, follow) will be sent to this single URL with action tags
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.testButton, !masterFlowUrl && styles.testButtonDisabled]}
          onPress={testMasterWebhook}
          disabled={!masterFlowUrl}
        >
          <Text style={styles.testButtonText}>
            🧪 Test Webhook (Send 3 Mock Payloads)
          </Text>
        </TouchableOpacity>

        {masterFlowUrl && (
          <View style={styles.infoCard}>
            <Text style={styles.stepText}>
              <Text style={styles.stepNumber}>•</Text> Test sends 3 payloads with tags: "welcome", "link", "follow"
            </Text>
            <Text style={styles.stepText}>
              <Text style={styles.stepNumber}>•</Text> Includes mock contact, audio (base64), and photo URL
            </Text>
            <Text style={styles.stepText}>
              <Text style={styles.stepNumber}>•</Text> Check your N8N workflow to verify data routing
            </Text>
          </View>
        )}
      </View>

      {/* Cloudinary Configuration Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>📸 Image Upload Configuration</Text>
        </View>

        <View style={styles.webhookCard}>
          <Text style={styles.webhookLabel}>Cloudinary Cloud Name</Text>
          <TextInput
            style={styles.webhookInput}
            value={cloudinaryCloudName}
            onChangeText={saveCloudinaryCloudName}
            placeholder="dxxxxxx"
            placeholderTextColor="#64748b"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.webhookHint}>
            Found in your Cloudinary Dashboard (cloudinary.com)
          </Text>
        </View>

        <View style={styles.webhookCard}>
          <Text style={styles.webhookLabel}>Cloudinary Upload Preset</Text>
          <TextInput
            style={styles.webhookInput}
            value={cloudinaryUploadPreset}
            onChangeText={saveCloudinaryUploadPreset}
            placeholder="your_unsigned_preset"
            placeholderTextColor="#64748b"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.webhookHint}>
            Create an unsigned upload preset in Cloudinary Settings → Upload
          </Text>
        </View>
      </View>

      {/* How It Works */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>💡 How It Works</Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.stepText}>
            <Text style={styles.stepNumber}>1.</Text> Add a contact to your phone after meeting someone
          </Text>
          <Text style={styles.stepText}>
            <Text style={styles.stepNumber}>2.</Text> Within 60 seconds, you'll get a notification
          </Text>
          <Text style={styles.stepText}>
            <Text style={styles.stepNumber}>3.</Text> Tap to record voice context about your meeting
          </Text>
          <Text style={styles.stepText}>
            <Text style={styles.stepNumber}>4.</Text> AI automatically analyzes and organizes the context
          </Text>
        </View>
      </View>

      {/* Testing Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🧪 Testing</Text>
        </View>

        <TouchableOpacity
          style={styles.testButton}
          onPress={testNotification}
        >
          <Text style={styles.testButtonText}>Send Test Notification</Text>
        </TouchableOpacity>
      </View>

      {/* About */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>ℹ️ About</Text>
        </View>

        <View style={styles.aboutCard}>
          <Text style={styles.aboutText}>
            Context CRM monitors your phone's contact list and prompts you to capture context immediately after adding someone new.
            {'\n\n'}
            This ensures you never forget important details about your networking connections.
            {'\n\n'}
            <Text style={styles.privacyNote}>
              Privacy: Your data stays on your device and is only sent to the server when you explicitly save a contact.
            </Text>
          </Text>
        </View>
      </View>
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
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f1f5f9',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f1f5f9',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 12,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f1f5f9',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 20,
  },
  permissionWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  warningText: {
    color: '#f59e0b',
    fontSize: 14,
    marginBottom: 12,
  },
  permissionButton: {
    backgroundColor: '#f59e0b',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  permissionButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  statusCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  statusText: {
    color: '#10b981',
    fontSize: 14,
    lineHeight: 20,
  },
  infoCard: {
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 12,
  },
  stepText: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 12,
    lineHeight: 20,
  },
  stepNumber: {
    fontWeight: 'bold',
    color: '#6366f1',
    fontSize: 16,
  },
  testButton: {
    backgroundColor: '#6366f1',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  testButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  aboutCard: {
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 12,
  },
  aboutText: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 22,
  },
  privacyNote: {
    fontStyle: 'italic',
    color: '#6366f1',
  },
  webhookCard: {
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  webhookLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f1f5f9',
    marginBottom: 8,
  },
  webhookInput: {
    backgroundColor: '#334155',
    color: '#f1f5f9',
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
    marginBottom: 8,
  },
  webhookHint: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  testButtonDisabled: {
    backgroundColor: '#334155',
    opacity: 0.5,
  },
  debugCard: {
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  debugLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    marginTop: 8,
    textTransform: 'uppercase',
  },
  debugValue: {
    fontSize: 14,
    color: '#10b981',
    marginTop: 4,
    fontFamily: 'monospace',
  },
});

export default SettingsScreen;
