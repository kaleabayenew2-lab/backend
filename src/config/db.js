const { Sequelize, DataTypes } = require('sequelize');

// Use SQLite database
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite', // SQLite file in backend root
  logging: false, // Disable SQL query logging
});

// Test the connection
async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
}

// Schema registry for models
const modelRegistry = {};

// Function to register a model
function registerModel(name, modelDefinition) {
  const model = sequelize.define(name, modelDefinition);
  modelRegistry[name] = model;
  return model;
}

// Function to get a model
function getModel(name) {
  return modelRegistry[name];
}

// Sync database (create tables)
async function syncDatabase() {
  try {
    await sequelize.sync({ force: false }); // Set force: true to drop and recreate tables
    console.log('✅ Database synced');
  } catch (error) {
    console.error('Error syncing database:', error);
  }
}

// Export functions and sequelize instance
module.exports = {
  sequelize,
  DataTypes,
  registerModel,
  getModel,
  testConnection,
  syncDatabase,
};


