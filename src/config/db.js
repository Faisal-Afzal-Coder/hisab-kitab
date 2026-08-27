const mongoose = require('mongoose');

let cachedConnection = global.mongoose;

if (!cachedConnection) {
  cachedConnection = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
  // If already connected, return cached connection (vital for Vercel serverless functions)
  if (cachedConnection.conn && mongoose.connection.readyState === 1) {
    return cachedConnection.conn;
  }

  const uri = process.env.MONGODB_URI;

  // 1. If explicit MONGODB_URI is provided, connect to it
  if (uri && !uri.includes('127.0.0.1') && !uri.includes('localhost')) {
    try {
      if (!cachedConnection.promise) {
        cachedConnection.promise = mongoose.connect(uri, {
          serverSelectionTimeoutMS: 8000,
          bufferCommands: false,
        }).then((m) => m);
      }
      cachedConnection.conn = await cachedConnection.promise;
      console.log(`[MongoDB] Connected to Database: ${cachedConnection.conn.connection.host}`);
      return cachedConnection.conn;
    } catch (err) {
      cachedConnection.promise = null;
      console.warn(`[MongoDB] Connection failed: ${err.message}`);
    }
  }

  // 2. Local fallback (for local development outside Vercel)
  try {
    const conn = await mongoose.connect(uri || 'mongodb://127.0.0.1:27017/hisab_kitab', {
      serverSelectionTimeoutMS: 2000,
    });
    console.log(`[MongoDB] Connected to Local MongoDB: ${conn.connection.host}`);
    return conn;
  } catch (localErr) {
    // 3. Embedded in-memory server only in local development
    if (!process.env.VERCEL) {
      try {
        const { MongoMemoryServer } = require('mongodb-memory-server');
        const mongoServer = await MongoMemoryServer.create();
        const memoryUri = mongoServer.getUri();
        const conn = await mongoose.connect(memoryUri);
        console.log(`[MongoDB] Connected to Embedded Database: ${memoryUri}`);
        return conn;
      } catch (memErr) {
        console.error(`[MongoDB] Failed to start embedded DB: ${memErr.message}`);
      }
    }
    return null;
  }
};

module.exports = connectDB;
