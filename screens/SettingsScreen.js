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
import { Feather } from '@expo/vector-icons';
import ContactMonitorService from '../services/ContactMonitorService';
import BackgroundTaskService from '../services/BackgroundTaskService';
import userService from '../services/UserService';
import API from '../config/api';

const SettingsScreen = () => {
  const [monitoringEnabled, setMonitoringEnabled] = useState(false);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [masterFlowUrl, setMasterFlowUrl] = useState('');
  const [userInfo, setUserInfo] = useState(null);
  const [smsDeliveryMethod, setSmsDeliveryMethod] = useState('native');

  useEffect(() => {
    checkPermissions();
    loadSettings();
    loadUserInfo();
    loadMonitoringState();
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
      const savedDeliveryMethod = await AsyncStorage.getItem('@sms:delivery_method');

      if (savedUrl) setMasterFlowUrl(savedUrl);
      if (savedDeliveryMethod) setSmsDeliveryMethod(savedDeliveryMethod);
    } catch (error) {
      console.error('Error loading settings:', error);
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
    setMasterFlowUrl(value);
    try {
      await AsyncStorage.setItem('@webhook:master_flow', value);
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
    } else {
      await ContactMonitorService.stopMonitoring();
      await BackgroundTaskService.unregister();
    }

    setMonitoringEnabled(value);
  };

  const testMasterWebhook = async () => {
    if (!masterFlowUrl) {
      Alert.alert('Error', 'Please enter the N8N Master Flow URL first');
      return;
    }

    Alert.alert('Testing Webhooks', 'Sending 3 test payloads with different action tags...');

    const mockAudioBase64 = 'data:audio/mp4;base64,AAAAGGZ0eXBNNEEgAAAAAE00QSBpc29tAAAA';
    const mockPhotoUrl = `${API.API_URL}/uploads/photos/sample-photo.jpg`;
    const mockContact = {
      name: 'John Doe',
      phone: '+14255432406',
      email: 'john.doe@example.com',
    };

    const testPayloads = [
      { action: 'welcome', contact: mockContact, audio_base64: mockAudioBase64, hasRecording: true, photoUrl: mockPhotoUrl, hasPhoto: true, timestamp: new Date().toISOString(), test: true },
      { action: 'link', contact: mockContact, audio_base64: mockAudioBase64, hasRecording: true, photoUrl: mockPhotoUrl, hasPhoto: true, timestamp: new Date().toISOString(), test: true },
      { action: 'follow', contact: mockContact, audio_base64: mockAudioBase64, hasRecording: true, photoUrl: mockPhotoUrl, hasPhoto: true, timestamp: new Date().toISOString(), test: true },
    ];

    try {
      const results = await Promise.all(
        testPayloads.map(async (payload) => {
          const response = await fetch(masterFlowUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
      Alert.alert('Error', `Failed to send test webhooks: ${error.message}`);
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      {/* Account Section */}
      {userInfo && userInfo.email && (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Feather name="user" size={20} color="#94a3b8" />
            <Text style={styles.sectionTitle}>Account</Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>EMAIL:</Text>
            <Text style={styles.infoValue}>{userInfo.email}</Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>USER ID:</Text>
            <Text style={styles.infoValue}>{userInfo.userId}</Text>
          </View>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Feather name="log-out" size={20} color="#ef4444" />
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Contact Monitoring Section */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Feather name="grid" size={20} color="#94a3b8" />
          <Text style={styles.sectionTitle}>Contact Monitoring</Text>
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
            <Feather name="check-circle" size={18} color="#10b981" />
            <View style={styles.statusTextContainer}>
              <Text style={styles.statusTitle}>Monitoring Active</Text>
              <Text style={styles.statusDescription}>
                You'll receive a notification within 60 seconds when you add a new contact.
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* SMS Delivery Method Section */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Feather name="grid" size={20} color="#94a3b8" />
          <Text style={styles.sectionTitle}>SMS Delivery Method</Text>
        </View>

        <Text style={styles.sectionDescription}>
          Choose how you want to send SMS messages to your contacts
        </Text>

        {/* Native SMS Option */}
        <TouchableOpacity
          style={[
            styles.radioOption,
            smsDeliveryMethod === 'native' && styles.radioOptionSelected
          ]}
          onPress={() => saveSmsDeliveryMethod('native')}
        >
          <View style={[styles.radioButton, smsDeliveryMethod === 'native' && styles.radioButtonSelected]}>
            {smsDeliveryMethod === 'native' && <View style={styles.radioButtonInner} />}
          </View>
          <View style={styles.radioContent}>
            <View style={styles.radioLabelRow}>
              <Feather name="grid" size={16} color="#f1f5f9" />
              <Text style={styles.radioLabel}>Native SMS (Recommended)</Text>
            </View>
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
          <View style={[styles.radioButton, smsDeliveryMethod === 'n8n' && styles.radioButtonSelected]}>
            {smsDeliveryMethod === 'n8n' && <View style={styles.radioButtonInner} />}
          </View>
          <View style={styles.radioContent}>
            <View style={styles.radioLabelRow}>
              <Feather name="link" size={16} color="#f1f5f9" />
              <Text style={styles.radioLabel}>N8N Webhook (Advanced)</Text>
            </View>
            <Text style={styles.radioDescription}>
              Sends data to your N8N workflow for custom SMS delivery. Requires N8N Master Flow URL configuration.
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Master Webhook URL Section */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Feather name="link" size={20} color="#94a3b8" />
          <Text style={styles.sectionTitle}>Master Webhook URL</Text>
        </View>

        <TextInput
          style={styles.webhookInput}
          value={masterFlowUrl}
          onChangeText={saveMasterFlowUrl}
          placeholder="https://your-n8n-instance.com/webhook/..."
          placeholderTextColor="#64748b"
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
        />
        <Text style={styles.webhookHint}>
          All actions (welcome, link, follow) will be sent to this single URL with action tags
        </Text>

        <TouchableOpacity
          style={[styles.testButton, !masterFlowUrl && styles.testButtonDisabled]}
          onPress={testMasterWebhook}
          disabled={!masterFlowUrl}
        >
          <Text style={styles.testButtonText}>🧪 Test Webhook (Send 3 Mock Payloads)</Text>
        </TouchableOpacity>

        {masterFlowUrl && (
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>
              • Test sends 3 payloads with tags: "welcome", "link", "follow"
            </Text>
            <Text style={styles.bulletItem}>
              • Includes mock contact, audio (base64), and photo URL
            </Text>
            <Text style={styles.bulletItem}>
              • Check your N8N workflow to verify data routing
            </Text>
          </View>
        )}
      </View>

      {/* About Section */}
      <View style={[styles.sectionCard, { marginBottom: 40 }]}>
        <View style={styles.sectionHeader}>
          <Feather name="info" size={20} color="#94a3b8" />
          <Text style={styles.sectionTitle}>About</Text>
        </View>

        <Text style={styles.aboutText}>
          Context CRM monitors your phone's contact list and prompts you to capture context immediately after adding someone new.
        </Text>
        <Text style={styles.aboutText}>
          This ensures you never forget important details about your networking connections.
        </Text>
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
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#10b981',
  },
  sectionCard: {
    backgroundColor: '#1e293b',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f1f5f9',
    marginLeft: 10,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 16,
  },
  infoCard: {
    backgroundColor: '#334155',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: '#10b981',
    fontWeight: '500',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#ef4444',
    padding: 16,
    borderRadius: 12,
    marginTop: 4,
  },
  logoutButtonText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#334155',
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  statusTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
    marginBottom: 4,
  },
  statusDescription: {
    fontSize: 14,
    color: '#10b981',
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
    borderColor: '#64748b',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioButtonSelected: {
    borderColor: '#10b981',
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10b981',
  },
  radioContent: {
    flex: 1,
  },
  radioLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  radioLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f1f5f9',
    marginLeft: 8,
  },
  radioDescription: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 20,
  },
  webhookInput: {
    backgroundColor: '#334155',
    color: '#f1f5f9',
    padding: 16,
    borderRadius: 12,
    fontSize: 14,
    marginBottom: 8,
  },
  webhookHint: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
    marginBottom: 16,
  },
  testButton: {
    backgroundColor: '#6366f1',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  testButtonDisabled: {
    backgroundColor: '#334155',
    opacity: 0.5,
  },
  testButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  bulletList: {
    marginTop: 16,
    backgroundColor: '#334155',
    padding: 16,
    borderRadius: 12,
  },
  bulletItem: {
    fontSize: 14,
    color: '#6366f1',
    marginBottom: 8,
    lineHeight: 20,
  },
  aboutText: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 22,
    marginBottom: 12,
  },
});

export default SettingsScreen;
