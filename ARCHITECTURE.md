# Context-Aware Contact Capture CRM - Architecture

## System Overview

A voice-first, mobile-native CRM that automatically triggers context capture when you add a new contact to your phone.

## Core Architecture

### 1. Mobile App (React Native)
**Purpose:** Native mobile interface with phone integration

**Key Components:**
- **Contact Monitoring Service** - Detects new contacts in real-time
- **Background Task Service** - Continues monitoring when app is closed
- **Notification System** - Triggers immediate context capture prompts
- **Voice Recording UI** - One-tap recording interface

**Flow:**
```
User adds contact to phone
  ↓
ContactMonitorService detects new contact (5-60 sec)
  ↓
Triggers local push notification
  ↓
User taps notification
  ↓
Opens ContactCaptureScreen with pre-filled data
  ↓
User records voice context
  ↓
Uploads to backend API
  ↓
AI processes and stores
```

### 2. Backend API (Node.js/Express)
**Purpose:** Process voice notes, AI analysis, data storage

**Endpoints:**
- `POST /api/contacts` - Create contact with voice note
- `POST /api/transcribe` - Voice-to-text (OpenAI Whisper)
- `POST /api/analyze-context` - Extract topics, summaries (GPT-4)
- `POST /api/generate-message` - AI follow-up emails
- `GET /api/contacts` - Search and retrieve
- `GET /api/follow-ups` - Priority-based reminders

**AI Pipeline:**
```
Voice Recording (WAV/MP3)
  ↓
OpenAI Whisper API → Transcription
  ↓
GPT-4 API → Context Analysis
  ├─ Summary (2-3 sentences)
  ├─ Topics Discussed (array)
  ├─ Pain Points
  ├─ Opportunities
  ├─ Suggested Follow-up
  └─ Priority (hot/warm/cold)
  ↓
Store in Database
```

### 3. Database (SQLite/PostgreSQL)
**Purpose:** Structured contact storage with context

**Schema:**
```sql
contacts (
  contact_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  date_added TEXT,
  location_lat REAL,
  location_long REAL,
  location_address TEXT,
  venue_name TEXT,
  raw_voice_note_path TEXT,
  transcription TEXT,
  ai_summary TEXT,
  topics_discussed TEXT (JSON),
  follow_up_type TEXT,
  follow_up_priority TEXT,
  follow_up_date TEXT,
  tags TEXT (JSON),
  linkedin_url TEXT,
  company_name TEXT,
  status TEXT
)
```

### 4. Web Interface (React)
**Purpose:** Desktop/backup interface for managing contacts

**Pages:**
- Dashboard - Overview and stats
- Contact List - Search and filter
- Contact Detail - Full context view
- Follow-up Dashboard - Priority queue
- Settings - Configuration

## Key Features Implementation

### 🔔 Automatic Contact Detection

**Mobile (React Native):**
```javascript
// ContactMonitorService.js
1. Request contact permissions
2. Load known contact IDs from AsyncStorage
3. Poll contact list every 5 seconds (foreground)
4. Compare current contacts vs known contacts
5. Detect new additions
6. Trigger notification
7. Update known contacts cache
```

**Background Monitoring:**
```javascript
// BackgroundTaskService.js
1. Configure BackgroundFetch (iOS) / Headless JS (Android)
2. Set minimum interval (15 minutes)
3. Execute contact check in background
4. Continue even when app is closed
5. Battery optimized
```

**Notification Trigger:**
```javascript
// When new contact detected
PushNotification.localNotification({
  title: '🎙️ Add Context?',
  message: 'You just added Sarah Chen. Capture context while it\'s fresh!',
  data: {
    contactData: {
      name: 'Sarah Chen',
      phone: '+1234567890',
      email: 'sarah@company.com'
    }
  },
  actions: ['Capture Now', 'Later']
})
```

### 🎙️ Voice Context Capture

**Recording:**
```javascript
// Uses react-native-audio-recorder-player
1. User taps "Record" button
2. Request microphone permission
3. Start recording (WebM/MP4 format)
4. Display timer and waveform
5. Stop recording
6. Upload to backend
```

**Transcription:**
```javascript
// Backend API
1. Receive audio file
2. Send to OpenAI Whisper API
3. Receive transcription text
4. Return to mobile app
5. Display in UI for review
```

### 🤖 AI Processing

