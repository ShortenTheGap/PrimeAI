import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PushNotification from 'react-native-push-notification';

// Import screens
import ContactCaptureScreen from './screens/ContactCaptureScreen';
import ContactListScreen from './screens/ContactListScreen';
import SettingsScreen from './screens/SettingsScreen';

// Import services
import ContactMonitorService from './services/ContactMonitorService';
import BackgroundTaskService from './services/BackgroundTaskService';

const Stack = createNativeStackNavigator();

const App = () => {
  useEffect(() => {
    // Initialize services on app startup
    initializeApp();

    // Handle notification actions
    PushNotification.configure({
      onNotification: function (notification) {
        if (notification.userInteraction) {
          // User tapped the notification
          const contactData = notification.data?.contactData;
          if (contactData) {
            const parsedData = typeof contactData === 'string'
              ? JSON.parse(contactData)
              : contactData;

            // Navigate to context capture with pre-filled data
            navigationRef.current?.navigate('ContactCapture', {
              contactData: parsedData,
            });
          }
        }
      },
    });
  }, []);

  const initializeApp = async () => {
    try {
      // Initialize contact monitoring
      await ContactMonitorService.initialize();

      // Configure background tasks
      await BackgroundTaskService.configure();
      await BackgroundTaskService.start();

      console.log('App initialized successfully');
    } catch (error) {
      console.error('App initialization error:', error);
    }
  };

  const navigationRef = React.useRef(null);

  // Make navigation globally accessible for notifications
  global.navigateToContextCapture = (contactData) => {
    navigationRef.current?.navigate('ContactCapture', { contactData });
  };

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        initialRouteName="ContactList"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#1e293b',
          },
          headerTintColor: '#f1f5f9',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen
          name="ContactList"
          component={ContactListScreen}
          options={{ title: 'Contacts' }}
        />
        <Stack.Screen
          name="ContactCapture"
          component={ContactCaptureScreen}
          options={{ title: 'Add Context' }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ title: 'Settings' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default App;
