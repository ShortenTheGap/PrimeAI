import BackgroundFetch from 'react-native-background-fetch';
import ContactMonitorService from './ContactMonitorService';

class BackgroundTaskService {
  async configure() {
    try {
      const status = await BackgroundFetch.configure(
        {
          minimumFetchInterval: 15, // Check every 15 minutes (minimum allowed)
          stopOnTerminate: false,
          enableHeadless: true,
          startOnBoot: true,
          requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY,
          requiresCharging: false,
          requiresDeviceIdle: false,
          requiresBatteryNotLow: false,
          requiresStorageNotLow: false,
        },
        async (taskId) => {
          console.log('[BackgroundFetch] Task started:', taskId);

          try {
            // Check for new contacts in background
            await ContactMonitorService.checkForNewContacts();
          } catch (error) {
            console.error('[BackgroundFetch] Error:', error);
          }

          // Required: Signal completion of the background task
          BackgroundFetch.finish(taskId);
        },
        (taskId) => {
          console.log('[BackgroundFetch] Task timeout:', taskId);
          BackgroundFetch.finish(taskId);
        }
      );

      console.log('[BackgroundFetch] Status:', status);
    } catch (error) {
      console.error('[BackgroundFetch] Configuration error:', error);
    }
  }

  // Schedule immediate check
  async scheduleImmediateCheck() {
    await BackgroundFetch.scheduleTask({
      taskId: 'com.contextcrm.contactcheck',
      delay: 1000, // 1 second
      periodic: false,
      forceAlarmManager: true,
    });
  }

  // Start background monitoring
  async start() {
    await BackgroundFetch.start();
    console.log('[BackgroundFetch] Started');
  }

  // Stop background monitoring
  async stop() {
    await BackgroundFetch.stop();
    console.log('[BackgroundFetch] Stopped');
  }
}

// Headless task (Android only) - runs even when app is terminated
export const HeadlessTask = async (event) => {
  const taskId = event.taskId;
  const isTimeout = event.timeout;

  if (isTimeout) {
    console.log('[HeadlessTask] Timeout:', taskId);
    BackgroundFetch.finish(taskId);
    return;
  }

  console.log('[HeadlessTask] Started:', taskId);

  try {
    // Check for new contacts
    await ContactMonitorService.checkForNewContacts();
  } catch (error) {
    console.error('[HeadlessTask] Error:', error);
  }

  BackgroundFetch.finish(taskId);
};

export default new BackgroundTaskService();
