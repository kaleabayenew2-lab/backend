const mongoose = require('mongoose');

// prefer Atlas env var, then legacy name, then local dev fallback
const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mobile_users';

module.exports = function connectDB() {
  const maxAttempts = 6;
  let attempt = 0;

  const tryConnect = () => {
    attempt += 1;
    mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
      .then(() => console.log(`MongoDB connected: ${uri}`))
      .catch(err => {
        console.error(`Mongo connect error (attempt ${attempt}/${maxAttempts}):`, err && err.message ? err.message : err);
        // Helpful diagnostics for name resolution issues
        if (err && err.message && err.message.includes('ENOTFOUND')) {
          console.warn('DNS lookup failed for MongoDB host. Common causes:');
          console.warn('- No internet / blocked outbound DNS');
          console.warn('- Corporate proxy or firewall blocking DNS/resolution');
          console.warn('- Local DNS misconfiguration; try `nslookup <host>` or `nslookup', '8.8.8.8`');
          console.warn('- MongoDB Atlas cluster DNS entries may be blocked; verify network connectivity and try another DNS server (e.g., 8.8.8.8)');
        }

        if (attempt < maxAttempts) {
          const wait = 1000 * Math.pow(2, attempt - 1);
          console.log(`Retrying MongoDB connection in ${wait} ms...`);
          setTimeout(tryConnect, wait);
          return;
        }

      console.error('Failed to connect to MongoDB after multiple attempts.');
      // Do not exit process in development; allow file-backed fallbacks to work.
      // Log and continue running the server without an active MongoDB connection.
      return;
      });
  };

  tryConnect();
};
