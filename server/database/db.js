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
      // Create users table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          user_id TEXT PRIMARY KEY,
          device_id TEXT UNIQUE NOT NULL,
          device_name TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create contacts table with user_id
      await pool.query(`
        CREATE TABLE IF NOT EXISTS contacts (
          contact_id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          phone TEXT,
          email TEXT,
          photo_url TEXT,
          recording_uri TEXT,
          has_recording BOOLEAN DEFAULT FALSE,
          transcript TEXT,
          analysis TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        )
      `);

      // Create index for faster user queries
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id)
      `);

      console.log('✅ PostgreSQL database initialized with multi-user support');
      isConnected = true;
    } catch (error) {
      console.error('❌ PostgreSQL initialization error:', error);
      isConnected = false;
    }
  };

  initPostgres();

  db = {
    // User management
    createUser: async (userId, deviceId, deviceName) => {
      const result = await pool.query(
        `INSERT INTO users (user_id, device_id, device_name)
         VALUES ($1, $2, $3)
         ON CONFLICT (device_id) DO UPDATE SET user_id = EXCLUDED.user_id
         RETURNING *`,
        [userId, deviceId, deviceName || 'Unknown Device']
      );
      return result.rows[0];
    },

    getUserByDeviceId: async (deviceId) => {
      const result = await pool.query('SELECT * FROM users WHERE device_id = $1', [deviceId]);
      return result.rows[0];
    },

    // Get all contacts for a user
    getAllContacts: async (userId) => {
      const result = await pool.query(
        'SELECT * FROM contacts WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );
      return result.rows;
    },

    // Get contact by ID (with user verification)
    getContactById: async (id, userId) => {
      const result = await pool.query(
        'SELECT * FROM contacts WHERE contact_id = $1 AND user_id = $2',
        [id, userId]
      );
      return result.rows[0];
    },

    // Create contact
    createContact: async (contact, userId) => {
      const { name, phone, email, photo_url, recording_uri, has_recording, transcript, analysis } = contact;
      const result = await pool.query(
        `INSERT INTO contacts (user_id, name, phone, email, photo_url, recording_uri, has_recording, transcript, analysis)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [userId, name, phone || null, email || null, photo_url || null, recording_uri || null, has_recording || false, transcript || null, analysis || null]
      );
      return result.rows[0];
    },

    // Update contact
    updateContact: async (id, contact, userId) => {
      const { name, phone, email, photo_url, recording_uri, has_recording, transcript, analysis } = contact;
      const result = await pool.query(
        `UPDATE contacts
         SET name = $1, phone = $2, email = $3, photo_url = $4, recording_uri = $5,
             has_recording = $6, transcript = $7, analysis = $8, updated_at = CURRENT_TIMESTAMP
         WHERE contact_id = $9 AND user_id = $10
         RETURNING *`,
        [name, phone, email, photo_url, recording_uri, has_recording, transcript, analysis, id, userId]
      );
      return result.rows[0];
    },

    // Delete contact
    deleteContact: async (id, userId) => {
      await pool.query('DELETE FROM contacts WHERE contact_id = $1 AND user_id = $2', [id, userId]);
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
    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      device_id TEXT UNIQUE NOT NULL,
      device_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS contacts (
      contact_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      photo_url TEXT,
      recording_uri TEXT,
      has_recording INTEGER DEFAULT 0,
      transcript TEXT,
      analysis TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
  `);

  console.log('✅ SQLite database initialized with multi-user support');
  isConnected = true;

  db = {
    // User management
    createUser: async (userId, deviceId, deviceName) => {
      const stmt = sqlite.prepare(`
        INSERT INTO users (user_id, device_id, device_name)
        VALUES (?, ?, ?)
        ON CONFLICT (device_id) DO UPDATE SET user_id = excluded.user_id
      `);
      stmt.run(userId, deviceId, deviceName || 'Unknown Device');
      return db.getUserByDeviceId(deviceId);
    },

    getUserByDeviceId: async (deviceId) => {
      const stmt = sqlite.prepare('SELECT * FROM users WHERE device_id = ?');
      return stmt.get(deviceId);
    },

    // Get all contacts for a user
    getAllContacts: async (userId) => {
      const stmt = sqlite.prepare('SELECT * FROM contacts WHERE user_id = ? ORDER BY created_at DESC');
      return stmt.all(userId);
    },

    // Get contact by ID (with user verification)
    getContactById: async (id, userId) => {
      const stmt = sqlite.prepare('SELECT * FROM contacts WHERE contact_id = ? AND user_id = ?');
      return stmt.get(id, userId);
    },

    // Create contact
    createContact: async (contact, userId) => {
      const { name, phone, email, photo_url, recording_uri, has_recording, transcript, analysis } = contact;
      const stmt = sqlite.prepare(`
        INSERT INTO contacts (user_id, name, phone, email, photo_url, recording_uri, has_recording, transcript, analysis)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(userId, name, phone || null, email || null, photo_url || null, recording_uri || null, has_recording ? 1 : 0, transcript || null, analysis || null);
      return db.getContactById(result.lastInsertRowid, userId);
    },

    // Update contact
    updateContact: async (id, contact, userId) => {
      const { name, phone, email, photo_url, recording_uri, has_recording, transcript, analysis } = contact;
      const stmt = sqlite.prepare(`
        UPDATE contacts
        SET name = ?, phone = ?, email = ?, photo_url = ?, recording_uri = ?,
            has_recording = ?, transcript = ?, analysis = ?, updated_at = CURRENT_TIMESTAMP
        WHERE contact_id = ? AND user_id = ?
      `);
      stmt.run(name, phone, email, photo_url, recording_uri, has_recording ? 1 : 0, transcript, analysis, id, userId);
      return db.getContactById(id, userId);
    },

    // Delete contact
    deleteContact: async (id, userId) => {
      const stmt = sqlite.prepare('DELETE FROM contacts WHERE contact_id = ? AND user_id = ?');
      stmt.run(id, userId);
      return true;
    }
  };
}

module.exports = { ...db, isConnected };
