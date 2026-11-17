const mongoose = require('mongoose');

// Chat history is stored on the SERVER (not trusted from the browser),
// so nobody can forge an "assistant" message to trick the model.
const conversationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  messages: [{
    role: { type: String, enum: ['user', 'assistant'], required: true },
    text: { type: String, required: true }, // masked text only
    _id: false,
  }],
  updatedAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 }, // auto-delete after 30 days
});

module.exports = mongoose.models.AiConversation || mongoose.model('AiConversation', conversationSchema);
