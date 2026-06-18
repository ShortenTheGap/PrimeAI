# cnnected (Context CRM) - Design Brief

## App Overview

**cnnected** is a mobile CRM app for capturing contacts you meet in person. It detects when you add a new contact to your phone and prompts you to enrich it with voice notes, photos, and follow-up actions.

### Core Features
- **Contact Detection**: Monitors phone contacts, notifies on new additions
- **Voice Notes**: Record context about where/how you met someone (auto-transcribed via OpenAI Whisper)
- **Photo Capture**: Take photos to remember moments
- **Quick Actions**: Send welcome messages, share links, create calendar reminders
- **N8N Webhooks**: Optional integrations for power users
- **Cloud Sync**: All data backed up to server
- **Admin Dashboard**: Web-based user/subscription management

---

## Tech Stack

### Mobile App (React Native / Expo)
- **Framework**: Expo SDK 54
- **Navigation**: React Navigation (Stack + Bottom Tabs)
- **Storage**: AsyncStorage for local cache/preferences
- **Audio**: expo-av for voice recording
- **Notifications**: expo-notifications
- **Background Tasks**: expo-background-fetch + expo-task-manager

### Backend (Node.js / Express)
- **Framework**: Express.js
- **Database**: PostgreSQL (production) / SQLite (local dev)
- **Auth**: JWT + bcrypt
- **File Upload**: Multer
- **Transcription**: OpenAI Whisper API
- **Hosting**: Railway

### External Services
- **Database Hosting**: Supabase PostgreSQL (connected via Railway)
- **App Hosting**: Railway (Docker container)
- **Mobile Builds**: EAS Build (Expo Application Services)
- **App Distribution**: iOS App Store, TestFlight

---

## Project Structure

```
PrimeAI/
├── App.js                    # Main app entry, navigation setup
├── app.json                  # Expo config (bundle ID, permissions, build number)
├── eas.json                  # EAS Build configuration
├── railway.json              # Railway deployment config
├── Dockerfile                # Docker config for Railway
├── package.json              # Dependencies
│
├── screens/
│   ├── LoginScreen.js        # Email/password login
│   ├── SignupScreen.js       # User registration
│   ├── PrivacyConsentScreen.js # GDPR/Apple privacy consent (required before app use)
│   ├── ContactListScreen.js  # Main contact list view
│   ├── ContactCaptureScreen.js # Edit existing contact
│   ├── NewContactWizardScreen.js # Multi-step wizard for new contacts
│   └── SettingsScreen.js     # App settings, account management
│
├── services/
│   ├── ApiService.js         # Axios client with JWT interceptor
│   ├── UserService.js        # User auth state management
│   ├── ContactMonitorService.js # Detects new phone contacts
│   └── BackgroundTaskService.js # Background contact monitoring
│
├── config/
│   └── api.js                # API URL config (dev vs prod)
│
├── server/
│   ├── index.js              # Express server entry
│   ├── database/
│   │   ├── db.js             # Database abstraction (Postgres/SQLite)
│   │   └── init.js           # Schema initialization
│   ├── routes/
│   │   ├── auth.js           # Login, signup, account deletion, webhook user creation
│   │   ├── contacts.js       # CRUD contacts, file uploads, transcription
│   │   ├── admin.js          # Admin dashboard API
│   │   └── ai.js             # OpenAI integrations
│   └── admin/
│       └── index.html        # Admin dashboard web UI
│
└── assets/                   # App icons, splash screens
```

---

## Environment Configuration

### Railway Environment Variables
```
DATABASE_URL=postgresql://...     # Supabase connection string
JWT_SECRET=your-secret-key
OPENAI_API_KEY=sk-...             # For Whisper transcription
WEBHOOK_API_KEY=your-webhook-key  # For CRM user provisioning
NODE_ENV=production
```

### Local Development
```bash
# Start mobile app (Expo)
npm start

# Start local server (uses SQLite)
npm run server:dev
```

### API URL Switching
- **Expo Go / Dev**: Points to Railway (see `config/api.js`)
- **Standalone Build**: Always uses production Railway URL

---

## Database Schema

### Users Table
```sql
users (
  user_id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  password_hash TEXT,
  device_id TEXT,
  is_admin BOOLEAN,
  subscription_status TEXT,    -- 'active', 'suspended', 'cancelled'
  subscription_tier TEXT,      -- 'free', 'pro', 'enterprise'
  subscription_expires_at TIMESTAMP,
  created_at TIMESTAMP
)
```

