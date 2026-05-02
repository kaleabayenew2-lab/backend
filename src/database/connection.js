// SQLite database connection for backend
const Database = require('better-sqlite3');
const path = require('path');

// Database file path
const DB_PATH = path.join(__dirname, '..', '..', 'database.sqlite');

let db = null;

function connectToDatabase() {
  if (db) {
    return db;
  }

  try {
    // Open database connection
    db = new Database(DB_PATH);

    // Enable foreign keys
    db.pragma('foreign_keys = ON');
    
    console.log('Connected to SQLite database successfully');
    return db;
  } catch (error) {
    console.error('SQLite connection error:', error);
    throw error;
  }
}

// Initialize database schema
function initializeDatabase() {
  const database = connectToDatabase();
  
  try {
    // Create facilities table
    database.exec(`
      CREATE TABLE IF NOT EXISTS facilities (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('hospital', 'pharmacy')),
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        address TEXT NOT NULL,
        opening_hours TEXT NOT NULL,
        ownership TEXT NOT NULL CHECK (ownership IN ('Public', 'Private')),
        username TEXT NOT NULL UNIQUE,
        password TEXT,
        emergency INTEGER DEFAULT 0,
        notes TEXT,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        hospital_type TEXT,
        pharmacy_type TEXT,
        services TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for better performance
    database.exec(`
      CREATE INDEX IF NOT EXISTS idx_facilities_email ON facilities(email);
      CREATE INDEX IF NOT EXISTS idx_facilities_phone ON facilities(phone);
      CREATE INDEX IF NOT EXISTS idx_facilities_username ON facilities(username);
      CREATE INDEX IF NOT EXISTS idx_facilities_name_type ON facilities(name, type);
    `);

    // Create OTP codes table
    database.exec(`
      CREATE TABLE IF NOT EXISTS otp_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        identifier TEXT NOT NULL,
        method TEXT NOT NULL,
        code TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        attempts INTEGER DEFAULT 0,
        is_used INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Database schema initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

// Close database connection
function disconnectFromDatabase() {
  if (db) {
    db.close();
    db = null;
    console.log('Disconnected from SQLite database');
  }
}

// Check if database is connected
function isDatabaseConnected() {
  return db !== null;
}

module.exports = { 
  connectToDatabase, 
  disconnectFromDatabase, 
  isDatabaseConnected, 
  initializeDatabase 
};
