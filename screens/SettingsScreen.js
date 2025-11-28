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

// Collapsible Card Component
const CollapsibleCard = ({ title, icon, isExpanded, onToggle, children, style }) => {
  return (
    <View style={[styles.sectionCard, style]}>
      <TouchableOpacity style={styles.collapsibleHeader} onPress={onToggle}>
        <View style={styles.sectionHeaderLeft}>
          <Feather name={icon} size={20} color="#94a3b8" />
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        <Feather
          name={isExpanded ? "chevron-down" : "chevron-right"}
          size={24}
          color="#94a3b8"
        />
      </TouchableOpacity>
      {isExpanded && (
        <View style={styles.collapsibleContent}>
          {children}
        </View>
      )}
    </View>
  );
};

const SettingsScreen = () => {
  const [monitoringEnabled, setMonitoringEnabled] = useState(false);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [masterFlowUrl, setMasterFlowUrl] = useState('');
  const [userInfo, setUserInfo] = useState(null);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [linkMessage, setLinkMessage] = useState('');
  const [smsDeliveryMethod, setSmsDeliveryMethod] = useState('native');
  const [calendarDeliveryMethod, setCalendarDeliveryMethod] = useState('native');

  // Collapsed state for each section
  const [expandedSections, setExpandedSections] = useState({
    contactMonitoring: true,
    smsDelivery: false,
    smsTemplates: false,
    calendarDelivery: false,
    webhook: false,
    account: false,
    about: false,
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

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
      const savedWelcome = await AsyncStorage.getItem('@sms:welcome_message');
      const savedLink = await AsyncStorage.getItem('@sms:link_message');
      const savedDeliveryMethod = await AsyncStorage.getItem('@sms:delivery_method');
      const savedCalendarMethod = await AsyncStorage.getItem('@calendar:delivery_method');

      if (savedUrl) setMasterFlowUrl(savedUrl);
      if (savedDeliveryMethod) setSmsDeliveryMethod(savedDeliveryMethod);
      if (savedCalendarMethod) setCalendarDeliveryMethod(savedCalendarMethod);

      const defaultWelcome = "Hi {name}!  It was so great to meet you. Looking forward to staying in touch! Here's my booking link: [insert your booking link] \noh... BTW here's the picture I took from us 😎 {photo}";
      const defaultLink = "Hi {name}! It was so great to meet you. Looking forward to staying in touch! Here's the link to [insert link to your product/service] we discussed. oh... BTW here's the picture I took from us 😎 \n{photo}";

      if (savedWelcome) {
        setWelcomeMessage(savedWelcome);
      } else {
        setWelcomeMessage(defaultWelcome);
      }

      if (savedLink) {
        setLinkMessage(savedLink);
      } else {
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
    } catch (error) {
      console.error(`Error saving ${type} message template:`, error);
    }
  };

  const saveSmsDeliveryMethod = async (method) => {
    try {
      await AsyncStorage.setItem('@sms:delivery_method', method);
      setSmsDeliveryMethod(method);
    } catch (error) {
      console.error('Error saving SMS delivery method:', error);
    }
  };

  const saveCalendarDeliveryMethod = async (method) => {
    try {
      await AsyncStorage.setItem('@calendar:delivery_method', method);
      setCalendarDeliveryMethod(method);
    } catch (error) {
      console.error('Error saving calendar delivery method:', error);
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

    Alert.alert('Testing Webhooks', 'Sending 4 test payloads with different action tags...');

    // Use a small placeholder instead of actual audio data to avoid payload size issues
    const mockAudioBase64 = '[TEST_AUDIO_PLACEHOLDER]';
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
      { action: 'update', contact: mockContact, audio_base64: mockAudioBase64, hasRecording: true, photoUrl: mockPhotoUrl, hasPhoto: true, timestamp: new Date().toISOString(), test: true },
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
        '4 Test Webhooks Sent',
        `${successCount}/${results.length} successful:\n\n` +
        results.map(r => `• ${r.action}: ${r.ok ? '✅' : '❌'}`).join('\n') +
        '\n\nCheck your workflow automation to see the data.'
      );
    } catch (error) {
      Alert.alert('Error', `Failed to send test webhooks: ${error.message}`);
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Contact Monitoring Section */}
      <CollapsibleCard
        title="Contact Monitoring"
        icon="grid"
        isExpanded={expandedSections.contactMonitoring}
        onToggle={() => toggleSection('contactMonitoring')}
      >
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
      </CollapsibleCard>

      {/* SMS Delivery Method Section */}
      <CollapsibleCard
        title="SMS Delivery Method"
        icon="message-square"
        isExpanded={expandedSections.smsDelivery}
        onToggle={() => toggleSection('smsDelivery')}
      >
        <Text style={styles.sectionDescription}>
          Choose how you want to send SMS messages to your contacts
        </Text>

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
              <Feather name="smartphone" size={16} color="#f1f5f9" />
              <Text style={styles.radioLabel}>Native SMS (Recommended)</Text>
            </View>
            <Text style={styles.radioDescription}>
              Opens your phone's SMS app with pre-filled message. Messages sent from your personal number. Free.
            </Text>
          </View>
        </TouchableOpacity>

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
              <Text style={styles.radioLabel}>Webhook (Advanced)</Text>
            </View>
            <Text style={styles.radioDescription}>
              Send data to your automation workflow for custom SMS delivery. This requires Master Webhook URL configuration.
            </Text>
          </View>
        </TouchableOpacity>
      </CollapsibleCard>

      {/* SMS Message Templates Section */}
      <CollapsibleCard
        title="SMS Message Templates"
        icon="edit-3"
        isExpanded={expandedSections.smsTemplates}
        onToggle={() => toggleSection('smsTemplates')}
      >
        <Text style={styles.sectionDescription}>
          Customize your SMS messages. Use {'{name}'} for contact name and {'{photo}'} for photo link.
        </Text>

        <View style={styles.templateSection}>
          <Text style={styles.templateLabel}>Welcome Message</Text>
          <TextInput
            style={styles.templateInput}
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
          <Text style={styles.templateHint}>
            Opens your SMS app with this pre-filled message
          </Text>
        </View>

        <View style={styles.templateSection}>
          <Text style={styles.templateLabel}>Link/Invitation Message</Text>
          <TextInput
            style={styles.templateInput}
            value={linkMessage}
            onChangeText={(text) => {
              setLinkMessage(text);
              saveMessageTemplate('link', text);
            }}
            placeholder="Hi {name}! It was so great to meet you..."
            placeholderTextColor="#64748b"
            multiline
            numberOfLines={5}
          />
          <Text style={styles.templateHint}>
            Opens your SMS app with this pre-filled message
          </Text>
        </View>
      </CollapsibleCard>

      {/* Calendar Event Delivery Method Section */}
      <CollapsibleCard
        title="Calendar Event Delivery Method"
        icon="calendar"
        isExpanded={expandedSections.calendarDelivery}
        onToggle={() => toggleSection('calendarDelivery')}
      >
        <Text style={styles.sectionDescription}>
          Choose how you want to create calendar events for contacts
        </Text>

        <TouchableOpacity
          style={[
            styles.radioOption,
            calendarDeliveryMethod === 'native' && styles.radioOptionSelected
          ]}
          onPress={() => saveCalendarDeliveryMethod('native')}
        >
          <View style={[styles.radioButton, calendarDeliveryMethod === 'native' && styles.radioButtonSelected]}>
            {calendarDeliveryMethod === 'native' && <View style={styles.radioButtonInner} />}
          </View>
          <View style={styles.radioContent}>
            <View style={styles.radioLabelRow}>
              <Feather name="smartphone" size={16} color="#f1f5f9" />
              <Text style={styles.radioLabel}>Native Calendar (Recommended)</Text>
            </View>
            <Text style={styles.radioDescription}>
              Creates events directly in your device calendar. Events saved to your personal calendar. Free.
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.radioOption,
            calendarDeliveryMethod === 'n8n' && styles.radioOptionSelected
          ]}
          onPress={() => saveCalendarDeliveryMethod('n8n')}
        >
          <View style={[styles.radioButton, calendarDeliveryMethod === 'n8n' && styles.radioButtonSelected]}>
            {calendarDeliveryMethod === 'n8n' && <View style={styles.radioButtonInner} />}
          </View>
          <View style={styles.radioContent}>
            <View style={styles.radioLabelRow}>
              <Feather name="link" size={16} color="#f1f5f9" />
              <Text style={styles.radioLabel}>Webhook (Advanced)</Text>
            </View>
            <Text style={styles.radioDescription}>
              Sends event data to your automation workflow for Calendar integration. This requires Master Webhook URL configuration.
            </Text>
          </View>
        </TouchableOpacity>
      </CollapsibleCard>

      {/* Master Webhook URL Section */}
      <CollapsibleCard
        title="Master Webhook URL"
        icon="link"
        isExpanded={expandedSections.webhook}
        onToggle={() => toggleSection('webhook')}
      >
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
          All actions (welcome, link, follow and update) will be sent to this single URL with action tags
        </Text>

        <TouchableOpacity
          style={[styles.testButton, !masterFlowUrl && styles.testButtonDisabled]}
          onPress={testMasterWebhook}
          disabled={!masterFlowUrl}
        >
          <Text style={styles.testButtonText}>Test Webhook with Mock Payload</Text>
        </TouchableOpacity>

        {masterFlowUrl && (
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>
              • Test sends payload with tags: "welcome", "link", "follow" and "update"
            </Text>
            <Text style={styles.bulletItem}>
              • Includes mock contact, audio (base64), and photo URL
            </Text>
            <Text style={styles.bulletItem}>
              • Check your workflow Webhook node to verify data routing
            </Text>
          </View>
        )}
      </CollapsibleCard>

      {/* Account Section - Moved here between Webhook and About */}
      {userInfo && userInfo.email && (
        <CollapsibleCard
          title="Account"
          icon="user"
          isExpanded={expandedSections.account}
          onToggle={() => toggleSection('account')}
        >
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
        </CollapsibleCard>
      )}

      {/* About Section */}
      <CollapsibleCard
        title="About"
        icon="info"
        isExpanded={expandedSections.about}
        onToggle={() => toggleSection('about')}
        style={{ marginBottom: 40 }}
      >
        <Text style={styles.aboutText}>
          cnnected monitors your phone's contact list and prompts you to capture context immediately after meeting someone new.
        </Text>
        <Text style={styles.aboutText}>
          This ensures you never forget important details about your networking connections.
        </Text>
      </CollapsibleCard>
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
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f1f5f9',
    marginLeft: 10,
  },
  collapsibleContent: {
    marginTop: 16,
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
  templateSection: {
    marginBottom: 20,
  },
  templateLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f1f5f9',
    marginBottom: 8,
  },
  templateInput: {
    backgroundColor: '#334155',
    color: '#f1f5f9',
    padding: 16,
    borderRadius: 12,
    fontSize: 14,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  templateHint: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
    marginTop: 8,
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
    color: '#f1f5f9',
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
