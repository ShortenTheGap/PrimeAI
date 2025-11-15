import AsyncStorage from '@react-native-async-storage/async-storage';
import Contacts from 'react-native-contacts';
import PushNotification from 'react-native-push-notification';
import { PermissionsAndroid, Platform } from 'react-native';

const STORAGE_KEY = '@context_crm:known_contacts';

class ContactMonitorService {
  constructor() {
    this.isMonitoring = false;
    this.knownContactIds = new Set();
    this.checkInterval = null;
    this.isInitializing = false; // Flag to prevent notifications during initial load
  }

  // Initialize the service
  async initialize() {
    try {
      // Set flag to prevent notifications during initial load
      this.isInitializing = true;

      // Request permissions
      await this.requestPermissions();

      // Load known contacts from storage
      await this.loadKnownContacts();

      // Configure push notifications
      this.configurePushNotifications();

      // Start monitoring
      await this.startMonitoring();

      // Clear initializing flag after first check cycle
      // This allows the first interval check to complete silently
      setTimeout(() => {
        this.isInitializing = false;
        console.log('✅ Initialization complete - now monitoring for new contacts');
      }, 6000); // Wait for first check cycle (5 sec interval + buffer)

      console.log('📱 Contact monitoring service initialized');
    } catch (error) {
      console.error('Failed to initialize contact monitor:', error);
      this.isInitializing = false; // Clear flag on error
    }
  }

  // Request necessary permissions
  async requestPermissions() {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
        {
          title: 'Contacts Permission',
          message: 'Context CRM needs access to your contacts to capture networking context.',
          buttonPositive: 'OK',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }

    // iOS
    const permission = await Contacts.requestPermission();
    return permission === 'authorized';
  }

  // Configure push notifications
  configurePushNotifications() {
    PushNotification.configure({
      onNotification: function (notification) {
        console.log('Notification:', notification);

        // Handle notification tap - navigate to context capture
        if (notification.userInteraction) {
          const contactData = JSON.parse(notification.data.contactData || '{}');
          // This will be handled by the navigation system
          global.navigateToContextCapture?.(contactData);
        }
      },
      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },
      popInitialNotification: true,
      requestPermissions: true,
    });

    // Create notification channel for Android
    if (Platform.OS === 'android') {
      PushNotification.createChannel(
        {
          channelId: 'context-capture',
          channelName: 'Context Capture',
          channelDescription: 'Notifications for capturing contact context',
          importance: 4,
          vibrate: true,
        },
        (created) => console.log(`Channel created: ${created}`)
      );
    }
  }

  // Load known contacts from storage
  async loadKnownContacts() {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.knownContactIds = new Set(JSON.parse(stored));
        console.log(`📂 Loaded ${this.knownContactIds.size} known contacts from storage`);
      } else {
        // First time - start fresh, only track NEW contacts from now on
        console.log('📂 Starting fresh - will only track contacts added from now on');
        this.knownContactIds = new Set();
      }
    } catch (error) {
      console.error('Failed to load known contacts:', error);
    }
  }

  // Save known contacts to storage
  async saveKnownContacts() {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([...this.knownContactIds])
      );
    } catch (error) {
      console.error('Failed to save known contacts:', error);
    }
  }

  // Start monitoring for new contacts
  async startMonitoring() {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;

    // Check every 5 seconds for new contacts
    // In production, this would be optimized with background tasks
    this.checkInterval = setInterval(async () => {
      await this.checkForNewContacts();
    }, 5000);

    console.log('Contact monitoring started');
  }

  // Stop monitoring
  stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isMonitoring = false;
    console.log('Contact monitoring stopped');
  }

  // Check for new contacts
  async checkForNewContacts() {
    try {
      const allContacts = await Contacts.getAll();
      const newContacts = [];

      for (const contact of allContacts) {
        if (!this.knownContactIds.has(contact.recordID)) {
          newContacts.push(contact);
          this.knownContactIds.add(contact.recordID);
        }
      }

      if (newContacts.length > 0) {
        console.log(`Found ${newContacts.length} new contact(s)`);

        // Save updated known contacts
        await this.saveKnownContacts();

        // Only trigger notifications if NOT initializing
        if (!this.isInitializing) {
          // Trigger notification for each new contact
          for (const contact of newContacts) {
            this.triggerContextCaptureNotification(contact);
          }
        } else {
          console.log('📂 Skipping notifications during initial load (found during initialization)');
        }
      }
    } catch (error) {
      console.error('Error checking for new contacts:', error);
    }
  }

  // Trigger notification to capture context for new contact
  triggerContextCaptureNotification(contact) {
    const displayName = contact.displayName ||
                       contact.givenName ||
                       contact.familyName ||
                       'Unknown';

    const phoneNumber = contact.phoneNumbers?.[0]?.number || '';
    const email = contact.emailAddresses?.[0]?.email || '';

    const contactData = {
      recordID: contact.recordID,
      name: displayName,
      phone: phoneNumber,
      email: email,
    };

    // Show local notification
    PushNotification.localNotification({
      channelId: 'context-capture',
      title: '🎙️ Add Context?',
      message: `You just added ${displayName}. Capture context while it's fresh!`,
      playSound: true,
      soundName: 'default',
      importance: 'high',
      priority: 'high',
      vibrate: true,
      vibration: 300,
      data: {
        contactData: JSON.stringify(contactData),
        action: 'capture_context',
      },
      userInfo: {
        contactData: contactData,
      },
      actions: ['Capture Now', 'Later'],
      invokeApp: true,
    });

    console.log(`Notification sent for: ${displayName}`);
  }

  // Manual trigger for testing
  async testNotification() {
    const testContact = {
      recordID: 'test-123',
      displayName: 'Test Contact',
      phoneNumbers: [{ number: '+1234567890' }],
      emailAddresses: [{ email: 'test@example.com' }],
    };
    this.triggerContextCaptureNotification(testContact);
  }
}

// Export singleton instance
export default new ContactMonitorService();
