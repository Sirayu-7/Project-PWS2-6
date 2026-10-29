const express = require('express');
const jwt = require('jsonwebtoken');
const { addClient } = require('../services/realtime');

const router = express.Router();

router.get('/events', (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(401).json({ success: false, message: 'กรุณาเข้าสู่ระบบ' });

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-change-me');
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (res.flushHeaders) res.flushHeaders();
    res.write(`event: connected\ndata: ${JSON.stringify({ userId: user.id })}\n\n`);
    addClient(user.id, res);
  } catch (_) {
    return res.status(401).json({ success: false, message: 'Session ไม่ถูกต้องหรือหมดอายุ' });
  }
});

module.exports = router;
