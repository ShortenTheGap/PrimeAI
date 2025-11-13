# Context-Aware Contact Capture CRM

A mobile-first CRM application that solves the "who was that person?" problem when networking.

## Core Flow
**Contact Added → Immediate Context Capture → Smart Storage → Intelligent Retrieval**

## Features

### MVP (Week 1)
- ✅ Contact addition with voice note recording
- ✅ Voice-to-text transcription
- ✅ Context capture (location, tags, follow-up type)
- ✅ Contact list view with smart search
- ✅ Basic reminder/follow-up system

### Coming Soon (Week 2-3)
- AI summarization of voice notes
- Topic extraction from conversations
- Smart contextual search
- Follow-up dashboard
- AI-powered draft message generation

### Future Enhancements
- LinkedIn enrichment
- Company data enrichment
- Email/calendar integration
- Networking analytics
- Relationship strength scoring

## Tech Stack

- **Frontend:** React (mobile-first, progressive web app)
- **Backend:** Node.js/Express
- **Database:** SQLite (upgradeable to PostgreSQL)
- **AI:** OpenAI API (GPT-4 for summarization, Whisper for transcription)
- **Voice:** Web Audio API + OpenAI Whisper

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm run install-all
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env and add your OPENAI_API_KEY
   ```

4. Start development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000)

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

## Usage

1. **Add Contact**: Click "Add Contact" button
2. **Record Context**: Press and hold the record button to capture context via voice
3. **Add Details**: Quick-tag the contact type, set follow-up priority
4. **AI Processing**: System automatically transcribes and extracts key information
5. **Follow-up**: View dashboard for contacts needing follow-up
6. **Generate Message**: AI creates personalized outreach based on context

## Privacy & Security

- All voice notes encrypted at rest
- Local-first data storage
- Optional cloud sync
- GDPR compliant data handling

## License

MIT