**Context Analysis (GPT-4):**
```javascript
Prompt:
"Analyze this voice note from a networking interaction.
Transcription: '[user's voice note]'

Extract:
- Summary (2-3 sentences)
- Topics discussed
- Pain points mentioned
- Opportunities identified
- Suggested follow-up action
- Priority (hot/warm/cold)

Return JSON format."
```

**Message Generation:**
```javascript
Prompt:
"Generate a personalized follow-up email.

Context:
- Name: Sarah Chen
- Met at: AI Summit 2024
- Discussed: AI automation, logistics
- Follow-up: Send proposal

Create 3 versions:
1. Professional/Formal
2. Friendly/Casual
3. Brief/Direct"
```

### 📱 Mobile-First Design

**Navigation:**
```
Bottom Tab Bar:
├─ Home (Dashboard)
├─ Contacts (List)
├─ Add (Quick Capture) ← Primary action
└─ Follow-ups (Queue)
```

**Deep Linking:**
```
contextcrm://capture?contactId=123
  ↓
Opens ContactCaptureScreen with pre-filled data
```

## Data Flow

### Adding a Contact

```
Phone Contact App
  ↓ (User adds contact)
ContactMonitorService (Mobile)
  ↓ (Detects new contact)
Push Notification
  ↓ (User taps)
ContactCaptureScreen
  ↓ (Voice recording)
Backend API (/api/transcribe)
  ↓
OpenAI Whisper
  ↓ (Transcription)
Backend API (/api/analyze-context)
  ↓
GPT-4 Analysis
  ↓ (Structured data)
Backend API (/api/contacts)
  ↓
SQLite Database
  ↓
Mobile App (Updated list)
```

### Follow-up Flow

```
Follow-up Dashboard
  ↓ (User selects contact)
Contact Detail Screen
  ↓ (Tap "Generate Message")
Backend API (/api/generate-message)
  ↓
GPT-4 (3 message versions)
  ↓
Mobile App (Display drafts)
  ↓ (User selects tone)
Copy to Clipboard
  ↓
Paste in email app
  ↓ (Send)
Mark as "Contacted"
```

## Technology Stack

### Mobile App
- **React Native** - Cross-platform mobile framework
- **react-native-contacts** - Access phone contacts
- **react-native-background-fetch** - Background monitoring
- **react-native-push-notification** - Local notifications
- **react-native-audio-recorder-player** - Voice recording
- **@react-navigation** - Navigation
- **AsyncStorage** - Local data persistence

### Backend
- **Node.js + Express** - API server
- **OpenAI API** - Whisper (transcription) + GPT-4 (analysis)
- **better-sqlite3** - Database (upgradable to PostgreSQL)
- **multer** - File upload handling
- **cors** - Cross-origin requests

### Web Interface
- **React** - UI framework
- **React Router** - Client-side routing
- **Axios** - HTTP client
- **Web Audio API** - Browser recording

## Security & Privacy

### Data Protection
- Voice notes encrypted at rest
- API keys in environment variables
- HTTPS for all API requests
- Local-first data storage

### Permissions
- Explicit permission requests
- Clear usage descriptions
- Opt-in contact monitoring
- User can disable anytime

### Privacy Policy
- Data stored locally on device
- Only uploaded when user saves
- No automatic cloud sync
- Export/delete anytime

## Deployment

### Mobile App
- **iOS:** App Store (TestFlight for beta)
- **Android:** Google Play Store
- **Build:** React Native CLI or Expo

### Backend API
- **Hosting:** Railway, Render, or AWS
- **Database:** PostgreSQL (production)
- **Environment:** Node.js 16+

### Web Interface
- **Hosting:** Vercel, Netlify
- **Build:** React production build
- **CDN:** Automatic with hosting

## Performance Considerations

### Battery Optimization
- Intelligent polling intervals
- Background fetch throttling
- Idle detection
- Battery level awareness

### Network Efficiency
- Batch API requests
- Audio compression
- Offline queue
- Retry logic

### Storage Management
- Audio file cleanup
- Database indexing
- Pagination
- Archive old contacts

## Future Enhancements

### Phase 2
- LinkedIn profile enrichment
- Company data integration
- Email sync
- Calendar integration

### Phase 3
- Team collaboration
- CRM integrations (HubSpot, Salesforce)
- Relationship strength scoring
- Networking analytics

### Phase 4
- AI-powered introductions
- Automatic follow-up scheduling
- Voice command interface
- Wearable integration
