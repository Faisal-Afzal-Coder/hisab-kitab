const mongoose = require('mongoose');

let mongoServer;

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  // 1. If explicit MONGODB_URI is provided, connect to it
  if (uri && !uri.includes('127.0.0.1') && !uri.includes('localhost')) {
    try {
      const conn = await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
      });
      console.log(`[MongoDB] Connected to Database: ${conn.connection.host}`);
      return conn;
    } catch (err) {
      console.warn(`[MongoDB] Connection failed: ${err.message}`);
    }
  }

  // 2. Try connecting to local MongoDB daemon with a short timeout
  try {
    const conn = await mongoose.connect(uri || 'mongodb://127.0.0.1:27017/hisab_kitab', {
      serverSelectionTimeoutMS: 2000,
    });
    console.log(`[MongoDB] Connected to Local MongoDB: ${conn.connection.host}`);
    return conn;
  } catch (localErr) {
    console.log(`[MongoDB] Local daemon not found. Starting embedded database...`);
  }

  // 3. Embedded In-Memory MongoDB Server for fallback
  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    mongoServer = await MongoMemoryServer.create();
    const memoryUri = mongoServer.getUri();
    const conn = await mongoose.connect(memoryUri);
    console.log(`[MongoDB] Connected to Embedded Database: ${memoryUri}`);
    return conn;
  } catch (memErr) {
    console.error(`[MongoDB] Failed to start embedded DB: ${memErr.message}`);
    return null;
  }
};

module.exports = connectDB;
