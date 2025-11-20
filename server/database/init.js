const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || './data/contacts.db';

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database connection
const db = new Database(DB_PATH, { verbose: console.log });

// Enable foreign keys
db.pragma('foreign_keys = ON');

function initDatabase() {
  console.log('📊 Initializing database...');

  // Create contacts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      contact_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      date_added TEXT NOT NULL,
      location_lat REAL,
      location_long REAL,
      location_address TEXT,
      venue_name TEXT,
      raw_voice_note_path TEXT,
      transcription TEXT,
      ai_summary TEXT,
      topics_discussed TEXT,
      follow_up_type TEXT,
      follow_up_priority TEXT CHECK(follow_up_priority IN ('hot', 'warm', 'cold')),
      follow_up_date TEXT,
      tags TEXT,
      linkedin_url TEXT,
      company_name TEXT,
      enrichment_data TEXT,
      status TEXT DEFAULT 'new' CHECK(status IN ('new', 'contacted', 'ongoing', 'closed')),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create index for faster searches
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name);
    CREATE INDEX IF NOT EXISTS idx_contacts_date ON contacts(date_added);
    CREATE INDEX IF NOT EXISTS idx_contacts_follow_up ON contacts(follow_up_date);
    CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
  `);

  // Create follow-ups view for easy querying
  db.exec(`
    CREATE VIEW IF NOT EXISTS follow_ups_view AS
    SELECT
      contact_id,
      name,
      ai_summary,
      venue_name,
      topics_discussed,
      follow_up_type,
      follow_up_priority,
      follow_up_date,
      status,
      CASE
        WHEN date(follow_up_date) < date('now') THEN 'overdue'
        WHEN date(follow_up_date) = date('now') THEN 'today'
        WHEN date(follow_up_date) <= date('now', '+7 days') THEN 'this_week'
        ELSE 'upcoming'
      END as follow_up_status
    FROM contacts
    WHERE status != 'closed' AND follow_up_date IS NOT NULL
    ORDER BY follow_up_date ASC;
  `);

  console.log('✅ Database initialized successfully');
}

// Export database instance
module.exports = {
  db,
  initDatabase
};
