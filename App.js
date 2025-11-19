import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform, View, Text } from 'react-native';
import * as Notifications from 'expo-notifications';

// Import screens
import ContactCaptureScreen from './screens/ContactCaptureScreen';
import ContactListScreen from './screens/ContactListScreen';
import SettingsScreen from './screens/SettingsScreen';

// Import services
import ContactMonitorService from './services/ContactMonitorService';
import BackgroundTaskService from './services/BackgroundTaskService';

const Tab = createBottomTabNavigator();

const App = () => {
  const navigationRef = React.useRef(null);

  useEffect(() => {
    // Initialize services on app startup
    initializeApp();

    // Configure notification handler
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    // Handle notification taps
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      console.log('📲 Notification tapped, full data:', JSON.stringify(data, null, 2));
      
      if (data?.contactData) {
        const contactData = typeof data.contactData === 'string'
          ? JSON.parse(data.contactData)
          : data.contactData;
        
        console.log('🔄 Navigating to ContactCapture with contact:', JSON.stringify(contactData, null, 2));
        
        setTimeout(() => {
          navigationRef.current?.navigate('ContactCapture', {
            contactData: contactData,
            mode: 'add'
          });
        }, 100);
      }
    });

    return () => subscription.remove();
  }, []);

  const initializeApp = async () => {
    try {
      // Initialize foreground contact monitoring
      await ContactMonitorService.initialize();
      console.log('✅ Foreground monitoring initialized');

      // Initialize background monitoring (works in native builds, not Expo Go)
      const backgroundEnabled = await BackgroundTaskService.register();
      if (backgroundEnabled) {
        console.log('✅ Background monitoring enabled - app will check contacts every 15 minutes');
      } else {
        console.log('⚠️ Background monitoring not available - foreground monitoring only');
      }

      console.log('✅ App initialized successfully');
    } catch (error) {
      console.error('❌ App initialization error:', error);
    }
  };

  // Make navigation globally accessible for notifications
  global.navigateToContextCapture = (contactData) => {
    console.log('🌐 Global navigate called with:', contactData);
    navigationRef.current?.navigate('ContactCapture', {
      contactData: contactData,
      mode: 'add'
    });
  };

  return (
    <NavigationContainer ref={navigationRef}>
      <Tab.Navigator
        initialRouteName="ContactList"
        screenOptions={{
          tabBarShowLabel: false,
          tabBarStyle: {
            backgroundColor: '#1e293b',
            borderTopColor: '#334155',
            height: Platform.OS === 'ios' ? 88 : 70,
            paddingBottom: Platform.OS === 'ios' ? 28 : 12,
            paddingTop: 12,
          },
          headerStyle: {
            backgroundColor: '#1e293b',
          },
          headerTintColor: '#f1f5f9',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            title: 'Settings',
            tabBarIcon: ({ focused }) => (
              <Text style={{ fontSize: 24 }}>⚙️</Text>
            ),
          }}
        />
        <Tab.Screen
          name="ContactList"
          component={ContactListScreen}
          options={{
            title: 'Contacts',
            tabBarIcon: ({ focused }) => (
              <Text style={{ fontSize: 24 }}>👥</Text>
            ),
          }}
        />
        <Tab.Screen
          name="ContactCapture"
          component={ContactCaptureScreen}
          options={{
            title: 'Add Contact',
            tabBarIcon: ({ focused }) => (
              <View style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: '#10b981',
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                <Text style={{ fontSize: 24, color: 'white', fontWeight: 'bold' }}>+</Text>
              </View>
            ),
          }}
          listeners={({ navigation }) => ({
            tabPress: (e) => {
              e.preventDefault();
              navigation.navigate('ContactCapture', { mode: 'add' });
            },
          })}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
};

export default App;
