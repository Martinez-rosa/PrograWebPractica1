const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    userColor: { type: String, default: '#4ECDC4' },
    // timestamp derivado de createdAt para compatibilidad con el frontend
  },
  { timestamps: true }
);

// Índice por fecha para consultas eficientes de últimos mensajes
chatMessageSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);