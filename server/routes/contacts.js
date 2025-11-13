const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database/init');
const multer = require('multer');
const path = require('path');

// Configure multer for voice note uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /audio\/(wav|mp3|m4a|mpeg|webm|ogg)/;
    if (allowedTypes.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid audio file type'));
    }
  }
});

// GET all contacts with optional filters
router.get('/', (req, res) => {
  try {
    const { search, tag, status, priority, limit = 100, offset = 0 } = req.query;

    let query = 'SELECT * FROM contacts WHERE 1=1';
    const params = [];

    // Search by name, venue, or topics
    if (search) {
      query += ` AND (name LIKE ? OR venue_name LIKE ? OR topics_discussed LIKE ? OR transcription LIKE ?)`;
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam);
    }

    // Filter by tag
    if (tag) {
      query += ` AND tags LIKE ?`;
      params.push(`%${tag}%`);
    }

    // Filter by status
    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }

    // Filter by priority
    if (priority) {
      query += ` AND follow_up_priority = ?`;
      params.push(priority);
    }

    query += ` ORDER BY date_added DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const contacts = db.prepare(query).all(...params);

    // Parse JSON fields
    const formattedContacts = contacts.map(contact => ({
      ...contact,
      topics_discussed: contact.topics_discussed ? JSON.parse(contact.topics_discussed) : [],
      tags: contact.tags ? JSON.parse(contact.tags) : [],
      enrichment_data: contact.enrichment_data ? JSON.parse(contact.enrichment_data) : null
    }));

    res.json({
      success: true,
      count: formattedContacts.length,
      contacts: formattedContacts
    });
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET single contact by ID
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const contact = db.prepare('SELECT * FROM contacts WHERE contact_id = ?').get(id);

    if (!contact) {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }

    // Parse JSON fields
    const formattedContact = {
      ...contact,
      topics_discussed: contact.topics_discussed ? JSON.parse(contact.topics_discussed) : [],
      tags: contact.tags ? JSON.parse(contact.tags) : [],
      enrichment_data: contact.enrichment_data ? JSON.parse(contact.enrichment_data) : null
    };

    res.json({ success: true, contact: formattedContact });
  } catch (error) {
    console.error('Error fetching contact:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST create new contact
router.post('/', upload.single('voiceNote'), (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      location_lat,
      location_long,
      location_address,
      venue_name,
      transcription,
      ai_summary,
      topics_discussed,
      follow_up_type,
      follow_up_priority,
      follow_up_date,
      tags,
      linkedin_url,
      company_name,
      status
    } = req.body;

    const contact_id = uuidv4();
    const date_added = new Date().toISOString();
    const raw_voice_note_path = req.file ? req.file.path : null;

    const stmt = db.prepare(`
      INSERT INTO contacts (
        contact_id, name, phone, email, date_added,
        location_lat, location_long, location_address, venue_name,
        raw_voice_note_path, transcription, ai_summary,
        topics_discussed, follow_up_type, follow_up_priority,
        follow_up_date, tags, linkedin_url, company_name, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      contact_id, name, phone || null, email || null, date_added,
      location_lat || null, location_long || null, location_address || null, venue_name || null,
      raw_voice_note_path, transcription || null, ai_summary || null,
      topics_discussed || null, follow_up_type || null, follow_up_priority || 'warm',
      follow_up_date || null, tags || null, linkedin_url || null, company_name || null,
      status || 'new'
    );

    res.status(201).json({
      success: true,
      message: 'Contact created successfully',
      contact_id,
      changes: info.changes
    });
  } catch (error) {
    console.error('Error creating contact:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT update contact
router.put('/:id', upload.single('voiceNote'), (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Check if contact exists
    const existing = db.prepare('SELECT * FROM contacts WHERE contact_id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }

    // Handle voice note update
    if (req.file) {
      updates.raw_voice_note_path = req.file.path;
    }

    // Build dynamic update query
    const fields = Object.keys(updates).filter(key => updates[key] !== undefined);
    if (fields.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const values = fields.map(field => updates[field]);
    values.push(new Date().toISOString()); // updated_at
    values.push(id);

    const stmt = db.prepare(`
      UPDATE contacts
      SET ${setClause}, updated_at = ?
      WHERE contact_id = ?
    `);

    const info = stmt.run(...values);

    res.json({
      success: true,
      message: 'Contact updated successfully',
      changes: info.changes
    });
  } catch (error) {
    console.error('Error updating contact:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE contact
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;

    const stmt = db.prepare('DELETE FROM contacts WHERE contact_id = ?');
    const info = stmt.run(id);

    if (info.changes === 0) {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }

    res.json({
      success: true,
      message: 'Contact deleted successfully',
      changes: info.changes
    });
  } catch (error) {
    console.error('Error deleting contact:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET follow-ups (with filtering by timeframe)
router.get('/follow-ups/list', (req, res) => {
  try {
    const { timeframe = 'all' } = req.query;

    let query = 'SELECT * FROM follow_ups_view WHERE 1=1';

    if (timeframe !== 'all') {
      query += ` AND follow_up_status = ?`;
    }

    const followUps = timeframe === 'all'
      ? db.prepare(query).all()
      : db.prepare(query).all(timeframe);

    res.json({
      success: true,
      count: followUps.length,
      follow_ups: followUps
    });
  } catch (error) {
    console.error('Error fetching follow-ups:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
