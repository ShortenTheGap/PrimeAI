# Context-Aware Contact Capture CRM

A voice-first, mobile-native CRM that **automatically** triggers context capture when you add a new contact to your phone.

## 🎯 Core Flow
**Add Contact to Phone → Auto-Notification (60 sec) → Voice Context Capture → AI Processing → Smart Storage**

## ⚡ The Problem It Solves

You meet someone amazing at an event. Exchange numbers. Add them to your phone. Then weeks later... *"Who was this person again? Where did we meet?"*

**Context CRM fixes this by:**
1. 📱 **Detecting** when you add a contact to your phone
2. 🔔 **Notifying you instantly** (within 60 seconds)
3. 🎙️ **Capturing context** via voice while it's fresh
4. 🤖 **AI analyzing** and organizing everything
5. 📅 **Reminding you** to follow up at the right time

## ✨ Key Features

### 🔔 Automatic Contact Detection (NEW!)
- **Monitors your phone's contact list** in real-time
- **Triggers notification within 60 seconds** when you add a contact
- **Auto-populates** name, phone, email from phone
- **Works in background** even when app is closed
- **Battery optimized** smart polling

### 🎙️ Voice-First Context Capture
- ✅ One-tap voice recording from notification
- ✅ Automatic transcription (OpenAI Whisper)
- ✅ AI-powered context analysis (GPT-4)
- ✅ Topic extraction and summarization
- ✅ Geolocation capture (where you met)

### 🤖 AI Intelligence
- ✅ Automatic summarization (2-3 sentences)
- ✅ Topic extraction from conversations
- ✅ Pain points and opportunities detection
- ✅ Follow-up priority recommendation (hot/warm/cold)
- ✅ AI-generated personalized messages (3 tones)

### 📱 Smart CRM Features
- ✅ Contact list with advanced search
- ✅ Follow-up dashboard with priority queue
- ✅ Smart reminders (today, this week, upcoming, overdue)
- ✅ Draft message generator
- ✅ Tag-based organization
- ✅ Mobile-first design

### 🔮 Coming Soon
- LinkedIn profile enrichment
- Company data integration
- Email/calendar sync
- Networking analytics
- Relationship strength scoring
- Team collaboration

## 🏗️ Project Structure

```
PrimeAI/
├── mobile/                    # React Native mobile app (PRIMARY)
│   ├── src/
│   │   ├── services/
│   │   │   ├── ContactMonitorService.js    # Phone contact monitoring
│   │   │   └── BackgroundTaskService.js    # Background monitoring
│   │   └── screens/
│   │       ├── ContactCaptureScreen.js     # Voice recording UI
│   │       ├── ContactListScreen.js        # Contact management
│   │       └── SettingsScreen.js           # Monitoring settings
│   ├── android/               # Android native config
│   └── ios/                   # iOS native config
├── server/                    # Node.js backend API
│   ├── routes/
│   │   ├── contacts.js        # Contact CRUD
│   │   └── ai.js              # AI processing
│   └── database/
│       └── init.js            # SQLite schema
├── client/                    # React web interface (backup)
│   └── src/
│       └── components/        # Web UI components
└── ARCHITECTURE.md            # Detailed architecture docs
```

## 🚀 Tech Stack

### Mobile App (Primary Interface)
- **React Native** - Cross-platform iOS/Android
- **react-native-contacts** - Phone contact access
- **react-native-background-fetch** - Background monitoring
- **react-native-push-notification** - Local notifications
- **react-native-audio-recorder-player** - Voice recording
- **@react-navigation** - Navigation

### Backend API
- **Node.js + Express** - REST API
- **OpenAI Whisper** - Voice transcription
- **GPT-4** - Context analysis & message generation
- **SQLite** - Local database (PostgreSQL for production)

### Web Interface (Desktop/Backup)
- **React** - Web UI
- **React Router** - Client routing
- **Web Audio API** - Browser recording

## 📦 Installation

### Option 1: Mobile App (Recommended)

#### iOS
```bash
cd mobile
npm install
cd ios && pod install && cd ..
npx react-native run-ios
```

#### Android
```bash
cd mobile
npm install
npx react-native run-android
```

### Option 2: Web Interface

```bash
# Install all dependencies
npm run install-all

# Set up environment
cp .env.example .env
# Edit .env and add OPENAI_API_KEY

# Start backend + frontend
npm run dev

# Open http://localhost:3000
```

