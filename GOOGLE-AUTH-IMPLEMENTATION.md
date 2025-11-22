# 🔐 Google Authentication Implementation Plan

**Branch:** `feature/google-authentication`
**Date Started:** November 22, 2025
**Goal:** Add Google OAuth authentication with multi-user support

---

## 🎯 Implementation Overview

### What We're Building

**Before (v1.0 Single-User):**
- ❌ No authentication
- ❌ All users share same contacts database
- ❌ Privacy issues with multiple users

**After (v2.0 Multi-User):**
- ✅ Google OAuth Sign-In
- ✅ Each user has isolated contacts
- ✅ Multi-device sync per user
- ✅ Ready for App Store launch
- ✅ Google Calendar API integration ready

---

## 📋 Phase 1: Google Cloud Setup

### Step 1.1: Create Google Cloud Project

**You need to do this:**

1. Go to: https://console.cloud.google.com/
2. Click "Create Project"
3. Name: `PrimeAI-Production`
4. Click "Create"

### Step 1.2: Enable Google Sign-In API

1. In Google Cloud Console → "APIs & Services"
2. Click "+ ENABLE APIS AND SERVICES"
3. Search for "Google Sign-In API"
4. Click "Enable"

### Step 1.3: Create OAuth 2.0 Credentials

**For iOS (TestFlight/App Store):**

1. APIs & Services → Credentials
2. Click "+ CREATE CREDENTIALS" → "OAuth client ID"
3. Application type: "iOS"
4. Name: `PrimeAI iOS`
5. Bundle ID: Get from `app.json` (e.g., `com.yourcompany.primeai`)
6. Click "Create"
7. **Save the iOS Client ID** - you'll need this!

**For Android (if needed):**

1. Create another OAuth client ID
2. Application type: "Android"
3. Name: `PrimeAI Android`
4. Package name: Get from `app.json`
5. SHA-1: Get from EAS build or local keystore
6. Click "Create"
7. **Save the Android Client ID**

**For Expo Go (Development):**

1. Create OAuth client ID
2. Application type: "Web application"
3. Name: `PrimeAI Expo Dev`
4. Authorized redirect URIs:
   - `https://auth.expo.io/@your-expo-username/your-app-slug`
5. Click "Create"
6. **Save the Web Client ID**

### Step 1.4: Get Your Credentials

**You'll need these values:**
```javascript
IOS_CLIENT_ID: "xxxxxxxxxxxx.apps.googleusercontent.com"
ANDROID_CLIENT_ID: "xxxxxxxxxxxx.apps.googleusercontent.com" // if Android
EXPO_CLIENT_ID: "xxxxxxxxxxxx.apps.googleusercontent.com" // for dev
```

---

## 📋 Phase 2: Mobile App - Authentication

### Step 2.1: Install Dependencies

```bash
# Install Google authentication packages
npx expo install expo-auth-session expo-random

# Install Google Sign-In
npx expo install @react-native-google-signin/google-signin

# Install secure storage for tokens
npx expo install expo-secure-store

# Install async storage (already have, but verify)
npx expo install @react-native-async-storage/async-storage
```

### Step 2.2: Update app.json

Add Google Sign-In configuration:

```json
{
  "expo": {
    "plugins": [
      "@react-native-google-signin/google-signin"
    ],
    "ios": {
      "googleServicesFile": "./GoogleService-Info.plist",
      "config": {
        "googleSignIn": {
          "reservedClientId": "YOUR_IOS_CLIENT_ID"
        }
      }
    },
    "android": {
      "googleServicesFile": "./google-services.json"
    }
  }
}
```

### Step 2.3: Create Authentication Context

**File:** `contexts/AuthContext.js`

