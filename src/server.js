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

// 1. Comprehensive Global CORS Middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma'
  );

  // Instantly resolve preflight OPTIONS requests with 200 OK
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 2. Health check & Diagnostics (Registered BEFORE DB middleware so it always returns 200)
const healthHandler = (req, res) => {
  const hasMongo = Boolean(process.env.MONGODB_URI);
  const hasJwt = Boolean(process.env.JWT_SECRET);
  res.status(200).json({
    status: 'online',
    system: 'Hisab-Kitab Multi-Brother Business Management System',
    environment: process.env.VERCEL ? 'Vercel Serverless' : 'Standalone Node',
    configStatus: {
      hasMongoDBUri: hasMongo,
      hasJwtSecret: hasJwt,
      nodeEnv: process.env.NODE_ENV || 'development',
    },
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
    health: '/api/health',
  });
});

// 3. Database connection middleware for API routes
app.use(async (req, res, next) => {
  try {
    if (process.env.MONGODB_URI) {
      await connectDB();
    } else {
      console.warn('[Warning] MONGODB_URI is not set in environment variables.');
    }
    next();
  } catch (err) {
    console.error('[DB Connection Error]:', err.message);
    return res.status(500).json({
      success: false,
      error: `Database connection failed: ${err.message}. Please verify MONGODB_URI in Vercel Environment Variables.`,
    });
  }
});

// 4. API Routes - Mounted on both /api/... and /... for total flexibility
const authRoutes = require('./routes/authRoutes');
const businessRoutes = require('./routes/businessRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const partyRoutes = require('./routes/partyRoutes');
const accountRoutes = require('./routes/accountRoutes');
const productRoutes = require('./routes/productRoutes');
const purchaseRoutes = require('./routes/purchaseRoutes');
const saleRoutes = require('./routes/saleRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const reportRoutes = require('./routes/reportRoutes');
const activityRoutes = require('./routes/activityRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

// Mount on /api/... (Standard)
app.use('/api/auth', authRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/parties', partyRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/products', productRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/upload', uploadRoutes);

// Fallback mount at root /...
app.use('/auth', authRoutes);
app.use('/business', businessRoutes);
app.use('/transactions', transactionRoutes);
app.use('/parties', partyRoutes);
app.use('/accounts', accountRoutes);
app.use('/products', productRoutes);
app.use('/purchases', purchaseRoutes);
app.use('/sales', saleRoutes);
app.use('/expenses', expenseRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/reports', reportRoutes);
app.use('/activity', activityRoutes);
app.use('/upload', uploadRoutes);

// Centralized error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
if (require.main === module && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`[Server] Hisab-Kitab Backend API running on port ${PORT}`);
  });
}

module.exports = app;