### Contacts Table
```sql
contacts (
  contact_id SERIAL PRIMARY KEY,
  user_id TEXT REFERENCES users(user_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  photo_url TEXT,              -- Server path: /uploads/photos/...
  recording_uri TEXT,          -- Server path: /uploads/audio/...
  has_recording BOOLEAN,
  transcript TEXT,             -- OpenAI Whisper transcription
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

---

## Key Workflows

### 1. New Contact Flow (Wizard)
```
Contact Info → Photo? → Message? → Calendar? → Voice Note? → Context Note? → Save
```
Each step is optional. Contacts are saved to server with optional voice transcription.

### 2. Authentication Flow
```
Login/Signup → Privacy Consent Screen → Main App
```
Privacy consent is required (Apple Guideline 5.1.2 compliance).

### 3. Voice Transcription Flow
```
User records → Audio uploaded to server → Server calls OpenAI Whisper → 
Transcript returned in API response → Displayed in app
```

### 4. Webhook Integration (N8N)
Users can configure a master webhook URL in Settings. The app sends payloads for:
- `action: 'welcome'` - Welcome message
- `action: 'link'` - Send link
- `action: 'follow'` - Calendar reminder
- `action: 'update'` - Contact saved/updated with context

---

## Deployment Workflow

### Git Branches
- `main` - Production-ready code
- `claude/*` - Feature/fix branches from Claude sessions

### Update Process

#### 1. Push Code Changes
```bash
# Commit changes
git add .
git commit -m "Description of changes"
git push origin main
```

#### 2. Railway Auto-Deploys
Railway is connected to the GitHub repo and auto-deploys on push to `main`.
- URL: https://primeai-production-ec82.up.railway.app
- Dashboard: https://railway.app (login to view)

#### 3. Build iOS App (EAS)
```bash
# Build production IPA
eas build --platform ios --profile production

# Submit to App Store / TestFlight
eas submit --platform ios
# OR
fastlane pilot upload
```

#### 4. Build Android App (EAS)
```bash
# Build production AAB
eas build --platform android --profile production

# Submit to Google Play
eas submit --platform android
```

---

## Admin Dashboard

### Access
- URL: `https://primeai-production-ec82.up.railway.app/admin`
- First-time setup: POST to `/api/admin/setup` with admin credentials

### Features
- View all users and their contact counts
- Manage subscriptions (status, tier, expiration)
- Add/remove admin privileges
- Delete users
- Provision new users via webhook

### Webhook User Creation
External CRMs can create users via:
```bash
curl -X POST https://primeai-production-ec82.up.railway.app/api/auth/webhook/create-user \
  -H "Authorization: Bearer YOUR_WEBHOOK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "name": "John", "password": "temp123"}'
```

---

## App Store Submission

### Current Status
- **App Name**: cnnected
- **Bundle ID**: com.yourname.contextcrm
- **Current Build**: 37
- **Status**: Live (with pending updates)

### Required Permissions (iOS)
- Contacts - detect new additions
- Microphone - voice notes
- Camera - photo capture
- Calendar - follow-up reminders
- Location - remember where you met

### App Store Review Fixes Applied
- Account deletion feature (Guideline 5.1.1(v))
- Privacy consent screen (Guideline 5.1.2)
- Removed background audio mode (Guideline 2.5.4)

---

## Quick Reference Commands

```bash
# === LOCAL DEVELOPMENT ===
npm start                      # Start Expo dev server
npm run server:dev             # Start local Express server (SQLite)

# === GIT ===
git pull origin main           # Pull latest
git push origin main           # Push to main (triggers Railway deploy)

# === iOS BUILD ===
eas build --platform ios       # Build iOS app
eas submit --platform ios      # Submit to App Store
fastlane pilot upload          # Alternative: upload to TestFlight

# === ANDROID BUILD ===
eas build --platform android   # Build Android app
eas submit --platform android  # Submit to Google Play

# === RAILWAY ===
# Auto-deploys on git push to main
# Manual redeploy: Railway dashboard → Deployments → Redeploy

# === DATABASE (Supabase) ===
# Access via Supabase dashboard or Railway DATABASE_URL
```

---

## Troubleshooting

### Build Number Already Exists
Bump `buildNumber` in `app.json` before submitting.

### Railway Deploy Failed
Check Railway logs. Common issues:
- Missing env vars
- Dockerfile syntax errors
- Port mismatch (must expose 5000)

### Transcription Not Working
- Check OPENAI_API_KEY is set in Railway env vars
- Check server logs for API errors

### Privacy Consent Keeps Showing
AsyncStorage key: `@privacy:consent_given`
Clear app data or check storage permissions.

---

## Contact / Resources

- **GitHub Repo**: ShortenTheGap/PrimeAI
- **Railway Dashboard**: railway.app
- **Supabase Dashboard**: supabase.com
- **EAS Dashboard**: expo.dev
- **App Store Connect**: appstoreconnect.apple.com
