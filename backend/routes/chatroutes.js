const express = require('express');
const path = require('path');
const { authenticatePage } = require('../middleware/auth');

const router = express.Router();

// Ruta HTML del chat protegida por JWT (cookie o query)
router.get('/chat', authenticatePage, (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend', 'chat.html'));
});

module.exports = router;