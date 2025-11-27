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
  const [userInfo, setUserInfo] = useState(null);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [linkMessage, setLinkMessage] = useState('');
  const [smsDeliveryMethod, setSmsDeliveryMethod] = useState('native'); // 'native' or 'n8n'

  useEffect(() => {
    checkPermissions();
    loadSettings();
    loadUserInfo();
    loadMonitoringState();
  }, []);

  // Debug: Monitor masterFlowUrl state changes
  useEffect(() => {
    console.log('🔍 masterFlowUrl state changed to:', masterFlowUrl);
    console.log('   Length:', masterFlowUrl?.length || 0);
    console.log('   Is shortened URL?', masterFlowUrl?.includes('gourl.es') || false);
  }, [masterFlowUrl]);

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
      const savedWelcome = await AsyncStorage.getItem('@sms:welcome_message');
      const savedLink = await AsyncStorage.getItem('@sms:link_message');
      const savedDeliveryMethod = await AsyncStorage.getItem('@sms:delivery_method');

      console.log('📥 Loading settings from AsyncStorage');
      if (savedUrl) setMasterFlowUrl(savedUrl);
      if (savedWelcome) setWelcomeMessage(savedWelcome);
      if (savedLink) setLinkMessage(savedLink);
      if (savedDeliveryMethod) setSmsDeliveryMethod(savedDeliveryMethod);

      // Set defaults if not configured
      if (!savedWelcome) {
        const defaultWelcome = "Hi {name}!  It was so great to meet you. Looking forward to staying in touch! Here's my booking link: [insert your booking link] \noh... BTW here's the picture I took from us 😎 {photo}";
        setWelcomeMessage(defaultWelcome);
      }
      if (!savedLink) {
        const defaultLink = "Hi {name}!  It was so great to meet you. Looking forward to staying in touch! Here's my booking link: [insert your booking link] \noh... BTW here's the picture I took from us 😎 {photo}";
        setLinkMessage(defaultLink);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveMessageTemplate = async (type, value) => {
    try {
      const key = type === 'welcome' ? '@sms:welcome_message' : '@sms:link_message';
      await AsyncStorage.setItem(key, value);
      console.log(`✅ ${type} message template saved`);
    } catch (error) {
      console.error(`Error saving ${type} message template:`, error);
    }
  };

  const saveSmsDeliveryMethod = async (method) => {
    try {
      await AsyncStorage.setItem('@sms:delivery_method', method);
      setSmsDeliveryMethod(method);
      console.log(`✅ SMS delivery method set to: ${method}`);
    } catch (error) {
      console.error('Error saving SMS delivery method:', error);
    }
  };

  const loadMonitoringState = async () => {
    try {
      const enabled = await ContactMonitorService.getMonitoringState();
      console.log('📱 Loading monitoring state:', enabled);
      setMonitoringEnabled(enabled);
    } catch (error) {
      console.error('Error loading monitoring state:', error);
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
    console.log('📝 Saving N8N URL:', value);
    setMasterFlowUrl(value);
    try {
      await AsyncStorage.setItem('@webhook:master_flow', value);
      console.log('✅ N8N URL saved successfully');
    } catch (error) {
      console.error('Error saving master flow URL:', error);
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
      console.log('✅ Monitoring enabled by user');
    } else {
      await ContactMonitorService.stopMonitoring();
      await BackgroundTaskService.unregister();
      console.log('⏸️ Monitoring disabled by user');
    }

    setMonitoringEnabled(value);
  };

  const testMasterWebhook = async () => {
    if (!masterFlowUrl) {
      Alert.alert('Error', 'Please enter the N8N Master Flow URL first');
      return;
    }

    Alert.alert('Testing Webhooks', 'Sending 3 test payloads with different action tags...');

    // Mock base64 audio (very short sample)
    const mockAudioBase64 = 'data:audio/mp4;base64,AAAAGGZ0eXBNNEEgAAAAAE00QSBpc29tAAAA';

    // Mock photo URL (using backend storage)
    const mockPhotoUrl = `${API.API_URL}/uploads/photos/sample-photo.jpg`;

    // Mock contact data
    const mockContact = {
      name: 'John Doe',
      phone: '+14255432406',
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

      {/* SMS Delivery Method */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>📱 SMS Delivery Method</Text>
        </View>

        <View style={styles.webhookCard}>
          <Text style={styles.settingDescription} style={{marginBottom: 16, color: '#94a3b8'}}>
            Choose how you want to send SMS messages to contacts
          </Text>

          {/* Native SMS Option */}
          <TouchableOpacity
            style={[
              styles.radioOption,
              smsDeliveryMethod === 'native' && styles.radioOptionSelected
            ]}
            onPress={() => saveSmsDeliveryMethod('native')}
          >
            <View style={styles.radioButton}>
              {smsDeliveryMethod === 'native' && <View style={styles.radioButtonInner} />}
            </View>
            <View style={styles.radioContent}>
              <Text style={styles.radioLabel}>📱 Native SMS (Recommended)</Text>
              <Text style={styles.radioDescription}>
                Opens your phone's SMS app with pre-filled message. Messages sent from your personal number. Free.
              </Text>
            </View>
          </TouchableOpacity>

          {/* N8N Webhook Option */}
          <TouchableOpacity
            style={[
              styles.radioOption,
              smsDeliveryMethod === 'n8n' && styles.radioOptionSelected
            ]}
            onPress={() => saveSmsDeliveryMethod('n8n')}
          >
            <View style={styles.radioButton}>
              {smsDeliveryMethod === 'n8n' && <View style={styles.radioButtonInner} />}
            </View>
            <View style={styles.radioContent}>
              <Text style={styles.radioLabel}>🔗 N8N Webhook (Advanced)</Text>
              <Text style={styles.radioDescription}>
                Sends data to your N8N workflow for custom SMS delivery. Requires N8N Master Flow URL configuration.
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* SMS Message Templates */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>💬 SMS Message Templates</Text>
        </View>

        <View style={styles.webhookCard}>
          <Text style={styles.settingDescription} style={{marginBottom: 16, color: '#94a3b8'}}>
            Customize your SMS messages. Use {'{name}'} for contact name and {'{photo}'} for photo link.
          </Text>

          {/* Welcome Message Template */}
          <View style={{marginBottom: 20}}>
            <Text style={styles.webhookLabel}>Welcome Message</Text>
            <TextInput
              style={[styles.webhookInput, {height: 120}]}
              value={welcomeMessage}
              onChangeText={(text) => {
                setWelcomeMessage(text);
                saveMessageTemplate('welcome', text);
              }}
              placeholder="Hi {name}! Great meeting you..."
              placeholderTextColor="#64748b"
              multiline
              numberOfLines={5}
            />
            <Text style={styles.webhookHint}>
              Opens your SMS app with this pre-filled message
            </Text>
          </View>

          {/* Link Message Template */}
          <View>
            <Text style={styles.webhookLabel}>Link/Invitation Message</Text>
            <TextInput
              style={[styles.webhookInput, {height: 120}]}
              value={linkMessage}
              onChangeText={(text) => {
                setLinkMessage(text);
                saveMessageTemplate('link', text);
              }}
              placeholder="Hi {name}! Here's my contact info..."
              placeholderTextColor="#64748b"
              multiline
              numberOfLines={5}
            />
            <Text style={styles.webhookHint}>
              Opens your SMS app with this pre-filled message
            </Text>
          </View>
        </View>
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
            onChangeText={(text) => {
              console.log('⌨️ TextInput onChangeText received:', text);
              console.log('   Length:', text.length);
              console.log('   First 50 chars:', text.substring(0, 50));
              saveMasterFlowUrl(text);
            }}
            placeholder="https://your-n8n-instance.com/webhook/..."
            placeholderTextColor="#64748b"
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            textContentType="URL"
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
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#334155',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  radioOptionSelected: {
    borderColor: '#6366f1',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#94a3b8',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#6366f1',
  },
  radioContent: {
    flex: 1,
  },
  radioLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f1f5f9',
    marginBottom: 4,
  },
  radioDescription: {
    fontSize: 14,
    color: '#94a3b8',
  },
  creditsCard: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    padding: 16,
    borderRadius: 12,
    marginTop: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  creditsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f1f5f9',
    marginBottom: 4,
  },
  creditsValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#6366f1',
  },
  creditsWarning: {
    fontSize: 12,
    color: '#f59e0b',
    marginTop: 8,
  },
});

export default SettingsScreen;
