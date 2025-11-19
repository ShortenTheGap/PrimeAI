const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const db = require('../database/db');

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
const sendToN8N = async (audioPath, contactData) => {
  try {
    // For now, we'll return a placeholder
    // In production, you'll configure the N8N webhook URL via environment variable
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;

    if (!n8nWebhookUrl) {
      console.log('⚠️ N8N webhook URL not configured, skipping transcription');
      return null;
    }

    const formData = new FormData();
    formData.append('audio', fs.createReadStream(audioPath));
    formData.append('contactData', JSON.stringify(contactData));

    const response = await axios.post(n8nWebhookUrl, formData, {
      headers: {
        ...formData.getHeaders(),
      },
      timeout: 60000, // 60 second timeout
    });

    return response.data;
  } catch (error) {
    console.error('Error sending to N8N:', error.message);
    return null;
  }
};

// GET all contacts
router.get('/', async (req, res) => {
  try {
    const contacts = await db.getAllContacts();
    res.json(contacts);
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

// GET single contact
router.get('/:id', async (req, res) => {
  try {
    const contact = await db.getContactById(req.params.id);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json(contact);
  } catch (error) {
    console.error('Error fetching contact:', error);
    res.status(500).json({ error: 'Failed to fetch contact' });
  }
});

// POST new contact
router.post('/', upload.single('audio'), async (req, res) => {
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

      // Send to N8N for transcription (async, don't wait)
      const audioPath = path.join(__dirname, '../../uploads', req.file.filename);
      sendToN8N(audioPath, { name, phone, email }).catch(err => {
        console.error('N8N processing error:', err);
      });
    }

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

    const newContact = await db.createContact(contactData);

    console.log('✅ Contact created:', newContact.contact_id);
    res.status(201).json(newContact);
  } catch (error) {
    console.error('Error creating contact:', error);
    res.status(500).json({ error: error.message || 'Failed to create contact' });
  }
});

// PUT update contact
router.put('/:id', upload.single('audio'), async (req, res) => {
  try {
    const { name, phone, email, photoUrl } = req.body;
    const contactId = req.params.id;

    // Get existing contact
    const existingContact = await db.getContactById(contactId);
    if (!existingContact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    let recording_uri = existingContact.recording_uri;
    let has_recording = existingContact.has_recording;

    // Handle new audio file if uploaded
    if (req.file) {
      // Delete old audio file if exists
      if (existingContact.recording_uri) {
        const oldPath = path.join(__dirname, '../..', existingContact.recording_uri);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }

      recording_uri = `/uploads/${req.file.filename}`;
      has_recording = true;

      // Send to N8N for transcription (async, don't wait)
      const audioPath = path.join(__dirname, '../../uploads', req.file.filename);
      sendToN8N(audioPath, { name, phone, email }).catch(err => {
        console.error('N8N processing error:', err);
      });
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

    const updatedContact = await db.updateContact(contactId, contactData);

    console.log('✅ Contact updated:', contactId);
    res.json(updatedContact);
  } catch (error) {
    console.error('Error updating contact:', error);
    res.status(500).json({ error: error.message || 'Failed to update contact' });
  }
});

// PATCH update transcript (called by N8N webhook)
router.patch('/:id/transcript', async (req, res) => {
  try {
    const { transcript, analysis } = req.body;
    const contactId = req.params.id;

    const existingContact = await db.getContactById(contactId);
    if (!existingContact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const contactData = {
      ...existingContact,
      transcript: transcript || existingContact.transcript,
      analysis: analysis || existingContact.analysis
    };

    const updatedContact = await db.updateContact(contactId, contactData);

    console.log('✅ Transcript updated for contact:', contactId);
    res.json(updatedContact);
  } catch (error) {
    console.error('Error updating transcript:', error);
    res.status(500).json({ error: 'Failed to update transcript' });
  }
});

// DELETE contact
router.delete('/:id', async (req, res) => {
  try {
    const contactId = req.params.id;

    // Get contact to delete associated files
    const contact = await db.getContactById(contactId);
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

    await db.deleteContact(contactId);

    console.log('✅ Contact deleted:', contactId);
    res.json({ message: 'Contact deleted successfully' });
  } catch (error) {
    console.error('Error deleting contact:', error);
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

module.exports = router;
