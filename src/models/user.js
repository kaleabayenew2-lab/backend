const { db } = require('../config/db');
const { encrypt, decrypt } = require('../utils/encryption');

const TABLE = 'users';

// 🔒 Apply encryption before insert/update (replacement for beforeSave hook)
function prepareUserData(data) {
  const newData = { ...data };

  if (newData.email) {
    newData.email = encrypt(newData.email.toLowerCase());
  }

  if (newData.phone) {
    newData.phone = encrypt(newData.phone);
  }

  return newData;
}

// 🔓 Decrypt after fetching (replacement for afterFind hook)
function decryptUser(user) {
  if (!user) return user;

  try {
    if (user.email) user.email = decrypt(user.email);
    if (user.phone) user.phone = decrypt(user.phone);
  } catch (_) {}

  return user;
}

function decryptUsers(users) {
  if (!Array.isArray(users)) return decryptUser(users);
  return users.map(decryptUser);
}

// Create table method
async function createTable() {
  const exists = await db.schema.hasTable('users');
  if (!exists) {
    await db.schema.createTable('users', (table) => {
      table.increments('id').primary();
      table.string('fullName').notNullable();
      table.string('email').notNullable().unique();
      table.string('passwordHash').notNullable();
      table.string('phone');
      table.string('telegramChatId');
      table.string('telegramUsername');
      table.string('telegramPhone');
      table.json('deviceTokens').defaultTo(JSON.stringify([]));
      table.string('resetOtp');
      table.datetime('resetOtpExpires');
      table.string('loginOtp');
      table.datetime('loginOtpExpires');
      table.integer('age');
      table.json('savedFacilities').defaultTo(JSON.stringify([]));
      table.json('medicalConditions').defaultTo(JSON.stringify([]));
      table.json('allergies').defaultTo(JSON.stringify([]));
      table.json('medications').defaultTo(JSON.stringify([]));
      table.string('systemId').notNullable().unique();
      table.string('userId').notNullable().unique();
      table.string('provider');
      table.datetime('createdAt').defaultTo(db.fn.now());
      table.boolean('adminResetRequested').defaultTo(false);
      table.string('adminResetPassword');
      table.datetime('adminResetPasswordExpires');
      table.timestamps(true, true);
    });
    console.log('✅ Users table created');
  }
}

module.exports = {
  // Create table
  createTable,

  // Create user
  async create(data) {
    const prepared = prepareUserData(data);

    const [id] = await db(TABLE).insert(prepared);
    return this.findById(id);
  },

  // Find all users
  async findAll() {
    const users = await db(TABLE).select('*');
    return decryptUsers(users);
  },

  // Find by ID
  async findById(id) {
    const user = await db(TABLE)
      .where({ id })
      .first();

    return decryptUser(user);
  },

  // Find user by any field
  async findOne(where) {
    const user = await db(TABLE)
      .where(where)
      .first();

    return decryptUser(user);
  },

  // Find by email (IMPORTANT: must encrypt before query)
  async findByEmail(email) {
    const encryptedEmail = encrypt(email.toLowerCase());

    const user = await db(TABLE)
      .where({ email: encryptedEmail })
      .first();

    return decryptUser(user);
  },

  // Update user
  async update(id, data) {
    const prepared = prepareUserData(data);

    await db(TABLE)
      .where({ id })
      .update(prepared);

    return this.findById(id);
  },

  // Delete user
  async delete(id) {
    return await db(TABLE)
      .where({ id })
      .del();
  }
};