```javascript
import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Configure Google Sign-In
  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: 'YOUR_IOS_CLIENT_ID',
    androidClientId: 'YOUR_ANDROID_CLIENT_ID',
    expoClientId: 'YOUR_EXPO_CLIENT_ID',
  });

  // Check for existing session on mount
  useEffect(() => {
    checkStoredAuth();
  }, []);

  // Handle OAuth response
  useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      fetchUserInfo(authentication.accessToken);
    }
  }, [response]);

  const checkStoredAuth = async () => {
    try {
      const storedUser = await AsyncStorage.getItem('@user:auth');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error('Error loading auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserInfo = async (token) => {
    try {
      const response = await fetch(
        'https://www.googleapis.com/userinfo/v2/me',
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const userInfo = await response.json();

      const userData = {
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        accessToken: token,
      };

      await AsyncStorage.setItem('@user:auth', JSON.stringify(userData));
      setUser(userData);
    } catch (error) {
      console.error('Error fetching user info:', error);
    }
  };

  const signIn = async () => {
    try {
      const result = await promptAsync();
      // Response handled in useEffect above
    } catch (error) {
      console.error('Sign in error:', error);
    }
  };

  const signOut = async () => {
    try {
      await AsyncStorage.removeItem('@user:auth');
      setUser(null);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
```

### Step 2.4: Create Sign-In Screen

**File:** `screens/SignInScreen.js`

```javascript
import React, { useContext } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import AuthContext from '../contexts/AuthContext';

const SignInScreen = () => {
  const { signIn } = useContext(AuthContext);

  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/icon.png')}
        style={styles.logo}
      />
      <Text style={styles.title}>Welcome to PrimeAI</Text>
      <Text style={styles.subtitle}>
        Context-Aware Contact Management
      </Text>

      <TouchableOpacity style={styles.googleButton} onPress={signIn}>
        <Text style={styles.googleIcon}>G</Text>
        <Text style={styles.googleText}>Sign in with Google</Text>
      </TouchableOpacity>

      <Text style={styles.privacy}>
        By signing in, you agree to our Terms of Service and Privacy Policy
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#f1f5f9',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 50,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 12,
    marginBottom: 30,
  },
  googleIcon: {
    fontSize: 24,
    marginRight: 15,
    fontWeight: 'bold',
    color: '#4285F4',
  },
  googleText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  privacy: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});

export default SignInScreen;
```

### Step 2.5: Update App.js with Auth

```javascript
import { AuthProvider } from './contexts/AuthContext';
import AuthContext from './contexts/AuthContext';

function AppContent() {
  const { user, isLoading } = useContext(AuthContext);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' }}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={{ color: '#fff', marginTop: 10 }}>Loading...</Text>
      </View>
    );
  }

  if (!user) {
    return <SignInScreen />;
  }

  return (
    <NavigationContainer>
      {/* Your existing tab navigator */}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
```

---

## 📋 Phase 3: Database Migration

### Step 3.1: Add user_id Column

**SQL Migration:**

```sql
-- Add user_id column to contacts table
ALTER TABLE contacts ADD COLUMN user_id VARCHAR(255);

-- Create index for faster queries
CREATE INDEX idx_contacts_user_id ON contacts(user_id);

-- Set default user_id for existing contacts (your Google ID)
UPDATE contacts SET user_id = 'YOUR_GOOGLE_USER_ID' WHERE user_id IS NULL;

-- Make user_id required for future inserts
ALTER TABLE contacts ALTER COLUMN user_id SET NOT NULL;
```

**Run on Railway:**

1. Go to Railway dashboard
2. Click on your PostgreSQL database
3. Click "Query" tab
4. Paste SQL above (replace YOUR_GOOGLE_USER_ID with your actual ID)
5. Click "Run"

### Step 3.2: Update Database Schema Documentation

The new schema:

```sql
CREATE TABLE contacts (
  contact_id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,  -- NEW: Google user ID
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  photo_url TEXT,
  has_recording BOOLEAN DEFAULT FALSE,
  recording_uri TEXT,
  transcript TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_contacts_user_id ON contacts(user_id);
```

---

## 📋 Phase 4: Backend API Updates

### Step 4.1: Add User Authentication Middleware

**File:** `server/middleware/auth.js`

```javascript
const authenticateUser = (req, res, next) => {
  // Get user_id from headers (sent by mobile app)
  const userId = req.headers['x-user-id'];

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Attach to request for use in routes
  req.userId = userId;
  next();
};

module.exports = { authenticateUser };
```

### Step 4.2: Update Contact Routes

**File:** `server/routes/contacts.js`

