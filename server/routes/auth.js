const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../database/db');

const router = express.Router();

// JWT secret - in production, this should be in environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
const WEBHOOK_API_KEY = process.env.WEBHOOK_API_KEY; // Required for webhook endpoints
const SALT_ROUNDS = 10;

// Helper to generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
};

// Register endpoint
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Check if user already exists
    const existingUser = await db.getUserByEmail(email.toLowerCase());
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user
    const user = await db.createUserWithPassword(email.toLowerCase(), passwordHash);

    // Generate token
    const token = generateToken(user.user_id);

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        userId: user.user_id,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = await db.getUserByEmail(email.toLowerCase());
    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate token
    const token = generateToken(user.user_id);

    res.json({
      message: 'Login successful',
      token,
      user: {
        userId: user.user_id,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Delete account endpoint - permanently removes user and all their data
router.delete('/account', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;

    // Verify user exists
    const user = await db.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete all user's contacts first (if cascade doesn't handle it)
    const contacts = await db.getAllContacts(userId);
    for (const contact of contacts) {
      await db.deleteContact(contact.contact_id, userId);
    }

    // Delete the user account
    await db.deleteUser(userId);

    console.log(`✅ Account deleted: ${user.email} (${userId})`);

    res.json({
      message: 'Account deleted successfully',
      deletedContacts: contacts.length
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    console.error('Account deletion error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// Webhook endpoint to create users from external CRM
// POST /api/auth/webhook/create-user
// Headers: x-api-key: <WEBHOOK_API_KEY>
// Body: { email, name, password, groupId }
router.post('/webhook/create-user', async (req, res) => {
  try {
    // Verify API key
    const apiKey = req.headers['x-api-key'];
    if (!WEBHOOK_API_KEY) {
      console.error('❌ WEBHOOK_API_KEY not configured');
      return res.status(500).json({ error: 'Webhook not configured' });
    }
    if (apiKey !== WEBHOOK_API_KEY) {
      console.error('❌ Invalid API key for webhook');
      return res.status(401).json({ error: 'Invalid API key' });
    }

    const { email, name, password, groupId } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Check if user already exists
    const existingUser = await db.getUserByEmail(email.toLowerCase());
    if (existingUser) {
      console.log(`ℹ️ User already exists: ${email}`);
      return res.status(200).json({
        message: 'User already exists',
        user: {
          userId: existingUser.user_id,
          email: existingUser.email
        },
        created: false
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user
    const user = await db.createUserWithPassword(email.toLowerCase(), passwordHash);

    console.log(`✅ User created via webhook: ${email} (${user.user_id})${groupId ? ` groupId: ${groupId}` : ''}`);

    res.status(201).json({
      message: 'User created successfully',
      user: {
        userId: user.user_id,
        email: user.email,
        name: name || null,
        groupId: groupId || null
      },
      created: true
    });
  } catch (error) {
    console.error('Webhook create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Verify token endpoint (optional, for checking if token is still valid)
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await db.getUserById(decoded.userId);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    res.json({
      valid: true,
      user: {
        userId: user.user_id,
        email: user.email
      }
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;
