const { db } = require('../config/db');

// Facility model using Knex
class Facility {
  static async createTable() {
    const exists = await db.schema.hasTable('facilities');
    if (!exists) {
      await db.schema.createTable('facilities', (table) => {
        table.increments('id').primary();
        table.string('name').notNullable().unique();
        table.enum('type', ['hospital', 'pharmacy']).notNullable();
        table.json('location').defaultTo(JSON.stringify({ type: 'Point', coordinates: [] }));
        table.string('address');
        table.string('email');
        table.json('altPhone').defaultTo(JSON.stringify([]));
        table.string('phone');
        table.string('username').unique();
        table.string('passwordHash');
        table.json('services').defaultTo(JSON.stringify([]));
        table.string('agentId').unique();
        table.string('openingHours');
        table.string('hospitalType');
        table.string('pharmacyType');
        table.enum('ownership', ['private', 'public']).defaultTo('private');
        table.string('notes');
        table.boolean('isEmergency').defaultTo(false);
        table.boolean('isActive').defaultTo(true);
        table.integer('viewsTotal').defaultTo(0);
        table.datetime('lastViewedAt');
        table.integer('ratingCount').defaultTo(0);
        table.integer('ratingSum').defaultTo(0);
        table.float('averageRating').defaultTo(0);
        table.datetime('updatedAt').defaultTo(db.fn.now());
        table.timestamps(true, true);
      });
      console.log('✅ Facilities table created');
    }
  }

  static async create(data) {
    const { encrypt: _encrypt } = require('../utils/encryption');
    
    // Encrypt sensitive fields before saving
    const encryptedData = { ...data };
    if (encryptedData.phone) {
      encryptedData.phone = _encrypt(encryptedData.phone);
    }
    if (encryptedData.email) {
      encryptedData.email = _encrypt(encryptedData.email);
    }
    
    const [id] = await db('facilities').insert({
      ...encryptedData,
      updatedAt: new Date()
    });
    return this.findById(id);
  }

  static async findById(id) {
    const facility = await db('facilities').where({ id }).first();
    if (facility) {
      this.decryptFields(facility);
    }
    return facility;
  }

  static async findAll() {
    const facilities = await db('facilities').select('*');
    facilities.forEach(facility => this.decryptFields(facility));
    return facilities;
  }

  static async update(id, data) {
    const { encrypt: _encrypt } = require('../utils/encryption');
    
    // Encrypt sensitive fields before saving
    const encryptedData = { ...data };
    if (encryptedData.phone) {
      encryptedData.phone = _encrypt(encryptedData.phone);
    }
    if (encryptedData.email) {
      encryptedData.email = _encrypt(encryptedData.email);
    }
    
    await db('facilities').where({ id }).update({
      ...encryptedData,
      updatedAt: new Date()
    });
    return this.findById(id);
  }

  static async delete(id) {
    return await db('facilities').where({ id }).del();
  }

  static async findByName(name) {
    const facility = await db('facilities').where({ name }).first();
    if (facility) {
      this.decryptFields(facility);
    }
    return facility;
  }

  static async findByType(type) {
    const facilities = await db('facilities').where({ type });
    facilities.forEach(facility => this.decryptFields(facility));
    return facilities;
  }

  static async incrementViews(id) {
    await db('facilities').where({ id }).increment('viewsTotal', 1);
    await db('facilities').where({ id }).update({
      lastViewedAt: new Date()
    });
  }

  static async updateRating(id, newRating) {
    const facility = await db('facilities').where({ id }).first();
    if (facility) {
      const newRatingCount = facility.ratingCount + 1;
      const newRatingSum = facility.ratingSum + newRating;
      const newAverageRating = newRatingSum / newRatingCount;
      
      await db('facilities').where({ id }).update({
        ratingCount: newRatingCount,
        ratingSum: newRatingSum,
        averageRating: newAverageRating
      });
    }
  }

  static decryptFields(facility) {
    try {
      const { encrypt: _encrypt, decrypt: _decrypt } = require('../utils/encryption');
      if (facility.phone) facility.phone = _decrypt(facility.phone);
      if (facility.email) facility.email = _decrypt(facility.email);
    } catch (_) {}
    return facility;
  }
}

module.exports = Facility;
