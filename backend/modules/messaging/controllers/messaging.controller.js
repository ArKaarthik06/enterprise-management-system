const Message = require('../models/Message');

// @desc    Send a message
// @route   POST /api/messaging
exports.sendMessage = async (req, res) => {
  try {
    const { recipients, body, metadata } = req.body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ message: 'Recipients array is required' });
    }

    const message = await Message.create({
      senderId: req.user.id,
      recipients,
      body,
      metadata: { ...metadata, type: 'user' }
    });

    // Kafka event message.sent
    const { publishEvent } = require('../../../config/kafka');
    await publishEvent('message.sent', message._id, message);

    res.status(201).json({ message: 'Message sent', data: message });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    List all messages for the current user
// @route   GET /api/messaging
exports.getMessages = async (req, res) => {
  try {
    const messages = await Message.find({ recipients: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Poll for updates since a timestamp (messages and optionally low-stock alerts)
// @route   GET /api/dashboard/updates
exports.pollUpdates = async (req, res) => {
  try {
    const since = req.query.since;
    if (!since) {
      return res.status(400).json({ message: 'Since timestamp is required' });
    }

    const date = new Date(since);

    const newMessages = await Message.find({
      recipients: req.user.id,
      createdAt: { $gt: date }
    }).sort({ createdAt: -1 });

    res.json({
      timestamp: new Date().toISOString(),
      newMessages,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
