const knex = require('../config/db');
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

module.exports = {
  // Create user
  async create(data) {
    const prepared = prepareUserData(data);

    const [id] = await knex(TABLE).insert(prepared);
    return this.findById(id);
  },

  // Find all users
  async findAll() {
    const users = await knex(TABLE).select('*');
    return decryptUsers(users);
  },

  // Find by ID
  async findById(id) {
    const user = await knex(TABLE)
      .where({ id })
      .first();

    return decryptUser(user);
  },

  // Find by email (IMPORTANT: must encrypt before query)
  async findByEmail(email) {
    const encryptedEmail = encrypt(email.toLowerCase());

    const user = await knex(TABLE)
      .where({ email: encryptedEmail })
      .first();

    return decryptUser(user);
  },

  // Update user
  async update(id, data) {
    const prepared = prepareUserData(data);

    await knex(TABLE)
      .where({ id })
      .update(prepared);

    return this.findById(id);
  },

  // Delete user
  async delete(id) {
    return await knex(TABLE)
      .where({ id })
      .del();
  }
};