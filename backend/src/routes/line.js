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
    await pool.execute('UPDATE line_link_tokens SET is_used = 1 WHERE user_id = ? AND is_used = 0', [userId]);

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

function getRoleQuickReply(roleName) {
  const isStaff = ['Administrator', 'Staff'].includes(roleName);
  const items = [
    { type: 'action', action: { type: 'message', label: '📋 รายการยืมของฉัน', text: 'รายการยืมของฉัน' } },
    { type: 'action', action: { type: 'message', label: '📦 อุปกรณ์ว่าง', text: 'อุปกรณ์ว่าง' } },
  ];

  if (isStaff) {
    items.push({ type: 'action', action: { type: 'message', label: '⏳ คำขอรออนุมัติ', text: 'คำขอรออนุมัติ' } });
    items.push({ type: 'action', action: { type: 'message', label: '🔧 รายการแจ้งซ่อม', text: 'รายการแจ้งซ่อม' } });
  }

  items.push({ type: 'action', action: { type: 'message', label: '❓ ช่วยเหลือ', text: 'ช่วยเหลือ' } });

  return { items };
}

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

  // Look up current linked user in DB
  const [users] = await pool.execute(`
    SELECT u.user_id, u.name, u.status, r.role_name
    FROM users u
    JOIN roles r ON r.role_id = u.role_id
    WHERE u.line_user_id = ?
  `, [lineUserId]);
  const currentUser = users.length ? users[0] : null;

  // 2. Postback event (e.g. Staff approving or rejecting loan via button)
  if (event.type === 'postback') {
    const params = new URLSearchParams(event.postback?.data || '');
    const action = params.get('action');
    const loanId = params.get('loan_id');

    if (!currentUser || currentUser.status !== 'Active') {
      await lineService.replyMessage(event.replyToken, {
        type: 'text',
        text: '⚠️ บัญชี LINE นี้ยังไม่ได้เชื่อมต่อกับระบบ กรุณาเข้าสู่ระบบผ่านเว็บเพื่อทำการผูกบัญชีก่อนครับ',
      });
      return;
    }

    // Role check: Only Administrator and Staff can approve/reject
    if (!['Administrator', 'Staff'].includes(currentUser.role_name)) {
      await lineService.replyMessage(event.replyToken, {
        type: 'text',
        text: '⛔ ขออภัย คุณไม่มีสิทธิ์ดำเนินการอนุมัติหรือปฏิเสธคำขอนี้',
      });
      return;
    }

    if (action === 'approve_loan' && loanId) {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        const [rows] = await conn.execute(`
          SELECT l.*, e.status AS equipment_status, e.equipment_name, b.name AS borrower_name, b.line_user_id AS borrower_line_id
          FROM loans l
          JOIN equipment e ON e.equipment_id = l.equipment_id
          JOIN users b ON b.user_id = l.borrower_id
          WHERE l.loan_id = ? FOR UPDATE
        `, [loanId]);

        if (!rows.length) {
          await conn.rollback();
          await lineService.replyMessage(event.replyToken, { type: 'text', text: '❌ ไม่พบข้อมูลคำขอยืมนี้ในระบบ' });
          return;
        }

        const loan = rows[0];
        if (loan.status !== 'Pending') {
          await conn.rollback();
          await lineService.replyMessage(event.replyToken, {
            type: 'text',
            text: `ℹ️ คำขอยืม #${loanId} ได้รับการดำเนินการไปแล้ว (สถานะปัจจุบัน: ${loan.status})`,
          });
          return;
        }

        if (loan.equipment_status !== 'Available') {
          await conn.rollback();
          await lineService.replyMessage(event.replyToken, {
            type: 'text',
            text: `⚠️ อุปกรณ์ (${loan.equipment_name}) ไม่พร้อมให้ยืมในขณะนี้`,
          });
          return;
        }

        // Update loan and equipment to Borrowed
        await conn.execute(
          `UPDATE loans SET status = 'Borrowed', borrow_date = NOW(), approved_by = ?, approved_at = NOW() WHERE loan_id = ?`,
          [currentUser.user_id, loanId]
        );
        await conn.execute(`UPDATE equipment SET status = 'Borrowed' WHERE equipment_id = ?`, [loan.equipment_id]);
        await conn.commit();

        try {
          await writeAudit({ userId: currentUser.user_id, action: 'APPROVE_LOAN', tableName: 'loans', recordId: loanId });
        } catch {}

        // Reply to staff
        await lineService.replyMessage(event.replyToken, {
          type: 'text',
          text: `✅ อนุมัติคำขอยืม #${loanId} สำเร็จเรียบร้อย!\nอุปกรณ์: ${loan.equipment_name}\nผู้ยืม: ${loan.borrower_name}\nอนุมัติโดย: ${currentUser.name}`,
        });

        // Notify borrower via LINE push if linked
        if (loan.borrower_line_id) {
          await lineService.sendPush(
            loan.borrower_line_id,
            lineService.buildLoanDecisionCard(loan, true, currentUser.name)
          );
        }

        // Refresh web client views
        emitToAll('data:refresh', { source: '/api/loan', method: 'PUT' });
      } catch (err) {
        await conn.rollback();
        console.error('[LINE_APPROVE_ERROR]:', err.message);
        await lineService.replyMessage(event.replyToken, { type: 'text', text: 'เกิดข้อผิดพลาดในการอนุมัติคำขอ' });
      } finally {
        conn.release();
      }
      return;
    }

    if (action === 'reject_loan_init' && loanId) {
      // Check loan still pending
      const [rows] = await pool.execute('SELECT loan_id, status FROM loans WHERE loan_id = ?', [loanId]);
      if (!rows.length || rows[0].status !== 'Pending') {
        await lineService.replyMessage(event.replyToken, {
          type: 'text',
          text: `ℹ️ คำขอยืม #${loanId} ไม่อยู่ในสถานะรออนุมัติแล้ว`,
        });
        return;
      }

      // Save conversational state in line_conversation_states
      await pool.execute(`
        INSERT INTO line_conversation_states (user_id, state_action, payload, expires_at)
        VALUES (?, 'AWAITING_REJECT_REASON', ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE))
        ON DUPLICATE KEY UPDATE 
          state_action = VALUES(state_action),
          payload = VALUES(payload),
          expires_at = VALUES(expires_at)
      `, [currentUser.user_id, JSON.stringify({ loan_id: Number(loanId) })]);

      await lineService.replyMessage(event.replyToken, {
        type: 'text',
        text: `📝 กรุณาพิมพ์ระบุเหตุผลการไม่อนุมัติคำขอยืม #${loanId} ส่งกลับมาในแชทนี้ (หรือแตะเลือกเหตุผลด่วนด้านล่าง):`,
        quickReply: {
          items: [
            { type: 'action', action: { type: 'message', label: '🛠️ อุปกรณ์ชำรุด/ส่งซ่อม', text: 'อุปกรณ์ชำรุด/ต้องส่งซ่อม' } },
            { type: 'action', action: { type: 'message', label: '📦 ติดจองใช้งานส่วนกลาง', text: 'อุปกรณ์ติดจองใช้งานส่วนกลาง' } },
            { type: 'action', action: { type: 'message', label: '⚠️ ข้อมูลผู้ยืมไม่ครบ', text: 'ข้อมูลหรือเหตุผลการยืมไม่ครบถ้วน' } },
            { type: 'action', action: { type: 'message', label: '❌ ยกเลิก', text: 'ยกเลิก' } },
          ],
        },
      });
      return;
    }

    if (action === 'update_maint_status') {
      const maintId = params.get('maint_id');
      const toStatus = params.get('to_status');

      const allowed = ['Received', 'Diagnosing', 'Repairing', 'Completed', 'Cancelled'];
      if (!allowed.includes(toStatus)) {
        await lineService.replyMessage(event.replyToken, {
          type: 'text',
          text: '⚠️ สถานะไม่ถูกต้อง',
          quickReply: getRoleQuickReply(currentUser.role_name),
        });
        return;
      }

      const [rows] = await pool.execute(`
        SELECT m.*, e.equipment_name, e.asset_code, u.name AS reporter_name, u.line_user_id AS reporter_line_id
        FROM maintenance m
        JOIN equipment e ON e.equipment_id = m.equipment_id
        JOIN users u ON u.user_id = m.reporter_id
        WHERE m.maintenance_id = ?
      `, [maintId]);

      if (!rows.length) {
        await lineService.replyMessage(event.replyToken, {
          type: 'text',
          text: '❌ ไม่พบรายการแจ้งซ่อมนี้ในระบบ',
          quickReply: getRoleQuickReply(currentUser.role_name),
        });
        return;
      }

      const ticket = rows[0];
      if (['Completed', 'Cancelled'].includes(ticket.status)) {
        await lineService.replyMessage(event.replyToken, {
          type: 'text',
          text: `ℹ️ รายการแจ้งซ่อม #${maintId} (${ticket.equipment_name}) ได้เสร็จสิ้นหรือยกเลิกไปแล้ว (สถานะปัจจุบัน: ${ticket.status})`,
          quickReply: getRoleQuickReply(currentUser.role_name),
        });
        return;
      }

      let startedAt = ticket.started_at;
      let completedAt = ticket.completed_at;
      if (['Diagnosing', 'Repairing'].includes(toStatus) && !startedAt) {
        startedAt = new Date();
      }
      if (['Completed', 'Cancelled'].includes(toStatus)) {
        completedAt = new Date();
      }

      const remark = `อัปเดตผ่าน LINE โดย ${currentUser.name}`;

      await pool.execute(`
        UPDATE maintenance
        SET status = ?, technician_id = COALESCE(technician_id, ?), started_at = COALESCE(?, started_at), completed_at = COALESCE(?, completed_at)
        WHERE maintenance_id = ?
      `, [toStatus, currentUser.user_id, startedAt, completedAt, maintId]);

      await pool.execute(
        `INSERT INTO maintenance_logs(maintenance_id, status, remark, updated_by) VALUES(?, ?, ?, ?)`,
        [maintId, toStatus, remark, currentUser.user_id]
      );

      // Equipment status sync
      if (['Completed', 'Cancelled'].includes(toStatus)) {
        await pool.execute(
          `UPDATE equipment SET status = CASE WHEN status = 'Maintenance' THEN 'Available' ELSE status END WHERE equipment_id = ?`,
          [ticket.equipment_id]
        );
      } else {
        await pool.execute(
          `UPDATE equipment SET status = 'Maintenance' WHERE equipment_id = ? AND status <> 'Borrowed'`,
          [ticket.equipment_id]
        );
      }

      try {
        await writeAudit({ userId: currentUser.user_id, action: 'UPDATE_MAINTENANCE_STATUS', tableName: 'maintenance', recordId: maintId });
      } catch {}

      emitToAll('data:refresh', { source: '/api/maintenance', method: 'PUT' });

      const statusLabels = {
        Repairing: 'กำลังซ่อมแซม 🔧',
        Completed: 'ซ่อมเสร็จสิ้นแล้ว 🎉',
        Cancelled: 'ยกเลิกการแจ้งซ่อม ❌',
        Received: 'รับเรื่องแล้ว 📋',
      };
      const label = statusLabels[toStatus] || toStatus;

      // Reply to staff
      await lineService.replyMessage(event.replyToken, {
        type: 'text',
        text: `✅ อัปเดตรายการแจ้งซ่อม #${maintId} (${ticket.equipment_name})\n\nสถานะใหม่: ${label}\nดำเนินการโดย: ${currentUser.name}${toStatus === 'Completed' ? '\n\n📦 อุปกรณ์กลับสู่สถานะพร้อมใช้งาน (Available) เรียบร้อยแล้วครับ' : ''}`,
        quickReply: getRoleQuickReply(currentUser.role_name),
      });

      // Push notice to reporter if linked
      if (ticket.reporter_line_id) {
        await lineService.sendPush(ticket.reporter_line_id, {
          type: 'text',
          text: `🔔 แจ้งเตือนสถานะงานซ่อม\n\nรายการ #${maintId} (${ticket.equipment_name})\nสถานะ: ${label}\nเจ้าหน้าที่: ${currentUser.name}`,
        });
      }
      return;
    }
  }

  // 3. Message event
  if (event.type === 'message' && event.message?.type === 'text') {
    const text = event.message.text.trim();

    // Account linking PIN (6 digits)
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
      // Detach any previous owner of this LINE ID to prevent unique constraint error
      await pool.execute('UPDATE users SET line_user_id = NULL WHERE line_user_id = ?', [lineUserId]);
      await pool.execute('UPDATE users SET line_user_id = ? WHERE user_id = ?', [lineUserId, match.user_id]);
      await pool.execute('UPDATE line_link_tokens SET is_used = 1 WHERE token_id = ?', [match.token_id]);

      try {
        await writeAudit({ userId: match.user_id, action: 'LINK_LINE_ACCOUNT', tableName: 'users', recordId: match.user_id });
      } catch {}

      emitToUser(match.user_id, 'line:linked', { line_user_id: lineUserId });

      await lineService.replyMessage(event.replyToken, {
        type: 'text',
        text: `✅ เชื่อมต่อบัญชีสำเร็จ!\nคุณ: ${match.name}\nสิทธิ์: ${match.role_name}\n\nคุณจะได้รับการแจ้งเตือนและการทำรายการผ่าน LINE ตั้งแต่นี้เป็นต้นไปครับ แตะปุ่มลัดด้านล่างเพื่อเริ่มใช้งานได้เลย`,
        quickReply: getRoleQuickReply(match.role_name),
      });
      return;
    }

    // Check if user has an active conversation state (e.g. waiting for reject reason)
    if (currentUser) {
      const [states] = await pool.execute(
        'SELECT * FROM line_conversation_states WHERE user_id = ? AND expires_at > NOW()',
        [currentUser.user_id]
      );

      if (states.length && states[0].state_action === 'AWAITING_REJECT_REASON') {
        const payload = JSON.parse(states[0].payload || '{}');
        const loanId = payload.loan_id;

        // User typed cancel
        if (text === 'ยกเลิก' || text.toLowerCase() === 'cancel') {
          await pool.execute('DELETE FROM line_conversation_states WHERE user_id = ?', [currentUser.user_id]);
          await lineService.replyMessage(event.replyToken, {
            type: 'text',
            text: `ยกเลิกการปฏิเสธคำขอยืม #${loanId} เรียบร้อยแล้ว รายการยังคงอยู่ในสถานะรออนุมัติ`,
            quickReply: getRoleQuickReply(currentUser.role_name),
          });
          return;
        }

        // Process rejection with provided reason
        const [rows] = await pool.execute(`
          SELECT l.*, e.equipment_name, b.name AS borrower_name, b.line_user_id AS borrower_line_id
          FROM loans l
          JOIN equipment e ON e.equipment_id = l.equipment_id
          JOIN users b ON b.user_id = l.borrower_id
          WHERE l.loan_id = ?
        `, [loanId]);

        if (rows.length && rows[0].status === 'Pending') {
          const loan = rows[0];
          const [upd] = await pool.execute(
            `UPDATE loans SET status = 'Rejected', remark = ?, approved_by = ?, approved_at = NOW() WHERE loan_id = ? AND status = 'Pending'`,
            [text, currentUser.user_id, loanId]
          );
          await pool.execute('DELETE FROM line_conversation_states WHERE user_id = ?', [currentUser.user_id]);

          if (upd.affectedRows === 0) {
            await lineService.replyMessage(event.replyToken, {
              type: 'text',
              text: `ℹ️ คำขอยืม #${loanId} ได้รับการดำเนินการไปแล้ว`,
              quickReply: getRoleQuickReply(currentUser.role_name),
            });
            return;
          }

          try {
            await writeAudit({ userId: currentUser.user_id, action: 'REJECT_LOAN', tableName: 'loans', recordId: loanId });
          } catch {}

          // Reply to staff
          await lineService.replyMessage(event.replyToken, {
            type: 'text',
            text: `✅ ปฏิเสธคำขอยืม #${loanId} เรียบร้อยแล้ว\nเหตุผล: ${text}\nระบบได้แจ้งผลไปยังผู้ยืมแล้วครับ`,
            quickReply: getRoleQuickReply(currentUser.role_name),
          });

          // Push notice to borrower
          if (loan.borrower_line_id) {
            await lineService.sendPush(
              loan.borrower_line_id,
              lineService.buildLoanDecisionCard(loan, false, currentUser.name, text)
            );
          }

          emitToAll('data:refresh', { source: '/api/loan', method: 'PUT' });
        } else {
          await pool.execute('DELETE FROM line_conversation_states WHERE user_id = ?', [currentUser.user_id]);
          await lineService.replyMessage(event.replyToken, {
            type: 'text',
            text: `ℹ️ คำขอยืม #${loanId} ไม่อยู่ในสถานะรออนุมัติแล้ว`,
            quickReply: getRoleQuickReply(currentUser.role_name),
          });
        }
        return;
      }

      // Keyword: รายการยืมของฉัน
      if (
        text === 'รายการยืมของฉัน' ||
        text === 'ยืมอะไรอยู่' ||
        text === 'สถานะการยืม' ||
        text.includes('รายการยืมของฉัน') ||
        text.includes('ยืมของฉัน')
      ) {
        const [myLoans] = await pool.execute(`
          SELECT l.*, e.equipment_name, e.asset_code
          FROM loans l
          JOIN equipment e ON e.equipment_id = l.equipment_id
          WHERE l.borrower_id = ? AND l.status IN ('Pending', 'Borrowed', 'Overdue')
          ORDER BY l.loan_id DESC
        `, [currentUser.user_id]);

        const cardOrMsg = lineService.buildUserLoansCarousel(myLoans);
        cardOrMsg.quickReply = getRoleQuickReply(currentUser.role_name);
        await lineService.replyMessage(event.replyToken, cardOrMsg);
        return;
      }

      // Keyword: คำขอรออนุมัติ (สำหรับ Staff/Admin)
      if (
        text === 'คำขอรออนุมัติ' ||
        text === 'รออนุมัติ' ||
        text === 'อนุมัติคำขอ' ||
        text.includes('คำขอรออนุมัติ') ||
        text.includes('รออนุมัติ')
      ) {
        if (!['Administrator', 'Staff'].includes(currentUser.role_name)) {
          await lineService.replyMessage(event.replyToken, {
            type: 'text',
            text: '⛔ ขออภัย คำสั่งนี้สำหรับเจ้าหน้าที่ดูแลอุปกรณ์เท่านั้นครับ',
            quickReply: getRoleQuickReply(currentUser.role_name),
          });
          return;
        }

        const [pendingLoans] = await pool.execute(`
          SELECT l.*, e.equipment_name, e.asset_code, u.name AS borrower_name
          FROM loans l
          JOIN equipment e ON e.equipment_id = l.equipment_id
          JOIN users u ON u.user_id = l.borrower_id
          WHERE l.status = 'Pending'
          ORDER BY l.loan_id DESC
          LIMIT 5
        `);

        if (!pendingLoans.length) {
          await lineService.replyMessage(event.replyToken, {
            type: 'text',
            text: '🎉 ขณะนี้ไม่มีคำขอยืมอุปกรณ์ที่รออนุมัติครับ',
            quickReply: getRoleQuickReply(currentUser.role_name),
          });
          return;
        }

        const carousel = lineService.buildPendingLoansCarousel(pendingLoans);
        carousel.quickReply = getRoleQuickReply(currentUser.role_name);
        await lineService.replyMessage(event.replyToken, carousel);
        return;
      }

      // Keyword: รายการแจ้งซ่อม (สำหรับ Staff/Admin)
      if (
        text === 'รายการแจ้งซ่อม' ||
        text === 'งานซ่อม' ||
        text === 'แจ้งซ่อม' ||
        text.includes('รายการแจ้งซ่อม') ||
        text.includes('งานซ่อม') ||
        text.includes('แจ้งซ่อม')
      ) {
        const [tickets] = await pool.execute(`
          SELECT m.*, e.equipment_name, e.asset_code, u.name AS reporter_name
          FROM maintenance m
          JOIN equipment e ON e.equipment_id = m.equipment_id
          JOIN users u ON u.user_id = m.reporter_id
          WHERE m.status IN ('Reported', 'In_Progress')
          ORDER BY m.maintenance_id DESC
          LIMIT 5
        `);

        if (!tickets.length) {
          await lineService.replyMessage(event.replyToken, {
            type: 'text',
            text: '✅ ขณะนี้ไม่มีรายการแจ้งซ่อมที่ค้างอยู่ครับ',
            quickReply: getRoleQuickReply(currentUser.role_name),
          });
          return;
        }

        const carousel = lineService.buildMaintenanceTicketsCarousel(tickets);
        carousel.quickReply = getRoleQuickReply(currentUser.role_name);
        await lineService.replyMessage(event.replyToken, carousel);
        return;
      }

      // Keyword: อุปกรณ์ว่าง
      if (
        text === 'อุปกรณ์ว่าง' ||
        text === 'เช็คอุปกรณ์' ||
        text === 'ค้นหาอุปกรณ์' ||
        text.includes('อุปกรณ์ว่าง')
      ) {
        const [counts] = await pool.execute("SELECT COUNT(*) AS total FROM equipment WHERE status = 'Available'");
        const [items] = await pool.execute(`
          SELECT e.equipment_name, e.asset_code, c.category_name
          FROM equipment e
          JOIN categories c ON c.category_id = e.category_id
          WHERE e.status = 'Available'
          ORDER BY e.equipment_id DESC
          LIMIT 6
        `);

        const total = counts[0].total || 0;
        const card = lineService.buildAvailableEquipmentCard(total, items);
        card.quickReply = getRoleQuickReply(currentUser.role_name);
        await lineService.replyMessage(event.replyToken, card);
        return;
      }

      // Keyword: ช่วยเหลือ / เมนู
      if (
        text === 'ช่วยเหลือ' ||
        text === 'เมนู' ||
        text.toLowerCase() === 'help' ||
        text.includes('ช่วยเหลือ') ||
        text.includes('เมนู')
      ) {
        const card = lineService.buildHelpCard(currentUser);
        card.quickReply = getRoleQuickReply(currentUser.role_name);
        await lineService.replyMessage(event.replyToken, card);
        return;
      }

      // Default reply for linked user if message not recognized
      const isStaff = ['Administrator', 'Staff'].includes(currentUser.role_name);
      let desc = `🤖 คุณ: ${currentUser.name} (${currentUser.role_name})\n\nแตะเลือกเมนูลัด (Quick Reply) ด้านล่างเพื่อสั่งการบอทได้เลยครับ:`;

      await lineService.replyMessage(event.replyToken, {
        type: 'text',
        text: desc,
        quickReply: getRoleQuickReply(currentUser.role_name),
      });
      return;
    } else {
      // User is not linked yet
      await lineService.replyMessage(event.replyToken, {
        type: 'text',
        text: '👋 สวัสดีครับ บัญชี LINE ของคุณยังไม่ได้เชื่อมต่อกับระบบ IT Equipment\n\n📌 วิธีเชื่อมต่อ:\n1. เข้าสู่ระบบผ่านหน้าเว็บ\n2. กดที่โปรไฟล์ -> เลือกแท็บ "การเชื่อมต่อ LINE"\n3. กดปุ่ม "ขอรหัสเชื่อมต่อ LINE (PIN)"\n4. นำรหัส PIN 6 หลักที่ได้มาส่งในแชทนี้เพื่อเริ่มต้นใช้งานครับ',
        quickReply: {
          items: [
            { type: 'action', action: { type: 'message', label: '❓ ช่วยเหลือ', text: 'ช่วยเหลือ' } },
            { type: 'action', action: { type: 'message', label: '📦 อุปกรณ์ว่าง', text: 'อุปกรณ์ว่าง' } },
          ],
        },
      });
      return;
    }
  }
}

module.exports = router;
