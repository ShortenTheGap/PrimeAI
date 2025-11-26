import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Contacts from 'expo-contacts';
import * as Notifications from 'expo-notifications';
import { AppState } from 'react-native';

const STORAGE_KEY = '@context_crm:known_contacts';
const MONITORING_STATE_KEY = '@context_crm:monitoring_enabled';

class ContactMonitorService {
  constructor() {
    this.isMonitoring = false;
    this.knownContactIds = new Set();
    this.checkInterval = null;
    this.isInitializing = false;
    this.appStateSubscription = null;
    this.currentAppState = 'active';
    this.navigationCallback = null;
    this.pendingContacts = []; // Store contacts detected in background
    this.aggressiveCheckInterval = null; // For rapid checking after foreground
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

  async saveMonitoringState(enabled) {
    try {
      await AsyncStorage.setItem(MONITORING_STATE_KEY, JSON.stringify(enabled));
      console.log(`💾 Monitoring state saved: ${enabled}`);
    } catch (error) {
      console.error('Failed to save monitoring state:', error);
    }
  }

  async getMonitoringState() {
    try {
      const stored = await AsyncStorage.getItem(MONITORING_STATE_KEY);
      if (stored !== null) {
        const enabled = JSON.parse(stored);
        console.log(`📂 Loaded monitoring state: ${enabled}`);
        return enabled;
      }
      return false; // Default to false if not set
    } catch (error) {
      console.error('Failed to load monitoring state:', error);
      return false;
    }
  }

  async startMonitoring() {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    await this.saveMonitoringState(true);

    // Start interval checking (every 5 seconds when app is active)
    this.checkInterval = setInterval(async () => {
      await this.checkForNewContacts();
    }, 5000);

    // Listen for app state changes (background <-> foreground)
    this.appStateSubscription = AppState.addEventListener('change', async (nextAppState) => {
      const previousState = this.currentAppState;
      this.currentAppState = nextAppState;

      if (nextAppState === 'active') {
        console.log('📱 App returned to foreground - starting aggressive contact checking...');

        // If there are pending contacts from background detection, navigate to them now
        if (this.pendingContacts.length > 0 && this.navigationCallback) {
          console.log(`🚀 Found ${this.pendingContacts.length} pending contact(s) - navigating now...`);
          for (const contactData of this.pendingContacts) {
            console.log('🔄 Auto-navigating to Contact Capture for:', contactData.name);
            this.navigationCallback(contactData);
            // Only navigate to the first one to avoid multiple screens
            break;
          }
          this.pendingContacts = []; // Clear pending contacts
        } else {
          // Start aggressive checking (every 1 second for 10 seconds) to catch bump contacts
          this.startAggressiveChecking();
        }
      } else if (nextAppState === 'background') {
        console.log('📱 App moved to background');
        // Stop aggressive checking if it's running
        this.stopAggressiveChecking();
      }
    });

    console.log('✅ Contact monitoring started (foreground + app state listener)');
  }

  startAggressiveChecking() {
    console.log('🔥 Starting aggressive contact checking (1s intervals for 10s)');
    let checkCount = 0;
    const maxChecks = 10;

    // Stop any existing aggressive checking
    this.stopAggressiveChecking();

    // Immediate check
    this.checkForNewContacts();

    // Then check every second for 10 seconds
    this.aggressiveCheckInterval = setInterval(async () => {
      checkCount++;
      console.log(`🔍 Aggressive check ${checkCount}/${maxChecks}`);
      await this.checkForNewContacts();

      if (checkCount >= maxChecks) {
        this.stopAggressiveChecking();
        console.log('✅ Aggressive checking complete - back to normal 5s interval');
      }
    }, 1000);
  }

  stopAggressiveChecking() {
    if (this.aggressiveCheckInterval) {
      clearInterval(this.aggressiveCheckInterval);
      this.aggressiveCheckInterval = null;
    }
  }

  async stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    if (this.aggressiveCheckInterval) {
      clearInterval(this.aggressiveCheckInterval);
      this.aggressiveCheckInterval = null;
    }

    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    this.isMonitoring = false;
    await this.saveMonitoringState(false);
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

    // If app is in foreground, navigate directly
    if (this.currentAppState === 'active' && this.navigationCallback) {
      console.log('🚀 App is active - auto-navigating to Contact Capture for:', displayName);
      this.navigationCallback(contactData);
      return;
    }

    // App is in background - send notification to remind user + store for auto-navigation
    console.log('📤 App in background - sending notification and storing contact:', displayName);
    this.pendingContacts.push(contactData);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🎙️ Add Context Now!',
        body: `You just added ${displayName}. Tap to capture context while it's fresh!`,
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
