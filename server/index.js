const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

// Ensure upload directories exist
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadDir));

// Database setup
const db = require('./database/db');

// Routes
const contactsRouter = require('./routes/contacts');
const authRouter = require('./routes/auth');

app.use('/api/contacts', contactsRouter);
app.use('/api/auth', authRouter);

// User Management Endpoints
// Register or verify a user by device ID
app.post('/api/users/register', async (req, res) => {
  try {
    const { deviceId, deviceName } = req.body;

    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID is required' });
    }

    // Generate user_id from device_id (simple approach)
    const userId = `user_${deviceId.replace(/[^a-zA-Z0-9]/g, '')}`;

    // Check if user exists
    let user = await db.getUserByDeviceId(deviceId);

    if (!user) {
      // Create new user
      user = await db.createUser(userId, deviceId, deviceName);
      console.log('✅ New user created:', userId);
    } else {
      console.log('✅ Existing user found:', user.user_id);
    }

    res.json({
      userId: user.user_id,
      deviceId: user.device_id,
      deviceName: user.device_name,
      isNewUser: !user
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'PrimeAI Backend is running',
    environment: process.env.NODE_ENV || 'development',
    database: db.isConnected ? 'connected' : 'disconnected',
    multiUser: true
  });
});

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'PrimeAI API Server',
    version: '1.0.1',
    updated: '2025-11-20',
    endpoints: {
      health: '/api/health',
      contacts: '/api/contacts'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: err.message || 'Internal server error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💾 Database: ${process.env.DATABASE_URL ? 'PostgreSQL' : 'SQLite'}`);
});