### Backend Only
```bash
cd server
npm install
node index.js
```

## API Endpoints

- `POST /api/contacts` - Create new contact with context
- `GET /api/contacts` - Get all contacts with optional filters
- `GET /api/contacts/:id` - Get specific contact
- `PUT /api/contacts/:id` - Update contact
- `DELETE /api/contacts/:id` - Delete contact
- `POST /api/transcribe` - Transcribe audio to text
- `POST /api/analyze-context` - AI analysis of contact context
- `POST /api/generate-message` - Generate follow-up message
- `GET /api/follow-ups` - Get contacts needing follow-up

## 📱 How It Works (Mobile App)

### The Magic Flow:

1. **🤝 Meet Someone**
   - You're at a conference, networking event, or coffee meeting
   - Exchange contact information

2. **📞 Add to Phone**
   - Add their number to your phone's contact app (iOS/Android)
   - Context CRM is monitoring in the background

3. **🔔 Instant Notification (< 60 sec)**
   - Notification appears: *"You just added Sarah Chen. Capture context while it's fresh!"*
   - Contact details already pre-filled from phone

4. **🎙️ Voice Context Capture**
   - Tap notification → Opens context capture screen
   - Press record and speak naturally:
     - *"Met Sarah at AI Summit in the automation booth. She's VP of Ops at a logistics company, really interested in AI phone agents for customer service. Said they handle 10,000+ calls monthly. Asked me to send proposal. Hot lead."*

5. **🤖 AI Processing**
   - Automatic transcription (Whisper)
   - AI extracts:
     - Summary: *"Met at AI Summit, VP of Ops at logistics company, interested in AI phone agents"*
     - Topics: *[AI phone agents, logistics, customer service]*
     - Follow-up: *Send proposal*
     - Priority: *Hot (24 hours)*

6. **💾 Smart Storage**
   - All context saved with contact
   - Added to follow-up queue
   - Searchable by topics, location, date

7. **📅 Follow-up Reminders**
   - Dashboard shows: *"Sarah Chen - Send proposal about AI phone agents (DUE TODAY)"*
   - Tap "Generate Message" → AI writes personalized email (3 tones)
   - Copy, send, mark as contacted

### Web Interface Usage:

1. **Manual Add**: Click "Add Contact" button
2. **Record**: Voice note with context
3. **Tag**: Quick categorization
4. **Search**: Find by name, venue, topics
5. **Follow-up**: Priority-based dashboard

## 🔐 Privacy & Security

- **Opt-in monitoring** - You control when it's active
- **Local-first** - Data stored on your device
- **Explicit uploads** - Only sent to server when you save
- **Encrypted voice notes** - At rest encryption
- **Clear permissions** - Transparent about what we access
- **No automatic cloud sync** - Your data, your control
- **Export/delete anytime** - Full data ownership

## ⚙️ Configuration

### Mobile App Settings
- Enable/disable automatic contact monitoring
- Adjust notification preferences
- Set monitoring intervals
- Test notifications

### Backend (.env)
```bash
OPENAI_API_KEY=your_key_here
PORT=5000
DB_PATH=./data/contacts.db
```

## 🎯 Use Cases

- **Networking Events** - Capture context for dozens of contacts quickly
- **Conferences** - Remember who you met and what you discussed
- **Sales Meetings** - Track client conversations and follow-ups
- **Job Hunting** - Remember recruiters and hiring managers
- **Entrepreneurship** - Manage investor and partner relationships
- **Community Building** - Stay connected with community members

## 🐛 Troubleshooting

### Mobile App

**Notifications not appearing?**
- Check notification permissions in Settings
- Enable "Auto-Detect New Contacts" in app Settings
- Test with "Send Test Notification" button

**Contact monitoring not working?**
- Grant contact permission when prompted
- Verify app is not battery restricted
- Check background app refresh is enabled (iOS)

**Background monitoring stopped?**
- Restart app
- Re-enable monitoring in Settings
- Check battery optimization settings

### Web Interface

**Voice recording not working?**
- Grant microphone permission
- Use HTTPS or localhost
- Check browser compatibility

## 📚 Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Detailed system architecture
- [Mobile App README](./mobile/README.md) - Mobile-specific docs
- [API Documentation](#api-endpoints) - Backend API reference

## 🤝 Contributing

Contributions welcome! Please read our contributing guidelines first.

## 📄 License

MIT
