const knex = require('knex');

// Initialize database (SQLite)
const db = knex({
  client: 'better-sqlite3',
  connection: {
    filename: './database.sqlite'
  },
  useNullAsDefault: true
});

// Test connection
async function testConnection() {
  try {
    await db.raw('SELECT 1');
    console.log('✅ Database connected');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
  }
}

// Simple model registry (optional)
const modelRegistry = {};

// Register a "model" (just table name wrapper)
function registerModel(name, tableName) {
  modelRegistry[name] = tableName;
  return tableName;
}

// Get model (table name)
function getModel(name) {
  return modelRegistry[name];
}

// Sync database (create tables manually)
async function syncDatabase() {
  try {
    const exists = await db.schema.hasTable('users');

    if (!exists) {
      await db.schema.createTable('users', (table) => {
        table.increments('id').primary();
        table.string('name');
        table.string('email').unique();
        table.string('password');
        table.timestamps(true, true);
      });
    }

    console.log('✅ Database synced');
  } catch (error) {
    console.error('❌ Error syncing database:', error);
  }
}

module.exports = {
  db,
  registerModel,
  getModel,
  testConnection,
  syncDatabase
};