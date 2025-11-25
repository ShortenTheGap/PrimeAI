const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const db = require('../database/db');

// Middleware to extract and verify user_id from headers
const authenticateUser = (req, res, next) => {
  const userId = req.headers['x-user-id'];

  if (!userId) {
    return res.status(401).json({ error: 'User authentication required' });
  }

  req.userId = userId;
  next();
};

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
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
        cb(new Error('Only audio files are allowed'));
      }
    } else {
      cb(null, true);
    }
  }
});

// Send audio to N8N for transcription
const sendToN8N = async (audioPath, contactData, photoUrl = null, contactId = null) => {
  try {
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;

    if (!n8nWebhookUrl) {
      console.log('⚠️ N8N webhook URL not configured, skipping transcription');
      return null;
    }

    // Read audio file and convert to base64
    const audioBuffer = fs.readFileSync(audioPath);
    const audioBase64 = `data:audio/m4a;base64,${audioBuffer.toString('base64')}`;

    // Build complete payload matching the mobile app webhook format
    const payload = {
      action: 'update',  // Update action for voice note transcription
      contact_id: contactId,  // CRITICAL: Include contact_id so N8N can send transcript back
      contact: {
        name: contactData.name,
        phone: contactData.phone || null,
        email: contactData.email || null,
      },
      audio_base64: audioBase64,
      hasRecording: true,
      photoUrl: photoUrl || null,
      hasPhoto: !!photoUrl,
      timestamp: new Date().toISOString(),
    };

    console.log('📤 Sending complete payload to N8N:', {
      action: payload.action,
      contact_id: contactId,
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

// GET all contacts (with authentication)
router.get('/', authenticateUser, async (req, res) => {
  try {
    const contacts = await db.getAllContacts(req.userId);
    res.json(contacts);
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

// POST new contact (with authentication)
router.post('/', authenticateUser, upload.single('audio'), async (req, res) => {
  try {
    const { name, phone, email, photoUrl } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    let recording_uri = null;
    let has_recording = false;

    // Handle audio file if uploaded
    if (req.file) {
      recording_uri = `/uploads/${req.file.filename}`;
      has_recording = true;
    }

    // Create contact first to get contact_id
    const contactData = {
      name,
      phone: phone || null,
      email: email || null,
      photo_url: photoUrl || null,
      recording_uri,
      has_recording,
      transcript: null,
      analysis: null
    };

    const newContact = await db.createContact(contactData, req.userId);
    console.log('✅ Contact created:', newContact.contact_id, 'for user:', req.userId);

    let webhook_status = 'not_sent';

    // NOW send to N8N with contact_id (async, don't wait)
    if (req.file) {
      const audioPath = path.join(__dirname, '../../uploads', req.file.filename);
      const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;

      if (n8nWebhookUrl) {
        webhook_status = 'sent';
        console.log('📤 Sending complete contact data to N8N webhook for processing...');
        sendToN8N(audioPath, { name, phone, email }, photoUrl, newContact.contact_id).catch(err => {
          console.error('❌ N8N processing error:', err);
        });
      } else {
        webhook_status = 'not_configured';
        console.log('⚠️ N8N_WEBHOOK_URL not configured - skipping webhook');
      }
    }

    res.status(201).json({
      ...newContact,
      webhook_status,
      has_recording
    });
  } catch (error) {
    console.error('Error creating contact:', error);
    res.status(500).json({ error: error.message || 'Failed to create contact' });
  }
});

// PUT update contact (with authentication)
router.put('/:id', authenticateUser, upload.single('audio'), async (req, res) => {
  try {
    const { name, phone, email, photoUrl } = req.body;
    const contactId = req.params.id;

    console.log('🔄 PUT /api/contacts/' + contactId, {
      hasAudioFile: !!req.file,
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
    });

    let recording_uri = existingContact.recording_uri;
    let has_recording = existingContact.has_recording;
    let webhook_status = 'not_sent';

    // Handle new audio file if uploaded
    if (req.file) {
      console.log('🎙️ New audio file detected:', req.file.filename);

      // Delete old audio file if exists
      if (existingContact.recording_uri) {
        const oldPath = path.join(__dirname, '../..', existingContact.recording_uri);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
          console.log('🗑️ Deleted old recording:', existingContact.recording_uri);
        }
      }

      recording_uri = `/uploads/${req.file.filename}`;
      has_recording = true;

      console.log('✅ Recording URI set to:', recording_uri);

      // Send to N8N for transcription (async, don't wait)
      const audioPath = path.join(__dirname, '../../uploads', req.file.filename);
      const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;

      if (n8nWebhookUrl) {
        webhook_status = 'sent';
        console.log('📤 Sending complete contact data to N8N webhook for processing (update)...');
        sendToN8N(audioPath, { name, phone, email }, photoUrl, contactId).catch(err => {
          console.error('❌ N8N processing error:', err);
        });
      } else {
        webhook_status = 'not_configured';
        console.log('⚠️ N8N_WEBHOOK_URL not configured - skipping webhook');
      }
    }

    const contactData = {
      name: name || existingContact.name,
      phone: phone !== undefined ? phone : existingContact.phone,
      email: email !== undefined ? email : existingContact.email,
      photo_url: photoUrl !== undefined ? photoUrl : existingContact.photo_url,
      recording_uri,
      has_recording,
      transcript: existingContact.transcript,
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
      webhook_status,
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