```javascript
const { authenticateUser } = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(authenticateUser);

// GET /api/contacts - Get user's contacts only
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM contacts WHERE user_id = $1 ORDER BY created_at DESC',
      [req.userId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/contacts - Create contact for user
router.post('/', upload.single('audio'), async (req, res) => {
  try {
    const { name, phone, email, photoUrl } = req.body;

    const result = await pool.query(
      'INSERT INTO contacts (user_id, name, phone, email, photo_url) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.userId, name, phone, email, photoUrl]
    );

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/contacts/:id - Update only user's own contact
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email } = req.body;

    // Verify contact belongs to user
    const checkResult = await pool.query(
      'SELECT * FROM contacts WHERE contact_id = $1 AND user_id = $2',
      [id, req.userId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const result = await pool.query(
      'UPDATE contacts SET name = $1, phone = $2, email = $3 WHERE contact_id = $4 AND user_id = $5 RETURNING *',
      [name, phone, email, id, req.userId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/contacts/:id - Delete only user's own contact
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM contacts WHERE contact_id = $1 AND user_id = $2 RETURNING *',
      [id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json({ message: 'Contact deleted', contact: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## 📋 Phase 5: Mobile App API Updates

### Step 5.1: Update API Calls to Include user_id

**Update all axios calls to include user ID in headers:**

```javascript
// In ContactListScreen.js, ContactCaptureScreen.js, etc.
import AuthContext from '../contexts/AuthContext';

const { user } = useContext(AuthContext);

// Example: GET contacts
const response = await axios.get(`${API.API_URL}/api/contacts`, {
  headers: {
    'x-user-id': user.id,
  },
});

// Example: POST contact
const response = await axios.post(
  `${API.API_URL}/api/contacts`,
  contactFormData,
  {
    headers: {
      'Content-Type': 'multipart/form-data',
      'x-user-id': user.id,
    },
  }
);

// Example: DELETE contact
await axios.delete(`${API.API_URL}/api/contacts/${contactId}`, {
  headers: {
    'x-user-id': user.id,
  },
});
```

---

## 📋 Phase 6: Testing

### Test Cases

**Authentication:**
- [ ] Sign in with Google (first time)
- [ ] Sign in with Google (returning user)
- [ ] App remembers signed-in user after restart
- [ ] Sign out works
- [ ] Sign in screen shows when not authenticated

**Data Isolation:**
- [ ] User A adds contact → User B doesn't see it
- [ ] User A edits contact → User B's data unchanged
- [ ] User A deletes contact → User B's data unchanged
- [ ] Each user sees only their own contacts

**Backward Compatibility:**
- [ ] Your existing contacts appear (migrated to your user_id)
- [ ] Voice recordings still work
- [ ] Photo uploads still work
- [ ] N8N webhooks still work
- [ ] Caching still works

---

## 🚀 Deployment Checklist

### Before Deploying to Railway:

1. [ ] Test authentication locally
2. [ ] Test data isolation with 2+ test accounts
3. [ ] Verify database migration
4. [ ] Update Railway environment variables (if needed)
5. [ ] Test backward compatibility

### Deploy Steps:

1. Commit all changes
2. Push to GitHub
3. Merge to main (triggers Railway auto-deploy)
4. Monitor Railway logs
5. Test production app
6. Rebuild TestFlight if needed

---

## 📊 Benefits of This Implementation

### For Users:
- ✅ Secure Google Sign-In
- ✅ Private contacts (data isolation)
- ✅ Multi-device sync (same Google account)
- ✅ No password management
- ✅ Trusted authentication

### For Development:
- ✅ Ready for App Store launch
- ✅ Scalable to many users
- ✅ Google Calendar API integration ready
- ✅ Proper user management
- ✅ Meets privacy standards

### For Future Features:
- ✅ User profiles
- ✅ Settings per user
- ✅ Collaboration (share contacts)
- ✅ Usage analytics per user
- ✅ Premium tiers (if desired)

---

## 🔄 Rollback Plan

If authentication breaks:

1. Restore from backup: `git checkout v1.0-stable-backup`
2. See: `RESTORE-INSTRUCTIONS.md`
3. Your old data is safe!

---

## 📝 Next Steps

1. **You:** Set up Google Cloud OAuth credentials
2. **Me:** Install packages and implement authentication
3. **Together:** Test and iterate
4. **Deploy:** Launch multi-user version!

Let's build this! 🚀
