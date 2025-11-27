const express = require('express');
const router = express.Router();
const db = require('../database/db');

// Twilio will be optionally initialized if credentials are provided
let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  const twilio = require('twilio');
  twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  console.log('✅ Twilio client initialized');
} else {
  console.log('⚠️  Twilio credentials not found - SMS sending via Twilio will be disabled');
}

// Middleware to verify userId
const verifyUser = (req, res, next) => {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({ error: 'User ID required' });
  }
  req.userId = userId;
  next();
};

router.use(verifyUser);

// Get SMS settings for user
router.get('/settings', async (req, res) => {
  try {
    const credits = await db.getSMSCredits(req.userId);
    const deliveryMethod = await db.getSMSDeliveryMethod(req.userId);

    res.json({
      credits,
      deliveryMethod,
      twilioConfigured: !!twilioClient
    });
  } catch (error) {
    console.error('Error fetching SMS settings:', error);
    res.status(500).json({ error: 'Failed to fetch SMS settings' });
  }
});

// Update SMS delivery method
router.put('/settings/delivery-method', async (req, res) => {
  try {
    const { method } = req.body;

    if (!['twilio', 'n8n'].includes(method)) {
      return res.status(400).json({ error: 'Invalid delivery method. Must be "twilio" or "n8n"' });
    }

    await db.setSMSDeliveryMethod(req.userId, method);
    console.log(`✅ SMS delivery method updated to ${method} for user ${req.userId}`);

    res.json({ success: true, method });
  } catch (error) {
    console.error('Error updating delivery method:', error);
    res.status(500).json({ error: 'Failed to update delivery method' });
  }
});

// Send SMS via Twilio
router.post('/send', async (req, res) => {
  try {
    const { contactId, phoneNumber, messageType, messageBody } = req.body;

    if (!phoneNumber || !messageType || !messageBody) {
      return res.status(400).json({ error: 'Phone number, message type, and message body are required' });
    }

    // Check if Twilio is configured
    if (!twilioClient) {
      return res.status(503).json({ error: 'Twilio is not configured on the server' });
    }

    // Check if user has credits
    const credits = await db.getSMSCredits(req.userId);
    if (credits <= 0) {
      return res.status(402).json({ error: 'Insufficient SMS credits', credits: 0 });
    }

    // Get Twilio phone number from env
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
    if (!twilioPhoneNumber) {
      return res.status(503).json({ error: 'Twilio phone number not configured' });
    }

    // Send SMS via Twilio
    console.log(`📤 Sending SMS to ${phoneNumber} via Twilio...`);
    const message = await twilioClient.messages.create({
      body: messageBody,
      from: twilioPhoneNumber,
      to: phoneNumber
    });

    // Deduct 1 credit
    await db.deductSMSCredits(req.userId, 1);

    // Log the SMS
    await db.logSMS(
      req.userId,
      contactId || null,
      phoneNumber,
      messageType,
      'twilio',
      message.sid,
      'sent',
      null,
      1
    );

    console.log(`✅ SMS sent successfully. SID: ${message.sid}`);

    res.json({
      success: true,
      messageSid: message.sid,
      creditsRemaining: credits - 1
    });
  } catch (error) {
    console.error('Error sending SMS:', error);

    // Log failed attempt
    try {
      await db.logSMS(
        req.userId,
        req.body.contactId || null,
        req.body.phoneNumber,
        req.body.messageType,
        'twilio',
        null,
        'failed',
        error.message,
        0
      );
    } catch (logError) {
      console.error('Error logging failed SMS:', logError);
    }

    res.status(500).json({ error: 'Failed to send SMS', message: error.message });
  }
});

// Add SMS credits (for admin or payment webhooks)
router.post('/credits/add', async (req, res) => {
  try {
    const { amount, adminKey } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid credit amount' });
    }

    // Simple admin key check (you should use proper auth in production)
    if (adminKey !== process.env.ADMIN_API_KEY) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await db.addSMSCredits(req.userId, amount);
    const newBalance = await db.getSMSCredits(req.userId);

    console.log(`✅ Added ${amount} SMS credits to user ${req.userId}. New balance: ${newBalance}`);

    res.json({ success: true, credits: newBalance });
  } catch (error) {
    console.error('Error adding credits:', error);
    res.status(500).json({ error: 'Failed to add credits' });
  }
});

// Get SMS logs
router.get('/logs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const logs = await db.getSMSLogs(req.userId, limit);

    res.json({ logs });
  } catch (error) {
    console.error('Error fetching SMS logs:', error);
    res.status(500).json({ error: 'Failed to fetch SMS logs' });
  }
});

module.exports = router;
