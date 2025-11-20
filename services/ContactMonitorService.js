import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Contacts from 'expo-contacts';
import * as Notifications from 'expo-notifications';
import { AppState } from 'react-native';

const STORAGE_KEY = '@context_crm:known_contacts';

class ContactMonitorService {
  constructor() {
    this.isMonitoring = false;
    this.knownContactIds = new Set();
    this.checkInterval = null;
    this.isInitializing = false;
    this.appStateSubscription = null;
    this.currentAppState = 'active';
    this.navigationCallback = null;
  }

  async initialize() {
    try {
      this.isInitializing = true;
      await this.requestPermissions();
      await this.loadKnownContacts();
      this.configurePushNotifications();
      await this.startMonitoring();

      setTimeout(() => {
        this.isInitializing = false;
        console.log('✅ Initialization complete - now monitoring for new contacts');
      }, 6000);

      console.log('📱 Contact monitoring service initialized');
    } catch (error) {
      console.error('Failed to initialize contact monitor:', error);
      this.isInitializing = false;
    }
  }

  async requestPermissions() {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') {
      console.warn('Contacts permission not granted');
      return false;
    }

    const notificationStatus = await Notifications.requestPermissionsAsync();
    if (notificationStatus.status !== 'granted') {
      console.warn('Notification permission not granted');
      return false;
    }

    return true;
  }

  configurePushNotifications() {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  }

  async loadKnownContacts() {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.knownContactIds = new Set(JSON.parse(stored));
        console.log(`📂 Loaded ${this.knownContactIds.size} known contacts from storage`);
      } else {
        console.log('📂 Starting fresh - will only track contacts added from now on');
        this.knownContactIds = new Set();
      }
    } catch (error) {
      console.error('Failed to load known contacts:', error);
    }
  }

  async saveKnownContacts() {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...this.knownContactIds]));
    } catch (error) {
      console.error('Failed to save known contacts:', error);
    }
  }

  async startMonitoring() {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;

    // Start interval checking (every 5 seconds when app is active)
    this.checkInterval = setInterval(async () => {
      await this.checkForNewContacts();
    }, 5000);

    // Listen for app state changes (background <-> foreground)
    this.appStateSubscription = AppState.addEventListener('change', async (nextAppState) => {
      this.currentAppState = nextAppState;
      if (nextAppState === 'active') {
        console.log('📱 App returned to foreground - checking for new contacts...');
        await this.checkForNewContacts();
      } else if (nextAppState === 'background') {
        console.log('📱 App moved to background');
      }
    });

    console.log('✅ Contact monitoring started (foreground + app state listener)');
  }

  stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    this.isMonitoring = false;
    console.log('Contact monitoring stopped');
  }

  async checkForNewContacts() {
    try {
      console.log('🔍 Checking for new contacts... (isMonitoring:', this.isMonitoring, 'isInitializing:', this.isInitializing, ')');

      const { data: allContacts } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
      });

      console.log(`📊 Total contacts on device: ${allContacts.length}, Known contacts: ${this.knownContactIds.size}`);

      const newContacts = [];

      for (const contact of allContacts) {
        if (!this.knownContactIds.has(contact.id)) {
          newContacts.push(contact);
          this.knownContactIds.add(contact.id);
        }
      }

      if (newContacts.length > 0) {
        console.log(`✨ Found ${newContacts.length} new contact(s):`, newContacts.map(c => c.name || c.firstName || 'Unknown').join(', '));
        await this.saveKnownContacts();

        if (!this.isInitializing) {
          for (const contact of newContacts) {
            await this.triggerContextCaptureNotification(contact);
          }
        } else {
          console.log('📂 Skipping notifications during initial load (${newContacts.length} contacts added to known list)');
        }
      }
    } catch (error) {
      console.error('❌ Error checking for new contacts:', error);
    }
  }

  setNavigationCallback(callback) {
    this.navigationCallback = callback;
    console.log('✅ Navigation callback registered');
  }

  async triggerContextCaptureNotification(contact) {
    const displayName = contact.name || contact.firstName || contact.lastName || 'Unknown';
    const phoneNumber = contact.phoneNumbers?.[0]?.number || '';
    const email = contact.emails?.[0]?.email || '';

    const contactData = {
      id: contact.id,
      name: displayName,
      phone: phoneNumber,
      email: email,
    };

    // If app is in foreground, navigate directly instead of showing notification
    if (this.currentAppState === 'active' && this.navigationCallback) {
      console.log('🚀 App is active - auto-navigating to Contact Capture for:', displayName);
      this.navigationCallback(contactData);
      return;
    }

    // App is in background - send notification (existing behavior)
    console.log('📤 App in background - sending notification for:', displayName);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🎙️ Add Context?',
        body: `You just added ${displayName}. Capture context while it's fresh!`,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        data: {
          contactData: contactData,
          action: 'capture_context',
        },
      },
      trigger: null,
    });

    console.log(`✅ Notification sent for: ${displayName}`);
  }

  async testNotification() {
    const testContact = {
      id: 'test-123',
      name: 'Test Contact',
      phoneNumbers: [{ number: '+1234567890' }],
      emails: [{ email: 'test@example.com' }],
    };
    await this.triggerContextCaptureNotification(testContact);
  }
}

export default new ContactMonitorService();
