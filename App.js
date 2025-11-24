import React, { useEffect, useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform, View, Text, ActivityIndicator } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

// Import screens
import ContactCaptureScreen from './screens/ContactCaptureScreen';
import ContactListScreen from './screens/ContactListScreen';
import SettingsScreen from './screens/SettingsScreen';
import SignInScreen from './screens/SignInScreen';

// Import services
import ContactMonitorService from './services/ContactMonitorService';
import BackgroundTaskService from './services/BackgroundTaskService';

// Import authentication
import { AuthProvider } from './contexts/AuthContext';
import AuthContext from './contexts/AuthContext';

const Tab = createBottomTabNavigator();

const AppContent = () => {
  const navigationRef = React.useRef(null);

  // Global flag to track unsaved changes in ContactCapture
  global.hasUnsavedContactChanges = false;
  global.showUnsavedChangesAlert = null;

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

      // Register navigation callback for auto-navigation when new contact detected in foreground
      ContactMonitorService.setNavigationCallback((contactData) => {
        console.log('🔄 Auto-navigating to Contact Capture with:', contactData.name);
        navigationRef.current?.navigate('ContactCapture', {
          contactData: contactData,
          mode: 'add'
        });
      });

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

  // Get authentication state
  const { user, isLoading } = useContext(AuthContext);

  // Debug: Log authentication state
  console.log('🔐 Auth State:', {
    isLoading,
    hasUser: !!user,
    userEmail: user?.email,
    appOwnership: Constants.appOwnership,
  });

  // TEMPORARY: Skip auth check entirely to diagnose black screen issue
  // Show main app directly
  console.log('⚠️ BYPASS: Skipping authentication check for debugging');

  // Show loading screen while checking authentication
  if (isLoading) {
    return (
      <View style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0f172a'
      }}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={{ color: '#94a3b8', marginTop: 16, fontSize: 16 }}>
          Loading PrimeAI...
        </Text>
        <Text style={{ color: '#64748b', marginTop: 8, fontSize: 12 }}>
          Checking authentication...
        </Text>
      </View>
    );
  }

  // TEMPORARY: Comment out auth gate
  // Show sign-in screen if not authenticated
  // if (!user) {
  //   console.log('📱 Showing SignInScreen - no user found');
  //   return <SignInScreen />;
  // }

  console.log('✅ Showing main app (auth bypassed for debugging)');

  // User is authenticated, show main app
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
          listeners={({ navigation }) => ({
            tabPress: (e) => {
              console.log('⚙️ Settings tab pressed, checking for unsaved changes...');
              console.log('📊 Global state:', {
                hasUnsavedContactChanges: global.hasUnsavedContactChanges,
                hasAlertFunction: !!global.showUnsavedChangesAlert,
              });

              if (global.hasUnsavedContactChanges && global.showUnsavedChangesAlert) {
                console.log('⛔ Unsaved changes detected - calling alert function');
                e.preventDefault();
                global.showUnsavedChangesAlert(() => {
                  console.log('✅ User confirmed - navigating to Settings');
                  global.hasUnsavedContactChanges = false;
                  navigation.navigate('Settings');
                });
              } else {
                console.log('✅ No unsaved changes - allowing navigation to Settings');
                if (!global.hasUnsavedContactChanges) {
                  console.log('  - Reason: hasUnsavedContactChanges is false');
                }
                if (!global.showUnsavedChangesAlert) {
                  console.log('  - Reason: showUnsavedChangesAlert function not set');
                }
              }
            },
          })}
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
          listeners={({ navigation }) => ({
            tabPress: (e) => {
              console.log('👥 ContactList tab pressed, checking for unsaved changes...');
              console.log('📊 Global state:', {
                hasUnsavedContactChanges: global.hasUnsavedContactChanges,
                hasAlertFunction: !!global.showUnsavedChangesAlert,
              });

              if (global.hasUnsavedContactChanges && global.showUnsavedChangesAlert) {
                console.log('⛔ Unsaved changes detected - calling alert function');
                e.preventDefault();
                global.showUnsavedChangesAlert(() => {
                  console.log('✅ User confirmed - navigating to ContactList');
                  global.hasUnsavedContactChanges = false;
                  navigation.navigate('ContactList');
                });
              } else {
                console.log('✅ No unsaved changes - allowing navigation to ContactList');
                if (!global.hasUnsavedContactChanges) {
                  console.log('  - Reason: hasUnsavedContactChanges is false');
                }
                if (!global.showUnsavedChangesAlert) {
                  console.log('  - Reason: showUnsavedChangesAlert function not set');
                }
              }
            },
          })}
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

// Main App component wrapped with AuthProvider
const App = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
