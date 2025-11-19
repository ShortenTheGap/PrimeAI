const path = require('path');

// Check if we're using PostgreSQL or SQLite
const isProduction = process.env.NODE_ENV === 'production';
const usePostgres = !!process.env.DATABASE_URL;

let db;
let isConnected = false;

if (usePostgres) {
  // Use PostgreSQL for production (Railway)
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  // Initialize PostgreSQL schema
  const initPostgres = async () => {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS contacts (
          contact_id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          phone TEXT,
          email TEXT,
          photo_url TEXT,
          recording_uri TEXT,
          has_recording BOOLEAN DEFAULT FALSE,
          transcript TEXT,
          analysis TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      console.log('✅ PostgreSQL database initialized');
      isConnected = true;
    } catch (error) {
      console.error('❌ PostgreSQL initialization error:', error);
      isConnected = false;
    }
  };

  initPostgres();

  db = {
    // Get all contacts
    getAllContacts: async () => {
      const result = await pool.query('SELECT * FROM contacts ORDER BY created_at DESC');
      return result.rows;
    },

    // Get contact by ID
    getContactById: async (id) => {
      const result = await pool.query('SELECT * FROM contacts WHERE contact_id = $1', [id]);
      return result.rows[0];
    },

    // Create contact
    createContact: async (contact) => {
      const { name, phone, email, photo_url, recording_uri, has_recording, transcript, analysis } = contact;
      const result = await pool.query(
        `INSERT INTO contacts (name, phone, email, photo_url, recording_uri, has_recording, transcript, analysis)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [name, phone || null, email || null, photo_url || null, recording_uri || null, has_recording || false, transcript || null, analysis || null]
      );
      return result.rows[0];
    },

    // Update contact
    updateContact: async (id, contact) => {
      const { name, phone, email, photo_url, recording_uri, has_recording, transcript, analysis } = contact;
      const result = await pool.query(
        `UPDATE contacts
         SET name = $1, phone = $2, email = $3, photo_url = $4, recording_uri = $5,
             has_recording = $6, transcript = $7, analysis = $8, updated_at = CURRENT_TIMESTAMP
         WHERE contact_id = $9
         RETURNING *`,
        [name, phone, email, photo_url, recording_uri, has_recording, transcript, analysis, id]
      );
      return result.rows[0];
    },

    // Delete contact
    deleteContact: async (id) => {
      await pool.query('DELETE FROM contacts WHERE contact_id = $1', [id]);
      return true;
    }
  };

} else {
  // Use SQLite for local development
  const Database = require('better-sqlite3');
  const dbPath = path.join(__dirname, '../../data/contacts.db');
  const sqlite = new Database(dbPath);

  // Initialize SQLite schema
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      contact_id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      photo_url TEXT,
      recording_uri TEXT,
      has_recording INTEGER DEFAULT 0,
      transcript TEXT,
      analysis TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('✅ SQLite database initialized');
  isConnected = true;

  db = {
    // Get all contacts
    getAllContacts: async () => {
      const stmt = sqlite.prepare('SELECT * FROM contacts ORDER BY created_at DESC');
      return stmt.all();
    },

    // Get contact by ID
    getContactById: async (id) => {
      const stmt = sqlite.prepare('SELECT * FROM contacts WHERE contact_id = ?');
      return stmt.get(id);
    },

    // Create contact
    createContact: async (contact) => {
      const { name, phone, email, photo_url, recording_uri, has_recording, transcript, analysis } = contact;
      const stmt = sqlite.prepare(`
        INSERT INTO contacts (name, phone, email, photo_url, recording_uri, has_recording, transcript, analysis)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(name, phone || null, email || null, photo_url || null, recording_uri || null, has_recording ? 1 : 0, transcript || null, analysis || null);
      return db.getContactById(result.lastInsertRowid);
    },

    // Update contact
    updateContact: async (id, contact) => {
      const { name, phone, email, photo_url, recording_uri, has_recording, transcript, analysis } = contact;
      const stmt = sqlite.prepare(`
        UPDATE contacts
        SET name = ?, phone = ?, email = ?, photo_url = ?, recording_uri = ?,
            has_recording = ?, transcript = ?, analysis = ?, updated_at = CURRENT_TIMESTAMP
        WHERE contact_id = ?
      `);
      stmt.run(name, phone, email, photo_url, recording_uri, has_recording ? 1 : 0, transcript, analysis, id);
      return db.getContactById(id);
    },

    // Delete contact
    deleteContact: async (id) => {
      const stmt = sqlite.prepare('DELETE FROM contacts WHERE contact_id = ?');
      stmt.run(id);
      return true;
    }
  };
}

module.exports = { ...db, isConnected };
