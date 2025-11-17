import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { Platform } from 'react-native';
import ContactMonitorService from './ContactMonitorService';

const BACKGROUND_FETCH_TASK = 'contact-monitor-background';

TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    console.log('[Background] Checking contacts...');
    await ContactMonitorService.checkForNewContacts();
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('[Background] Error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

class BackgroundTaskService {
  constructor() {
    this.isSupported = true;
  }

  async register() {
    try {
      // Check if background fetch is available
      const status = await BackgroundFetch.getStatusAsync();
      
      if (status === BackgroundFetch.BackgroundFetchStatus.Available) {
        await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
          minimumInterval: 60 * 15, // 15 minutes
          stopOnTerminate: false,
          startOnBoot: true,
        });
        console.log('[Background] ✅ Registered successfully');
        this.isSupported = true;
        return true;
      } else {
        console.log('[Background] ⚠️ Not available in this environment (Expo Go)');
        console.log('[Background] 💡 Foreground monitoring will still work!');
        this.isSupported = false;
        return false;
      }
    } catch (error) {
      console.log('[Background] ⚠️ Registration skipped:', error.message);
      console.log('[Background] 💡 This is normal in Expo Go - foreground monitoring works!');
      this.isSupported = false;
      return false;
    }
  }

  async unregister() {
    try {
      if (this.isSupported) {
        await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
        console.log('[Background] Unregistered');
      }
    } catch (error) {
      console.log('[Background] Unregister skipped:', error.message);
    }
  }

  async getStatus() {
    try {
      const status = await BackgroundFetch.getStatusAsync();
      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
      return {
        status,
        isRegistered,
        isSupported: this.isSupported
      };
    } catch (error) {
      return {
        status: null,
        isRegistered: false,
        isSupported: false
      };
    }
  }
}

export default new BackgroundTaskService();
