const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const { testConnection } = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const { sendSuccess } = require('./utils/responseHelper');

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to Database
testConnection();

// Helmet middleware for secure HTTP headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Rate Limiters
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10000,
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10000, // Highly relaxed limit for presentation demo purposes
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply global rate limiter
app.use(globalLimiter);

// Cookie Parser middleware
app.use(cookieParser());

// Middlewares
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. curl, Postman)
    if (!origin) return callback(null, true);
    // In development, allow any localhost port
    if (process.env.NODE_ENV === 'development' && /^http:\/\/localhost:\d+$/.test(origin)) {
      return callback(null, true);
    }
    // In production, only allow the configured CLIENT_URL
    if (origin === process.env.CLIENT_URL) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Morgan Logger
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Health Check Route
app.get('/health', (req, res) => {
  return sendSuccess(res, { uptime: process.uptime() }, 'Server is healthy');
});

// Auth routes
app.use('/api/auth', authLimiter, require('./routes/authRoutes'));

// Complaint routes
app.use('/api/complaints', require('./routes/complaintRoutes'));

// Global Error Handler (Must be mounted last)
app.use(errorHandler);

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
