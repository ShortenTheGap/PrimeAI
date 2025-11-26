import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Platform, View, Text, ActivityIndicator } from 'react-native';
import * as Notifications from 'expo-notifications';

// Import screens
import ContactCaptureScreen from './screens/ContactCaptureScreen';
import ContactListScreen from './screens/ContactListScreen';
import SettingsScreen from './screens/SettingsScreen';
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';

// Import services
import ContactMonitorService from './services/ContactMonitorService';
import BackgroundTaskService from './services/BackgroundTaskService';
import userService from './services/UserService';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const App = () => {
  const navigationRef = React.useRef(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

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
      // Check for JWT token (email/password auth)
      const token = await userService.getToken();

      if (token) {
        // User has JWT token - load their data
        const storedUser = await userService.getUser();
        if (storedUser) {
          console.log('✅ User authenticated with JWT:', storedUser.email);
          setIsAuthenticated(true);

          // Always set navigation callback first
          ContactMonitorService.setNavigationCallback((contactData) => {
            console.log('🔄 Auto-navigating to Contact Capture with:', contactData.name);
            navigationRef.current?.navigate('ContactCapture', {
              contactData: contactData,
              mode: 'add'
            });
          });

          // Check if monitoring was previously enabled
          const monitoringEnabled = await ContactMonitorService.getMonitoringState();
          console.log('📊 Monitoring state from storage:', monitoringEnabled);

          if (monitoringEnabled) {
            // User had monitoring enabled - restore it
            await ContactMonitorService.initialize();
            console.log('✅ Foreground monitoring restored');

            const backgroundEnabled = await BackgroundTaskService.register();
            if (backgroundEnabled) {
              console.log('✅ Background monitoring enabled');
            } else {
              console.log('⚠️ Background monitoring not available');
            }
          } else {
            console.log('ℹ️ Monitoring not enabled - user can enable in Settings');
          }
        } else {
          // Token exists but no user data - clear and show login
          console.log('⚠️ Token found but no user data - clearing');
          await userService.logout();
          setIsAuthenticated(false);
        }
      } else {
        // No token - require login/signup
        console.log('👋 No authentication found - showing login screen');
        setIsAuthenticated(false);
      }

      console.log('✅ App initialized successfully');
      setIsInitialized(true);
    } catch (error) {
      console.error('❌ App initialization error:', error);
      setIsInitialized(true);
    }
  };

  // Handle successful login
  const handleLoginSuccess = async (token, user) => {
    await userService.login(token, user);
    setIsAuthenticated(true);

    // Set navigation callback
    ContactMonitorService.setNavigationCallback((contactData) => {
      navigationRef.current?.navigate('ContactCapture', {
        contactData: contactData,
        mode: 'add'
      });
    });

    // Check if monitoring was previously enabled
    const monitoringEnabled = await ContactMonitorService.getMonitoringState();
    if (monitoringEnabled) {
      // Restore monitoring if it was enabled before
      await ContactMonitorService.initialize();
      await BackgroundTaskService.register();
      console.log('✅ Monitoring restored after login');
    } else {
      console.log('ℹ️ Monitoring not enabled - user can enable in Settings');
    }
  };

  // Handle successful signup
  const handleSignupSuccess = async (token, user) => {
    await handleLoginSuccess(token, user);
  };

  // Handle logout
  const handleLogout = async () => {
    await userService.logout();
    setIsAuthenticated(false);
  };

  // Make handlers globally accessible
  global.handleLogout = handleLogout;

  // Make navigation globally accessible for notifications
  global.navigateToContextCapture = (contactData) => {
    console.log('🌐 Global navigate called with:', contactData);
    navigationRef.current?.navigate('ContactCapture', {
      contactData: contactData,
      mode: 'add'
    });
  };

  // Auth Stack Navigator
  const AuthStack = () => (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Login">
        {props => <LoginScreen {...props} onLoginSuccess={handleLoginSuccess} />}
      </Stack.Screen>
      <Stack.Screen name="Signup">
        {props => <SignupScreen {...props} onSignupSuccess={handleSignupSuccess} />}
      </Stack.Screen>
    </Stack.Navigator>
  );

  // Main App Tab Navigator
  const MainApp = () => (
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
  );

  // Show loading screen while initializing
  if (!isInitialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' }}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={{ color: '#94a3b8', marginTop: 16, fontSize: 16 }}>
          Initializing...
        </Text>
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      {isAuthenticated ? <MainApp /> : <AuthStack />}
    </NavigationContainer>
  );
};

export default App;
