const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// Load environment variables
dotenv.config();

const app = express();

// Middleware to ensure DB is connected before processing requests on serverless
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('[DB Connection Error]:', err.message);
    // Proceed or return informative JSON instead of 500 server crash
    if (!process.env.MONGODB_URI) {
      return res.status(500).json({
        success: false,
        error: 'Database configuration missing. Please add MONGODB_URI to your Vercel Environment Variables.',
      });
    }
    next(err);
  }
});

// Comprehensive CORS setup
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check endpoints
const healthHandler = (req, res) => {
  res.status(200).json({
    status: 'online',
    system: 'Hisab-Kitab Multi-Brother Business Management System',
    environment: process.env.VERCEL ? 'Vercel Serverless' : 'Standalone Node',
    timestamp: new Date().toISOString(),
  });
};

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'Hisab-Kitab Backend API',
    version: '1.0.0',
    status: 'running',
  });
});

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/business', require('./routes/businessRoutes'));
app.use('/api/transactions', require('./routes/transactionRoutes'));
app.use('/api/parties', require('./routes/partyRoutes'));
app.use('/api/accounts', require('./routes/accountRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/purchases', require('./routes/purchaseRoutes'));
app.use('/api/sales', require('./routes/saleRoutes'));
app.use('/api/expenses', require('./routes/expenseRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/activity', require('./routes/activityRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));

// Centralized error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`[Server] Hisab-Kitab Backend API running on port ${PORT}`);
  });
}

module.exports = app;
