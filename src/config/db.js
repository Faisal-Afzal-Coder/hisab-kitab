const mongoose = require('mongoose');

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
  // If already connected, return cached connection
  if (cached.conn && mongoose.connection.readyState >= 1) {
    return cached.conn;
  }

  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.warn('[MongoDB] No MONGODB_URI provided in environment variables.');
  }

  // Connect using MongoDB URI
  const connectionUri = uri || 'mongodb://127.0.0.1:27017/hisab_kitab';

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
    };

    cached.promise = mongoose.connect(connectionUri, opts).then((mongooseInstance) => {
      console.log(`[MongoDB] Connected successfully to host: ${mongooseInstance.connection.host}`);
      return mongooseInstance;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    console.error('[MongoDB Error]:', e.message);
    throw e;
  }

  return cached.conn;
};

module.exports = connectDB;
