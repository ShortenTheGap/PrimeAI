const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../database/db');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// Admin authentication middleware
const authenticateAdmin = async (req, res, next) => {
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

    if (!user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.userId = decoded.userId;
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// GET /api/admin/stats - Dashboard overview stats
router.get('/stats', authenticateAdmin, async (req, res) => {
  try {
    const stats = await db.getAdminStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/admin/users - List all users
router.get('/users', authenticateAdmin, async (req, res) => {
  try {
    const users = await db.getAllUsers();

    // Remove sensitive data
    const sanitizedUsers = users.map(user => ({
      user_id: user.user_id,
      email: user.email,
      device_name: user.device_name,
      sms_credits: user.sms_credits,
      is_admin: user.is_admin,
      subscription_status: user.subscription_status,
      subscription_tier: user.subscription_tier,
      subscription_expires_at: user.subscription_expires_at,
      last_login_at: user.last_login_at,
      created_at: user.created_at,
      contact_count: parseInt(user.contact_count) || 0
    }));

    res.json(sanitizedUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// PUT /api/admin/users/:id/subscription - Update user subscription
router.put('/users/:id/subscription', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, tier, expires_at } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const validStatuses = ['active', 'suspended', 'cancelled', 'expired'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be: active, suspended, cancelled, or expired' });
    }

    const user = await db.updateUserSubscription(id, status, tier || 'free', expires_at || null);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log(`Admin ${req.userId} updated subscription for user ${id}: ${status}`);

    res.json({
      message: 'Subscription updated',
      user: {
        user_id: user.user_id,
        email: user.email,
        subscription_status: user.subscription_status,
        subscription_tier: user.subscription_tier,
        subscription_expires_at: user.subscription_expires_at
      }
    });
  } catch (error) {
    console.error('Error updating subscription:', error);
    res.status(500).json({ error: 'Failed to update subscription' });
  }
});

// PUT /api/admin/users/:id/credits - Add SMS credits
router.put('/users/:id/credits', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;

    if (typeof amount !== 'number') {
      return res.status(400).json({ error: 'Amount must be a number' });
    }

    await db.addSMSCredits(id, amount);
    const newCredits = await db.getSMSCredits(id);

    console.log(`Admin ${req.userId} added ${amount} SMS credits to user ${id}`);

    res.json({
      message: `Added ${amount} SMS credits`,
      sms_credits: newCredits
    });
  } catch (error) {
    console.error('Error adding credits:', error);
    res.status(500).json({ error: 'Failed to add credits' });
  }
});

// PUT /api/admin/users/:id/admin - Toggle admin status
router.put('/users/:id/admin', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { is_admin } = req.body;

    // Prevent removing own admin access
    if (id === req.userId && !is_admin) {
      return res.status(400).json({ error: 'Cannot remove your own admin access' });
    }

    const user = await db.setUserAdmin(id, is_admin);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log(`Admin ${req.userId} set admin=${is_admin} for user ${id}`);

    res.json({
      message: is_admin ? 'User granted admin access' : 'Admin access removed',
      user: {
        user_id: user.user_id,
        email: user.email,
        is_admin: user.is_admin
      }
    });
  } catch (error) {
    console.error('Error updating admin status:', error);
    res.status(500).json({ error: 'Failed to update admin status' });
  }
});

module.exports = router;
