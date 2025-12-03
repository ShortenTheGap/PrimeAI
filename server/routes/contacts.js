const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const jwt = require('jsonwebtoken');
const OpenAI = require('openai');
const db = require('../database/db');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// Initialize OpenAI client
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

// Middleware to extract and verify user authentication (JWT or device-based)
const authenticateUser = async (req, res, next) => {
  try {
    // Check for JWT token first (email/password auth)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId;

        // Check subscription status
        const user = await db.getUserById(decoded.userId);
        if (user && user.subscription_status === 'suspended') {
          return res.status(403).json({
            error: 'Account suspended',
            message: 'Your account has been suspended. Please contact support.'
          });
        }

        // Update last login
        await db.updateLastLogin(decoded.userId);

        return next();
      } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
    }

    // Fallback to device-based auth (x-user-id header) for backward compatibility
    const userId = req.headers['x-user-id'];
    if (userId) {
      // Check subscription status for device-based auth too
      const user = await db.getUserById(userId);
      if (user && user.subscription_status === 'suspended') {
        return res.status(403).json({
          error: 'Account suspended',
          message: 'Your account has been suspended. Please contact support.'
        });
      }

      req.userId = userId;
      return next();
    }

    // No valid authentication found
    return res.status(401).json({ error: 'User authentication required' });
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

// Configure multer for file uploads (audio and photos)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Organize uploads into subdirectories based on file type
    const baseDir = path.join(__dirname, '../../uploads');
    let uploadDir;

    if (file.fieldname === 'audio') {
      uploadDir = path.join(baseDir, 'audio');
    } else if (file.fieldname === 'photo') {
      uploadDir = path.join(baseDir, 'photos');
    } else {
      uploadDir = baseDir;
    }

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'audio') {
      // Accept audio files
      if (file.mimetype.startsWith('audio/')) {
        cb(null, true);
      } else {
        cb(new Error('Only audio files are allowed for audio field'));
      }
    } else if (file.fieldname === 'photo') {
      // Accept image files
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed for photo field'));
      }
    } else {
      cb(null, true);
    }
  }
});

// Transcribe audio using OpenAI Whisper
const transcribeAudio = async (audioPath) => {
  if (!openai) {
    console.log('⚠️ OpenAI not configured - skipping automatic transcription');
    return null;
  }

  try {
    console.log('🎙️ Starting automatic transcription with OpenAI Whisper...');

    const response = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: 'whisper-1',
      language: 'en', // Can be made configurable
    });

    const transcript = response.text;
    console.log('✅ Transcription complete:', transcript.substring(0, 100) + '...');

    return transcript;
  } catch (error) {
    console.error('❌ OpenAI transcription error:', error.message);
    return null;
  }
};

// Send typed note to N8N webhook (OPTIONAL - for power users with custom integrations)
// Used when there's a typed note but no audio recording
const sendNoteToN8N = async (contactData, transcript, photoUrl = null, contactId = null, userId = null) => {
  try {
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;

    if (!n8nWebhookUrl) {
      console.log('⚠️ N8N webhook URL not configured, skipping note webhook');
      return null;
    }

    // Get backend URL from environment or construct it
    const backendUrl = process.env.BACKEND_URL || process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : 'http://localhost:3000';

    // Convert relative photo URL to absolute URL for SMS messages
    let fullPhotoUrl = photoUrl;
    if (photoUrl && photoUrl.startsWith('/uploads/')) {
      fullPhotoUrl = `${backendUrl}${photoUrl}`;
      console.log('📸 Converting photo URL for webhook:', photoUrl, '→', fullPhotoUrl);
    }

    // Build payload with typed note instead of audio
    const payload = {
      action: 'note',  // Indicates this is a typed note, not a voice recording
      contact_id: contactId,
      user_id: userId,
      contact: {
        name: contactData.name,
        phone: contactData.phone || null,
        email: contactData.email || null,
      },
      transcript: transcript,  // The typed note content
      hasRecording: false,  // No audio recording
      photoUrl: fullPhotoUrl || null,
      hasPhoto: !!fullPhotoUrl,
      timestamp: new Date().toISOString(),
    };

    console.log('📤 Sending typed note to N8N:', {
      action: payload.action,
      contact_id: contactId,
      user_id: userId,
      contact: payload.contact.name,
      hasTranscript: !!transcript,
      transcriptPreview: transcript?.substring(0, 50) + '...',
      hasPhoto: !!photoUrl,
    });

    const response = await axios.post(n8nWebhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 second timeout
    });

    return response.data;
  } catch (error) {
    console.error('Error sending note to N8N:', error.message);
    return null;
  }
};

