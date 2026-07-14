const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const { testConnection } = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const { sendSuccess } = require('./utils/responseHelper');

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to Database
testConnection();

// Middlewares
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
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
app.use('/api/auth', require('./routes/authRoutes'));

// Complaint routes
app.use('/api/complaints', require('./routes/complaintRoutes'));

// Global Error Handler (Must be mounted last)
app.use(errorHandler);

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
