const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/user');

const router = express.Router();

router.post('/register', async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y password son requeridos' });
  }
  try {
    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({ error: 'El email ya está registrado' });
    }
    const user = new User({ email, password, role: role || 'user' });
    await user.save();
    const safeUser = { id: user._id, email: user.email, role: user.role };
    return res.status(201).json({ user: safeUser });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  console.log('Login attempt:', { email, password: '***' });
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y password son requeridos' });
  }
  try {
    const user = await User.findOne({ email });
    console.log('User found:', user ? 'Yes' : 'No');
    
    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    
    console.log('Comparing passwords...');
    const match = await user.comparePassword(password);
    console.log('Password match:', match);
    
    if (!match) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    
    console.log('Creating JWT token...');
    const payload = { sub: user._id.toString(), role: user.role };
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    });
    
    const safeUser = { id: user._id, email: user.email, role: user.role };
    console.log('Login successful for:', email);
    return res.json({ token, user: safeUser });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Error de servidor' });
  }
});

module.exports = router;