// Send audio to N8N for transcription (OPTIONAL - for power users with custom integrations)
const sendToN8N = async (audioPath, contactData, photoUrl = null, contactId = null, userId = null) => {
  try {
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;

    if (!n8nWebhookUrl) {
      console.log('⚠️ N8N webhook URL not configured, skipping transcription');
      return null;
    }

    // Read audio file and convert to base64
    const audioBuffer = fs.readFileSync(audioPath);
    const audioBase64 = `data:audio/m4a;base64,${audioBuffer.toString('base64')}`;

    // Get backend URL from environment or construct it
    const backendUrl = process.env.BACKEND_URL || process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : 'http://localhost:3000';

    // Build callback URL for N8N to send transcript back
    const callbackUrl = `${backendUrl}/api/contacts/${contactId}/transcript`;

    // Convert relative photo URL to absolute URL for SMS messages
    let fullPhotoUrl = photoUrl;
    if (photoUrl && photoUrl.startsWith('/uploads/')) {
      fullPhotoUrl = `${backendUrl}${photoUrl}`;
      console.log('📸 Converting photo URL for SMS:', photoUrl, '→', fullPhotoUrl);
    }

    // Build complete payload matching the mobile app webhook format
    const payload = {
      action: 'update',  // Update action for voice note transcription
      contact_id: contactId,  // CRITICAL: Include contact_id so N8N can send transcript back
      user_id: userId,  // CRITICAL: Include user_id so N8N can send transcript back to correct user
      callback_url: callbackUrl,  // CRITICAL: URL where N8N should POST the transcript
      contact: {
        name: contactData.name,
        phone: contactData.phone || null,
        email: contactData.email || null,
      },
      audio_base64: audioBase64,
      hasRecording: true,
      photoUrl: fullPhotoUrl || null,
      hasPhoto: !!fullPhotoUrl,
      timestamp: new Date().toISOString(),
    };

    console.log('📤 Sending complete payload to N8N:', {
      action: payload.action,
      contact_id: contactId,
      user_id: userId,
      callback_url: callbackUrl,
      contact: payload.contact.name,
      hasRecording: true,
      hasPhoto: !!photoUrl,
    });

    const response = await axios.post(n8nWebhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 60000, // 60 second timeout
    });

    return response.data;
  } catch (error) {
    console.error('Error sending to N8N:', error.message);
    return null;
  }
};

