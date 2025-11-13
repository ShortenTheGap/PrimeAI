# Context CRM - Mobile App

React Native mobile application with automatic contact monitoring.

## Key Features

### 🔔 Automatic Contact Detection
- **Monitors phone's contact list** for new additions
- **Triggers notification within 60 seconds** of adding a contact
- **Auto-populates contact details** (name, phone, email)
- **Background monitoring** works even when app is closed

### 🎙️ Voice-First Context Capture
- One-tap recording from notification
- Pre-filled contact information
- Immediate context capture while memory is fresh

### 📱 Mobile-Native Integration
- iOS and Android support
- Push notifications
- Background tasks
- Deep linking
- Contact permissions

## Setup

### 1. Install Dependencies
```bash
cd mobile
npm install
```

### 2. iOS Setup
```bash
cd ios
pod install
cd ..
npx react-native run-ios
```

### 3. Android Setup
```bash
npx react-native run-android
```

### 4. Permissions Required

**Android (android/app/src/main/AndroidManifest.xml):**
```xml
<uses-permission android:name="android.permission.READ_CONTACTS" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
```

**iOS (ios/YourApp/Info.plist):**
```xml
<key>NSContactsUsageDescription</key>
<string>We need access to your contacts to help you capture context when you meet someone new.</string>
```

## How It Works

### User Flow:
1. **User meets someone** at an event/meeting
2. **Exchanges numbers** and adds contact to phone
3. **Within 60 seconds**, Context CRM detects the new contact
4. **Notification appears**: "You just added Sarah Chen. Capture context while it's fresh!"
5. **User taps notification** → Opens context capture screen
6. **Contact details pre-filled** (name, phone, email)
7. **User presses record** and speaks context
8. **AI processes** and saves with full context

### Technical Implementation:

#### Contact Monitoring Service
- Polls contact list every 5 seconds (foreground)
- Background task checks every 15 minutes (background)
- Stores known contact IDs in AsyncStorage
- Detects new contacts by comparing current vs known

#### Notification System
- Immediate local notification on new contact detected
- Custom notification actions ("Capture Now", "Later")
- Deep linking to context capture screen
- Auto-populates contact data from phone

#### Background Tasks
- iOS: Background fetch
- Android: Headless JS + AlarmManager
- Continues monitoring even when app is closed
- Battery optimized with configurable intervals

## Project Structure

```
mobile/
├── src/
│   ├── App.js                          # Main navigation
│   ├── screens/
│   │   ├── ContactCaptureScreen.js    # Voice recording UI
│   │   ├── ContactListScreen.js       # All contacts
│   │   └── SettingsScreen.js          # Monitoring settings
│   └── services/
│       ├── ContactMonitorService.js   # Contact detection
│       └── BackgroundTaskService.js   # Background monitoring
├── android/                            # Android native code
├── ios/                                # iOS native code
└── package.json
```

## Testing

### Test Notification Trigger:
1. Open app
2. Go to Settings
3. Enable "Auto-Detect New Contacts"
4. Tap "Send Test Notification"
5. Verify notification appears

### Test Real Contact Detection:
1. Enable monitoring in Settings
2. Open phone's Contacts app
3. Add a new contact
4. Wait up to 60 seconds
5. Should receive notification

## Key Services

### ContactMonitorService
- `initialize()` - Start monitoring
- `checkForNewContacts()` - Compare current vs known
- `triggerContextCaptureNotification()` - Send alert
- `requestPermissions()` - Request contact access

### BackgroundTaskService
- `configure()` - Setup background tasks
- `start()` - Begin background monitoring
- `HeadlessTask()` - Android background execution

## Configuration

### Monitoring Interval (ContactMonitorService.js)
```javascript
// Foreground check interval (default: 5 seconds)
this.checkInterval = setInterval(async () => {
  await this.checkForNewContacts();
}, 5000);
```

### Background Fetch (BackgroundTaskService.js)
```javascript
// Background check interval (default: 15 minutes)
minimumFetchInterval: 15,
```

## Platform-Specific Notes

### iOS
- Background fetch requires capability enabled in Xcode
- Max 30 seconds execution time in background
- System determines actual fetch frequency

### Android
- Uses AlarmManager for reliable background execution
- Headless JS runs even when app is terminated
- Must handle Doze mode restrictions

## Troubleshooting

**Notifications not appearing?**
- Check notification permissions
- Verify channel created (Android)
- Test with "Send Test Notification"

**Contact monitoring not working?**
- Verify contact permission granted
- Check Settings → monitoring enabled
- Review logs for errors

**Background tasks not running?**
- Check battery optimization settings
- Verify app not force-closed by system
- iOS: Background App Refresh enabled

## Production Considerations

1. **Battery Optimization**
   - Increase check interval in production (30-60 seconds)
   - Use smart scheduling based on user patterns

2. **Privacy Compliance**
   - Clear privacy policy
   - Opt-in monitoring
   - Local-first data storage

3. **Performance**
   - Throttle contact list reads
   - Implement delta detection
   - Cache contact snapshots

4. **User Experience**
   - Customizable notification timing
   - Snooze/dismiss options
   - Batch mode for multiple contacts
