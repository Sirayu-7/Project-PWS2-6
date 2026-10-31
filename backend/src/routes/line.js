const express = require('express');
const crypto = require('crypto');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const lineService = require('../services/line');
const { emitToUser, emitToAll } = require('../services/realtime');
const { writeAudit } = require('../services/audit');

const router = express.Router();

// Signature verification middleware for LINE Webhook
function verifyLineSignature(req, res, next) {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  const signature = req.headers['x-line-signature'];

  if (!channelSecret || !signature) {
    return res.status(401).json({ success: false, message: 'Missing LINE signature or secret' });
  }

  const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
  const expectedSignature = crypto
    .createHmac('sha256', channelSecret)
    .update(rawBody)
    .digest('base64');

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return res.status(401).json({ success: false, message: 'Invalid LINE signature' });
  }

  next();
}

// ---------------- Authenticated Web APIs ----------------

// 1. Generate 6-digit PIN for linking
router.post('/link-token', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    // Invalidate existing unused tokens
    await pool.execute('UPDATE line_link_tokens SET is_used = 1 WHERE user_id = ? AND is_used = 0', [userId]);

    // Generate random 6-digit numeric PIN
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    await pool.execute(
      'INSERT INTO line_link_tokens (user_id, pin_code, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))',
      [userId, pin]
    );

    res.json({
      success: true,
      pin_code: pin,
      expires_in: 600,
      bot_id: process.env.LINE_BOT_BASIC_ID || '',
    });
  } catch (e) {
    console.error('[LINE_LINK_TOKEN_ERROR]:', e.message);
    res.status(500).json({ success: false, message: 'ไม่สามารถสร้างรหัสเชื่อมต่อได้' });
  }
});

// 2. Get LINE status for current user
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT line_user_id FROM users WHERE user_id = ?', [req.user.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้' });
    const lineUserId = rows[0].line_user_id;
    res.json({
      success: true,
      linked: !!lineUserId,
      line_user_id: lineUserId || null,
    });
  } catch (e) {
    console.error('[LINE_STATUS_ERROR]:', e.message);
    res.status(500).json({ success: false, message: 'ไม่สามารถตรวจสอบสถานะได้' });
  }
});

// 3. Unlink LINE account
router.post('/unlink', authenticateToken, async (req, res) => {
  try {
    await pool.execute('UPDATE users SET line_user_id = NULL WHERE user_id = ?', [req.user.id]);
    try {
      await writeAudit({ userId: req.user.id, action: 'UNLINK_LINE_ACCOUNT', tableName: 'users', recordId: req.user.id });
    } catch {}
    res.json({ success: true, message: 'ยกเลิกการเชื่อมต่อ LINE เรียบร้อย' });
  } catch (e) {
    console.error('[LINE_UNLINK_ERROR]:', e.message);
    res.status(500).json({ success: false, message: 'ไม่สามารถยกเลิกการเชื่อมต่อได้' });
  }
});

// ---------------- Public Webhook ----------------

router.post('/webhook', verifyLineSignature, async (req, res) => {
  const events = req.body.events || [];

  for (const event of events) {
    try {
      await handleWebhookEvent(event);
    } catch (err) {
      console.error('[LINE_EVENT_HANDLER_ERROR]:', err.message);
    }
  }

  res.status(200).json({ success: true });
});

async function handleWebhookEvent(event) {
  const lineUserId = event.source?.userId;
  if (!lineUserId) return;

  // 1. Follow event: User adds the LINE Official Account
  if (event.type === 'follow') {
    await lineService.replyMessage(event.replyToken, {
      type: 'text',
      text: 'ยินดีต้อนรับสู่ IT Equipment Management System Bot!\n\nกรุณาเข้าสู่ระบบผ่านเว็บเพื่อกด "เชื่อมต่อ LINE" และนำรหัส PIN 6 หลักมาส่งในแชทนี้เพื่อผูกบัญชีครับ',
    });
    return;
  }

  // 2. Message event
  if (event.type === 'message' && event.message?.type === 'text') {
    const text = event.message.text.trim();

    // Check if message is a 6-digit numeric PIN for account linking
    if (/^\d{6}$/.test(text)) {
      const [tokens] = await pool.execute(`
        SELECT t.token_id, t.user_id, u.name, r.role_name
        FROM line_link_tokens t
        JOIN users u ON u.user_id = t.user_id
        JOIN roles r ON r.role_id = u.role_id
        WHERE t.pin_code = ? AND t.is_used = 0 AND t.expires_at > NOW()
      `, [text]);

      if (!tokens.length) {
        await lineService.replyMessage(event.replyToken, {
          type: 'text',
          text: '❌ รหัสยืนยันไม่ถูกต้องหรือหมดอายุแล้ว กรุณากดขอรหัสใหม่จากหน้าโปรไฟล์บนเว็บ',
        });
        return;
      }

      const match = tokens[0];

      // Update user line_user_id and mark token used
      await pool.execute('UPDATE users SET line_user_id = ? WHERE user_id = ?', [lineUserId, match.user_id]);
      await pool.execute('UPDATE line_link_tokens SET is_used = 1 WHERE token_id = ?', [match.token_id]);

      try {
        await writeAudit({ userId: match.user_id, action: 'LINK_LINE_ACCOUNT', tableName: 'users', recordId: match.user_id });
      } catch {}

      // Emit realtime event to update web UI immediately
      emitToUser(match.user_id, 'line:linked', { line_user_id: lineUserId });

      await lineService.replyMessage(event.replyToken, {
        type: 'text',
        text: `✅ เชื่อมต่อบัญชีสำเร็จ!\nคุณ: ${match.name}\nสิทธิ์: ${match.role_name}\n\nคุณจะได้รับการแจ้งเตือนและการทำรายการผ่าน LINE ตั้งแต่นี้เป็นต้นไปครับ`,
      });
      return;
    }
  }
}

module.exports = router;
