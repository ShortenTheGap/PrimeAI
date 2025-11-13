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
} from 'react-native';
import ContactMonitorService from '../services/ContactMonitorService';
import BackgroundTaskService from '../services/BackgroundTaskService';

const SettingsScreen = () => {
  const [monitoringEnabled, setMonitoringEnabled] = useState(false);
  const [hasPermissions, setHasPermissions] = useState(false);

  useEffect(() => {
    checkPermissions();
  }, []);

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
      await BackgroundTaskService.configure();
      await BackgroundTaskService.start();
    } else {
      ContactMonitorService.stopMonitoring();
      await BackgroundTaskService.stop();
    }

    setMonitoringEnabled(value);
  };

  const testNotification = () => {
    ContactMonitorService.testNotification();
    Alert.alert('Test Notification', 'A test notification has been sent!');
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

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
});

export default SettingsScreen;