// GET all contacts (with authentication and optional incremental sync)
router.get('/', authenticateUser, async (req, res) => {
  try {
    const { since } = req.query; // Optional timestamp to get only contacts modified after this time

    if (since) {
      // Incremental sync: only return contacts modified since the given timestamp
      const sinceDate = new Date(parseInt(since, 10));
      console.log(`📅 Incremental sync requested: contacts since ${sinceDate.toISOString()}`);

      const contacts = await db.getAllContacts(req.userId);
      const recentContacts = contacts.filter(contact => {
        const updatedAt = new Date(contact.updated_at || contact.created_at);
        return updatedAt > sinceDate;
      });

      console.log(`✅ Returning ${recentContacts.length} contacts modified since ${sinceDate.toISOString()}`);
      res.json(recentContacts);
    } else {
      // Full sync: return all contacts
      const contacts = await db.getAllContacts(req.userId);
      res.json(contacts);
    }
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

// GET single contact (with authentication)
router.get('/:id', authenticateUser, async (req, res) => {
  try {
    const contact = await db.getContactById(req.params.id, req.userId);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json(contact);
  } catch (error) {
    console.error('Error fetching contact:', error);
    res.status(500).json({ error: 'Failed to fetch contact' });
  }
});

// POST upload photo only (returns hosted URL for use before contact is saved)
router.post('/upload-photo', authenticateUser, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No photo file provided' });
    }

    // Get the backend URL for constructing the full photo URL
    const backendUrl = process.env.BACKEND_URL || process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : 'http://localhost:5000';

    const photoUrl = `${backendUrl}/uploads/photos/${req.file.filename}`;

    console.log('📸 Photo uploaded:', req.file.filename, '→', photoUrl);

    res.json({
      photoUrl,
      filename: req.file.filename
    });
  } catch (error) {
    console.error('Error uploading photo:', error);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

// POST new contact (with authentication)
router.post('/', authenticateUser, upload.fields([{ name: 'audio', maxCount: 1 }, { name: 'photo', maxCount: 1 }]), async (req, res) => {
  try {
    const { name, phone, email, photoUrl, transcript: typedNote } = req.body;

    // Debug: Log what files were received
    console.log('📥 POST /api/contacts - Files received:', {
      hasAudioFile: !!(req.files && req.files.audio),
      hasPhotoFile: !!(req.files && req.files.photo),
      hasTypedNote: !!typedNote,
      audioCount: req.files && req.files.audio ? req.files.audio.length : 0,
      photoCount: req.files && req.files.photo ? req.files.photo.length : 0,
      allFiles: req.files ? Object.keys(req.files) : [],
    });

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    let recording_uri = null;
    let has_recording = false;
    let photo_url = photoUrl || null;
    let transcript = typedNote || null; // Use typed note if provided

    // Handle audio file if uploaded
    if (req.files && req.files.audio && req.files.audio[0]) {
      const audioFile = req.files.audio[0];
      recording_uri = `/uploads/audio/${audioFile.filename}`;
      has_recording = true;
      transcript = null; // Will be set by transcription
      console.log('📁 Audio file uploaded:', audioFile.filename);
    }

    // Handle photo file if uploaded (replaces Cloudinary)
    if (req.files && req.files.photo && req.files.photo[0]) {
      const photoFile = req.files.photo[0];
      photo_url = `/uploads/photos/${photoFile.filename}`;
      console.log('📸 Photo uploaded locally:', photoFile.filename);
    }

    // Create contact first to get contact_id
    const contactData = {
      name,
      phone: phone || null,
      email: email || null,
      photo_url,
      recording_uri,
      has_recording,
      transcript,
      analysis: null
    };

    const newContact = await db.createContact(contactData, req.userId);
    console.log('✅ Contact created:', newContact.contact_id, 'for user:', req.userId);

    let webhook_status = 'not_sent';
    let finalTranscript = transcript; // Preserve the typed note if no audio

    // Transcribe audio immediately if uploaded
    if (req.files && req.files.audio && req.files.audio[0]) {
      const audioFile = req.files.audio[0];
      const audioPath = path.join(__dirname, '../../uploads/audio', audioFile.filename);

      // Step 1: Automatic transcription with OpenAI (always, if configured)
      const transcribedText = await transcribeAudio(audioPath);

      if (transcribedText) {
        finalTranscript = transcribedText;
        // Update contact with transcript immediately
        await db.updateContact(newContact.contact_id, {
          ...newContact,
          transcript: transcribedText,
        }, req.userId);
        console.log('💾 Transcript saved to database');
      }

      // Step 2: OPTIONAL - Send to N8N for power users with custom integrations
      const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
      if (n8nWebhookUrl) {
        webhook_status = 'sent';
        console.log('📤 Sending complete contact data to N8N webhook (optional power user feature)...');
        sendToN8N(audioPath, { name, phone, email }, photo_url, newContact.contact_id, req.userId).catch(err => {
          console.error('❌ N8N processing error:', err);
        });
      } else {
        webhook_status = 'not_configured';
        console.log('ℹ️ N8N_WEBHOOK_URL not configured - skipping optional webhook');
      }
    } else if (transcript && transcript.trim()) {
      // No audio, but there's a typed note - send to N8N webhook
      const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
      if (n8nWebhookUrl) {
        webhook_status = 'sent';
        console.log('📤 Sending typed note to N8N webhook (no audio)...');
        sendNoteToN8N({ name, phone, email }, transcript, photo_url, newContact.contact_id, req.userId).catch(err => {
          console.error('❌ N8N note webhook error:', err);
        });
      } else {
        webhook_status = 'not_configured';
        console.log('ℹ️ N8N_WEBHOOK_URL not configured - skipping typed note webhook');
      }
    }

    res.status(201).json({
      ...newContact,
      transcript: finalTranscript, // Include transcript in response
      photo_url: newContact.photo_url || photo_url, // Explicitly include photo_url
      has_recording
    });
  } catch (error) {
    console.error('Error creating contact:', error);
    res.status(500).json({ error: error.message || 'Failed to create contact' });
  }
});

// PUT update contact (with authentication)
router.put('/:id', authenticateUser, upload.fields([{ name: 'audio', maxCount: 1 }, { name: 'photo', maxCount: 1 }]), async (req, res) => {
  try {
    const { name, phone, email, photoUrl, transcript: typedTranscript } = req.body;
    const contactId = req.params.id;

    console.log('🔄 PUT /api/contacts/' + contactId, {
      hasAudioFile: !!(req.files && req.files.audio),
      hasPhotoFile: !!(req.files && req.files.photo),
      name,
      phone,
      email,
      userId: req.userId,
    });

    console.log('📥 Full request body:', {
      name,
      phone,
      email,
      photoUrl,
      typedTranscript: typedTranscript ? typedTranscript.substring(0, 50) + '...' : null,
      phoneType: typeof phone,
      emailType: typeof email,
      phoneUndefined: phone === undefined,
      emailUndefined: email === undefined,
    });

    // Get existing contact
    const existingContact = await db.getContactById(contactId, req.userId);
    if (!existingContact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    console.log('📋 Existing contact:', {
      contact_id: existingContact.contact_id,
      name: existingContact.name,
      phone: existingContact.phone,
      email: existingContact.email,
      has_recording: existingContact.has_recording,
      recording_uri: existingContact.recording_uri,
      photo_url: existingContact.photo_url,
    });

    let recording_uri = existingContact.recording_uri;
    let has_recording = existingContact.has_recording;
    let photo_url = photoUrl !== undefined ? photoUrl : existingContact.photo_url;
    let webhook_status = 'not_sent';

    // Handle new photo file if uploaded
    if (req.files && req.files.photo && req.files.photo[0]) {
      const photoFile = req.files.photo[0];

      // Delete old photo file if exists and it's local
      if (existingContact.photo_url && existingContact.photo_url.startsWith('/uploads/')) {
        const oldPath = path.join(__dirname, '../..', existingContact.photo_url);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
          console.log('🗑️ Deleted old photo:', existingContact.photo_url);
        }
      }

      photo_url = `/uploads/photos/${photoFile.filename}`;
      console.log('📸 New photo uploaded locally:', photoFile.filename);
    }

    // Handle new audio file if uploaded
    let newTranscript = null;
    if (req.files && req.files.audio && req.files.audio[0]) {
      const audioFile = req.files.audio[0];
      console.log('🎙️ New audio file detected:', audioFile.filename);

      // Delete old audio file if exists
      if (existingContact.recording_uri) {
        const oldPath = path.join(__dirname, '../..', existingContact.recording_uri);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
          console.log('🗑️ Deleted old recording:', existingContact.recording_uri);
        }
      }

      recording_uri = `/uploads/audio/${audioFile.filename}`;
      has_recording = true;

      console.log('✅ Recording URI set to:', recording_uri);

      const audioPath = path.join(__dirname, '../../uploads/audio', audioFile.filename);

      // Step 1: Automatic transcription with OpenAI (always, if configured)
      newTranscript = await transcribeAudio(audioPath);

      // Step 2: OPTIONAL - Send to N8N for power users with custom integrations
      const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
      if (n8nWebhookUrl) {
        webhook_status = 'sent';
        console.log('📤 Sending complete contact data to N8N webhook (optional power user feature)...');
        sendToN8N(audioPath, { name, phone, email }, photo_url, contactId, req.userId).catch(err => {
          console.error('❌ N8N processing error:', err);
        });
      } else {
        webhook_status = 'not_configured';
        console.log('ℹ️ N8N_WEBHOOK_URL not configured - skipping optional webhook');
      }
    }

    // Determine transcript to use:
    // 1. If new audio was uploaded, use the transcription from that
    // 2. If a typed transcript was sent in request body, use that
    // 3. Otherwise keep existing transcript
    let finalTranscript = existingContact.transcript;
    let typedNoteChanged = false;
    if (newTranscript) {
      finalTranscript = newTranscript; // Transcription from new audio takes priority
    } else if (typedTranscript !== undefined && typedTranscript !== null) {
      const trimmedTranscript = typedTranscript.trim() || null;
      // Check if the note actually changed
      if (trimmedTranscript !== existingContact.transcript) {
        typedNoteChanged = true;
        console.log('📝 Note changed - old:', existingContact.transcript?.substring(0, 30), '→ new:', trimmedTranscript?.substring(0, 30));
      }
      finalTranscript = trimmedTranscript; // User edited the transcript/note
      console.log('📝 Using typed transcript from request:', finalTranscript?.substring(0, 50) + '...');
    }

    // Send webhook for typed note changes (when no new audio was uploaded)
    if (typedNoteChanged && finalTranscript && !newTranscript) {
      const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
      if (n8nWebhookUrl) {
        webhook_status = 'sent';
        console.log('📤 Sending updated typed note to N8N webhook...');
        sendNoteToN8N(
          { name: name || existingContact.name, phone: phone || existingContact.phone, email: email || existingContact.email },
          finalTranscript,
          photo_url,
          contactId,
          req.userId
        ).catch(err => {
          console.error('❌ N8N note webhook error:', err);
        });
      }
    }

    const contactData = {
      name: name || existingContact.name,
      phone: phone !== undefined ? phone : existingContact.phone,
      email: email !== undefined ? email : existingContact.email,
      photo_url,
      recording_uri,
      has_recording,
      transcript: finalTranscript,
      analysis: existingContact.analysis
    };

    console.log('💾 Updating contact with data:', {
      contact_id: contactId,
      name: contactData.name,
      phone: contactData.phone,
      email: contactData.email,
      has_recording,
      recording_uri,
    });

    const updatedContact = await db.updateContact(contactId, contactData, req.userId);

    console.log('✅ Contact updated successfully:', {
      contact_id: updatedContact.contact_id,
      name: updatedContact.name,
      phone: updatedContact.phone,
      email: updatedContact.email,
      has_recording: updatedContact.has_recording,
      recording_uri: updatedContact.recording_uri,
    });

    res.json({
      ...updatedContact,
    });
  } catch (error) {
    console.error('Error updating contact:', error);
    res.status(500).json({ error: error.message || 'Failed to update contact' });
  }
});

// PATCH update transcript (called by N8N webhook - no auth required for webhook callbacks)
router.patch('/:id/transcript', async (req, res) => {
  try {
    const { transcript, analysis, user_id } = req.body;
    const contactId = req.params.id;

    // Get contact (need user_id from webhook payload)
    const existingContact = await db.getContactById(contactId, user_id);
    if (!existingContact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const contactData = {
      ...existingContact,
      transcript: transcript || existingContact.transcript,
      analysis: analysis || existingContact.analysis
    };

    const updatedContact = await db.updateContact(contactId, contactData, user_id);

    console.log('✅ Transcript updated for contact:', contactId);
    res.json(updatedContact);
  } catch (error) {
    console.error('Error updating transcript:', error);
    res.status(500).json({ error: 'Failed to update transcript' });
  }
});

// DELETE contact (with authentication)
router.delete('/:id', authenticateUser, async (req, res) => {
  try {
    const contactId = req.params.id;

    // Get contact to delete associated files
    const contact = await db.getContactById(contactId, req.userId);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Delete audio file if exists
    if (contact.recording_uri) {
      const audioPath = path.join(__dirname, '../..', contact.recording_uri);
      if (fs.existsSync(audioPath)) {
        fs.unlinkSync(audioPath);
      }
    }

    await db.deleteContact(contactId, req.userId);

    console.log('✅ Contact deleted:', contactId, 'for user:', req.userId);
    res.json({ message: 'Contact deleted successfully' });
  } catch (error) {
    console.error('Error deleting contact:', error);
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

module.exports = router;
