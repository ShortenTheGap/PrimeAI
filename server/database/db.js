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
          email TEXT UNIQUE,
          password_hash TEXT,
          device_id TEXT UNIQUE,
          device_name TEXT,
          sms_credits INTEGER DEFAULT 0,
          sms_delivery_method TEXT DEFAULT 'twilio',
          is_admin BOOLEAN DEFAULT FALSE,
          subscription_status TEXT DEFAULT 'active',
          subscription_tier TEXT DEFAULT 'free',
          subscription_expires_at TIMESTAMP,
          last_login_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create contacts table with user_id
      await pool.query(`
        CREATE TABLE IF NOT EXISTS contacts (
          contact_id SERIAL PRIMARY KEY,
          user_id TEXT,
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

      // MIGRATION: Add user_id column if it doesn't exist
      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'contacts' AND column_name = 'user_id'
          ) THEN
            ALTER TABLE contacts ADD COLUMN user_id TEXT;
          END IF;
        END $$;
      `);

      // MIGRATION: Set a default user_id for existing contacts without one
      await pool.query(`
        UPDATE contacts
        SET user_id = 'legacy_user_' || contact_id::TEXT
        WHERE user_id IS NULL
      `);

      // MIGRATION: Make user_id NOT NULL after setting defaults
      await pool.query(`
        ALTER TABLE contacts ALTER COLUMN user_id SET NOT NULL
      `);

      // MIGRATION: Add email and password_hash columns to users if they don't exist
      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'users' AND column_name = 'email'
          ) THEN
            ALTER TABLE users ADD COLUMN email TEXT UNIQUE;
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'users' AND column_name = 'password_hash'
          ) THEN
            ALTER TABLE users ADD COLUMN password_hash TEXT;
          END IF;
        END $$;
      `);

      // MIGRATION: Make device_id nullable for email/password users
      await pool.query(`
        ALTER TABLE users ALTER COLUMN device_id DROP NOT NULL
      `);

      // MIGRATION: Add SMS-related columns to users table
      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'users' AND column_name = 'sms_credits'
          ) THEN
            ALTER TABLE users ADD COLUMN sms_credits INTEGER DEFAULT 0;
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'users' AND column_name = 'sms_delivery_method'
          ) THEN
            ALTER TABLE users ADD COLUMN sms_delivery_method TEXT DEFAULT 'twilio';
          END IF;
        END $$;
      `);

      // MIGRATION: Add admin and subscription columns to users table
      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'users' AND column_name = 'is_admin'
          ) THEN
            ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'users' AND column_name = 'subscription_status'
          ) THEN
            ALTER TABLE users ADD COLUMN subscription_status TEXT DEFAULT 'active';
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'users' AND column_name = 'subscription_tier'
          ) THEN
            ALTER TABLE users ADD COLUMN subscription_tier TEXT DEFAULT 'free';
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'users' AND column_name = 'subscription_expires_at'
          ) THEN
            ALTER TABLE users ADD COLUMN subscription_expires_at TIMESTAMP;
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'users' AND column_name = 'last_login_at'
          ) THEN
            ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP;
          END IF;
        END $$;
      `);

      // Create SMS logs table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS sms_logs (
          log_id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          contact_id INTEGER,
          phone_number TEXT NOT NULL,
          message_type TEXT NOT NULL,
          delivery_method TEXT NOT NULL,
          twilio_sid TEXT,
          status TEXT DEFAULT 'pending',
          error_message TEXT,
          credits_used INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        )
      `);

      // Create index for faster SMS log queries
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_sms_logs_user_id ON sms_logs(user_id)
      `);

      // MIGRATION: Create legacy users for existing contacts before adding foreign key
      await pool.query(`
        INSERT INTO users (user_id, device_id, email, password_hash, created_at)
        SELECT DISTINCT
          user_id,
          user_id, -- use user_id as device_id for legacy users
          user_id || '@legacy.local',
          'no_password_legacy_user',
          CURRENT_TIMESTAMP
        FROM contacts
        WHERE user_id LIKE 'legacy_user_%'
        AND user_id NOT IN (SELECT user_id FROM users)
        ON CONFLICT (user_id) DO NOTHING
      `);
      console.log('✅ Legacy users created for existing contacts');

      // Create index for faster user queries
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id)
      `);

      // Add foreign key constraint if it doesn't exist
      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'contacts_user_id_fkey'
          ) THEN
            ALTER TABLE contacts
            ADD CONSTRAINT contacts_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;
          END IF;
        END $$;
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

    getUserByEmail: async (email) => {
      const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      return result.rows[0];
    },

    getUserById: async (userId) => {
      const result = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
      return result.rows[0];
    },

    createUserWithPassword: async (email, passwordHash) => {
      const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const result = await pool.query(
        `INSERT INTO users (user_id, email, password_hash)
         VALUES ($1, $2, $3)
         RETURNING user_id, email, created_at`,
        [userId, email.toLowerCase(), passwordHash]
      );
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
    },

    // SMS-related functions
    getSMSCredits: async (userId) => {
      const result = await pool.query('SELECT sms_credits FROM users WHERE user_id = $1', [userId]);
      return result.rows[0]?.sms_credits || 0;
    },

    deductSMSCredits: async (userId, amount) => {
      await pool.query('UPDATE users SET sms_credits = sms_credits - $1 WHERE user_id = $2', [amount, userId]);
    },

    addSMSCredits: async (userId, amount) => {
      await pool.query('UPDATE users SET sms_credits = sms_credits + $1 WHERE user_id = $2', [amount, userId]);
    },

    setSMSDeliveryMethod: async (userId, method) => {
      await pool.query('UPDATE users SET sms_delivery_method = $1 WHERE user_id = $2', [method, userId]);
    },

    getSMSDeliveryMethod: async (userId) => {
      const result = await pool.query('SELECT sms_delivery_method FROM users WHERE user_id = $1', [userId]);
      return result.rows[0]?.sms_delivery_method || 'twilio';
    },

    logSMS: async (userId, contactId, phoneNumber, messageType, deliveryMethod, twilioSid, status, errorMessage, creditsUsed) => {
      const result = await pool.query(
        `INSERT INTO sms_logs (user_id, contact_id, phone_number, message_type, delivery_method, twilio_sid, status, error_message, credits_used)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [userId, contactId, phoneNumber, messageType, deliveryMethod, twilioSid || null, status, errorMessage || null, creditsUsed]
      );
      return result.rows[0];
    },

    getSMSLogs: async (userId, limit = 50) => {
      const result = await pool.query(
        'SELECT * FROM sms_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
        [userId, limit]
      );
      return result.rows;
    },

    // Admin functions
    getAllUsers: async () => {
      const result = await pool.query(`
        SELECT u.*,
               COUNT(c.contact_id) as contact_count
        FROM users u
        LEFT JOIN contacts c ON u.user_id = c.user_id
        GROUP BY u.user_id
        ORDER BY u.created_at DESC
      `);
      return result.rows;
    },

    updateUserSubscription: async (userId, status, tier, expiresAt) => {
      const result = await pool.query(
        `UPDATE users
         SET subscription_status = $1, subscription_tier = $2, subscription_expires_at = $3
         WHERE user_id = $4
         RETURNING *`,
        [status, tier, expiresAt, userId]
      );
      return result.rows[0];
    },

    setUserAdmin: async (userId, isAdmin) => {
      const result = await pool.query(
        'UPDATE users SET is_admin = $1 WHERE user_id = $2 RETURNING *',
        [isAdmin, userId]
      );
      return result.rows[0];
    },

    updateLastLogin: async (userId) => {
      await pool.query(
        'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE user_id = $1',
        [userId]
      );
    },

    getAdminStats: async () => {
      const usersResult = await pool.query('SELECT COUNT(*) as total FROM users');
      const activeResult = await pool.query("SELECT COUNT(*) as total FROM users WHERE subscription_status = 'active'");
      const contactsResult = await pool.query('SELECT COUNT(*) as total FROM contacts');
      const recentResult = await pool.query("SELECT COUNT(*) as total FROM users WHERE created_at > NOW() - INTERVAL '7 days'");

      return {
        totalUsers: parseInt(usersResult.rows[0].total),
        activeUsers: parseInt(activeResult.rows[0].total),
        totalContacts: parseInt(contactsResult.rows[0].total),
        newUsersLast7Days: parseInt(recentResult.rows[0].total)
      };
    },

    deleteUser: async (userId) => {
      // This will cascade delete all contacts for this user
      const result = await pool.query('DELETE FROM users WHERE user_id = $1 RETURNING *', [userId]);
      return result.rows[0];
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
      email TEXT UNIQUE,
      password_hash TEXT,
      device_id TEXT UNIQUE,
      device_name TEXT,
      sms_credits INTEGER DEFAULT 0,
      sms_delivery_method TEXT DEFAULT 'twilio',
      is_admin INTEGER DEFAULT 0,
      subscription_status TEXT DEFAULT 'active',
      subscription_tier TEXT DEFAULT 'free',
      subscription_expires_at DATETIME,
      last_login_at DATETIME,
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

    CREATE TABLE IF NOT EXISTS sms_logs (
      log_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      contact_id INTEGER,
      phone_number TEXT NOT NULL,
      message_type TEXT NOT NULL,
      delivery_method TEXT NOT NULL,
      twilio_sid TEXT,
      status TEXT DEFAULT 'pending',
      error_message TEXT,
      credits_used INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
    CREATE INDEX IF NOT EXISTS idx_sms_logs_user_id ON sms_logs(user_id);
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

    getUserByEmail: async (email) => {
      const stmt = sqlite.prepare('SELECT * FROM users WHERE email = ?');
      return stmt.get(email);
    },

    getUserById: async (userId) => {
      const stmt = sqlite.prepare('SELECT * FROM users WHERE user_id = ?');
      return stmt.get(userId);
    },

    createUserWithPassword: async (email, passwordHash) => {
      const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const stmt = sqlite.prepare(`
        INSERT INTO users (user_id, email, password_hash)
        VALUES (?, ?, ?)
      `);
      stmt.run(userId, email.toLowerCase(), passwordHash);
      return db.getUserByEmail(email);
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
    },

    // SMS-related functions
    getSMSCredits: async (userId) => {
      const stmt = sqlite.prepare('SELECT sms_credits FROM users WHERE user_id = ?');
      const result = stmt.get(userId);
      return result?.sms_credits || 0;
    },

    deductSMSCredits: async (userId, amount) => {
      const stmt = sqlite.prepare('UPDATE users SET sms_credits = sms_credits - ? WHERE user_id = ?');
      stmt.run(amount, userId);
    },

    addSMSCredits: async (userId, amount) => {
      const stmt = sqlite.prepare('UPDATE users SET sms_credits = sms_credits + ? WHERE user_id = ?');
      stmt.run(amount, userId);
    },

    setSMSDeliveryMethod: async (userId, method) => {
      const stmt = sqlite.prepare('UPDATE users SET sms_delivery_method = ? WHERE user_id = ?');
      stmt.run(method, userId);
    },

    getSMSDeliveryMethod: async (userId) => {
      const stmt = sqlite.prepare('SELECT sms_delivery_method FROM users WHERE user_id = ?');
      const result = stmt.get(userId);
      return result?.sms_delivery_method || 'twilio';
    },

    logSMS: async (userId, contactId, phoneNumber, messageType, deliveryMethod, twilioSid, status, errorMessage, creditsUsed) => {
      const stmt = sqlite.prepare(`
        INSERT INTO sms_logs (user_id, contact_id, phone_number, message_type, delivery_method, twilio_sid, status, error_message, credits_used)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(userId, contactId, phoneNumber, messageType, deliveryMethod, twilioSid || null, status, errorMessage || null, creditsUsed);
      const getStmt = sqlite.prepare('SELECT * FROM sms_logs WHERE log_id = ?');
      return getStmt.get(result.lastInsertRowid);
    },

    getSMSLogs: async (userId, limit = 50) => {
      const stmt = sqlite.prepare('SELECT * FROM sms_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?');
      return stmt.all(userId, limit);
    },

    // Admin functions
    getAllUsers: async () => {
      const stmt = sqlite.prepare(`
        SELECT u.*,
               COUNT(c.contact_id) as contact_count
        FROM users u
        LEFT JOIN contacts c ON u.user_id = c.user_id
        GROUP BY u.user_id
        ORDER BY u.created_at DESC
      `);
      return stmt.all();
    },

    updateUserSubscription: async (userId, status, tier, expiresAt) => {
      const stmt = sqlite.prepare(`
        UPDATE users
        SET subscription_status = ?, subscription_tier = ?, subscription_expires_at = ?
        WHERE user_id = ?
      `);
      stmt.run(status, tier, expiresAt, userId);
      return db.getUserById(userId);
    },

    setUserAdmin: async (userId, isAdmin) => {
      const stmt = sqlite.prepare('UPDATE users SET is_admin = ? WHERE user_id = ?');
      stmt.run(isAdmin ? 1 : 0, userId);
      return db.getUserById(userId);
    },

    updateLastLogin: async (userId) => {
      const stmt = sqlite.prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE user_id = ?');
      stmt.run(userId);
    },

    getAdminStats: async () => {
      const totalUsers = sqlite.prepare('SELECT COUNT(*) as total FROM users').get().total;
      const activeUsers = sqlite.prepare("SELECT COUNT(*) as total FROM users WHERE subscription_status = 'active'").get().total;
      const totalContacts = sqlite.prepare('SELECT COUNT(*) as total FROM contacts').get().total;
      const newUsersLast7Days = sqlite.prepare("SELECT COUNT(*) as total FROM users WHERE created_at > datetime('now', '-7 days')").get().total;

      return {
        totalUsers,
        activeUsers,
        totalContacts,
        newUsersLast7Days
      };
    },

    deleteUser: async (userId) => {
      const user = db.getUserById(userId);
      const stmt = sqlite.prepare('DELETE FROM users WHERE user_id = ?');
      stmt.run(userId);
      return user;
    }
  };
}

module.exports = { ...db, isConnected };
