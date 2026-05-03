// Main backend application
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const http = require('http');
const socketIo = require('socket.io');

// Import database and models
const db = require('./config/db');
const Facility = require('./models/facility');
const User = require('./models/user');
const ChatMessage = require('./models/chatMessage');

// Import and initialize email service
const { initializeEmailService } = require('./services/emailService');

// Import routes
const facilityRoutes = require('./routes/facilities');
const otpRoutes = require('./routes/otpRoutes');
const adminRoutes = require('./routes/adminRoutes');
const usersRoutes = require('./routes/usersRoutes');
const notificationsRoutes = require('./routes/notificationsRoutes');
const chatRoutes = require('./routes/chatRoutes');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // limit each IP to 300 requests per windowMs (increased for development)
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use(morgan('combined'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// CSRF token endpoint
app.get('/api/csrf-token', (req, res) => {
  const crypto = require('crypto');
  const token = crypto.randomBytes(32).toString('hex');
  res.json({ csrfToken: token });
});

// API routes
app.use('/api/facilities', facilityRoutes);
app.use('/api/otp', otpRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/chat', chatRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Facility Management Backend API',
    version: '1.0.0',
    endpoints: {
      facilities: '/api/facilities',
      otp: '/api/otp',
      health: '/health'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    message: 'Route not found',
    path: req.originalUrl
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      message: 'Validation Error',
      details: err.message
    });
  }
  
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      message: 'File too large'
    });
  }
  
  res.status(500).json({
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Create HTTP server for socket.io
const server = http.createServer(app);

// Setup socket.io
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// Handle socket.io connections
io.on('connection', (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);
  
  // Handle admin connections
  if (socket.handshake.query.admin === '1') {
    console.log(`👨‍💼 Admin socket connected: ${socket.id}`);
    socket.join('admin');
  }
  
  socket.on('disconnect', () => {
    console.log(`🔌 Socket disconnected: ${socket.id}`);
  });
});

// Initialize database
db.testConnection().then(async () => {
  await db.syncDatabase();
  try {
    await Facility.createTable();
  } catch (err) {
    if (!err.message.includes('already exists')) {
      console.error('❌ Error creating facilities table:', err);
    }
  }
  try {
    await User.createTable();
  } catch (err) {
    if (!err.message.includes('already exists')) {
      console.error('❌ Error creating users table:', err);
    }
  }
  try {
    await ChatMessage.createTable();
  } catch (err) {
    if (!err.message.includes('already exists')) {
      console.error('❌ Error creating chatMessages table:', err);
    }
  }
});

// Initialize email service
initializeEmailService().then(() => {
  console.log('📧 Email service initialized');
}).catch((error) => {
  console.log('⚠️ Email service failed to initialize, using fallback:', error.message);
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🏥 Facilities API: http://localhost:${PORT}/api/facilities`);
  console.log(`🔐 OTP API: http://localhost:${PORT}/api/otp`);
  console.log(`👨‍💼 Admin API: http://localhost:${PORT}/api/admin`);
  console.log(`🔌 Socket.IO: http://localhost:${PORT}/socket.io`);
});

module.exports = app;
