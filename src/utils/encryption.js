const crypto = require('crypto');

// AES-256-GCM helper. key comes from ENCRYPTION_KEY env var and should be
// 32 bytes (256 bits). If not provided we still derive one from a default
// passphrase but you should **always** set it in production.
const algorithm = 'aes-256-gcm';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'please_change_this_to_a_secure_key';
const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);

function encrypt(text) {
  if (text == null || text === '') return text;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  // store iv, tag and ciphertext together
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

function decrypt(data) {
  if (data == null || data === '') return data;
  const parts = data.split(':');
  if (parts.length !== 3) return data; // not encrypted
  const [ivHex, tagHex, encrypted] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(tag);
  let dec = decipher.update(encrypted, 'hex', 'utf8');
  dec += decipher.final('utf8');
  return dec;
}

module.exports = { encrypt, decrypt };
