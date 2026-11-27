const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../config/permissions');
const lineService = require('../services/line');

const router = express.Router();
router.use(authenticateToken);

router.get('/', requirePermission(PERMISSIONS.USER_READ), async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT u.user_id, u.role_id, u.name, u.username, u.status, u.created_at, r.role_name FROM users u JOIN roles r ON r.role_id=u.role_id ORDER BY u.user_id DESC`);
    res.json({ success: true, data: rows });
  } catch (error) { res.status(500).json({ success: false, message: 'ไม่สามารถโหลดผู้ใช้งานได้' }); }
});

router.get('/roles', requirePermission(PERMISSIONS.USER_READ), async (req, res) => {
  try {
    const [rows] = await db.query('SELECT role_id, role_name FROM roles ORDER BY role_id');
    res.json({ success: true, data: rows });
  } catch (error) { res.status(500).json({ success: false, message: 'ไม่สามารถโหลดสิทธิ์ผู้ใช้งานได้' }); }
});

router.post('/', requirePermission(PERMISSIONS.USER_CREATE), async (req, res) => {
  try {
    const { name, username, password, role_id, status = 'Active' } = req.body;
    if (!name || !username || !password || !role_id) return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบ' });
    const hash = await bcrypt.hash(password, 12);
    const [result] = await db.execute('INSERT INTO users (role_id,name,username,password_hash,status) VALUES (?,?,?,?,?)', [role_id,name,username,hash,status]);
    res.status(201).json({ success: true, user_id: result.insertId });
  } catch (error) { res.status(400).json({ success: false, message: error.code === 'ER_DUP_ENTRY' ? 'Username นี้มีอยู่แล้ว' : error.message }); }
});

router.put('/:id', requirePermission(PERMISSIONS.USER_UPDATE), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, username, password, role_id, status } = req.body;
    if (!id || !name || !username || !role_id || !status) return res.status(400).json({ success: false, message: 'ข้อมูลไม่ครบถ้วน' });
    const currentUserId = req.user.id || req.user.user_id;
    if (id === currentUserId && status !== 'Active') return res.status(400).json({ success: false, message: 'ไม่สามารถปิดใช้งานบัญชีของตนเองได้' });
    if (password) {
      const hash = await bcrypt.hash(password, 12);
      await db.execute('UPDATE users SET name=?, username=?, password_hash=?, role_id=?, status=? WHERE user_id=?', [name, username, hash, role_id, status, id]);
    } else {
      await db.execute('UPDATE users SET name=?, username=?, role_id=?, status=? WHERE user_id=?', [name, username, role_id, status, id]);
    }

    // Sync Per-User Rich Menu if user is linked with LINE
    try {
      const [uRows] = await db.query(
        'SELECT u.line_user_id, r.role_name FROM users u JOIN roles r ON r.role_id = u.role_id WHERE u.user_id = ?',
        [id]
      );
      if (uRows.length && uRows[0].line_user_id) {
        await lineService.syncUserRichMenu(uRows[0].line_user_id, uRows[0].role_name, status);
      }
    } catch (e) {
      console.warn('[LINE_USER_UPDATE_SYNC_WARN]:', e.message);
    }

    res.json({ success: true, message: 'แก้ไขผู้ใช้งานสำเร็จ' });
  } catch (error) { res.status(400).json({ success: false, message: error.code === 'ER_DUP_ENTRY' ? 'Username นี้มีอยู่แล้ว' : error.message }); }
});

router.delete('/:id', requirePermission(PERMISSIONS.USER_DELETE), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'รหัสผู้ใช้งานไม่ถูกต้อง' });
    const currentUserId = req.user.id || req.user.user_id;
    if (id === currentUserId) return res.status(400).json({ success: false, message: 'ไม่สามารถลบบัญชีของตนเองได้' });

    let lineUserId = null;
    try {
      const [uRows] = await db.query('SELECT line_user_id FROM users WHERE user_id = ?', [id]);
      if (uRows.length) lineUserId = uRows[0].line_user_id;
    } catch {}

    await db.execute('DELETE FROM users WHERE user_id=?', [id]);

    if (lineUserId) {
      try {
        await lineService.syncUserRichMenu(lineUserId, null, 'Inactive');
      } catch {}
    }

    res.json({ success: true, message: 'ลบผู้ใช้งานสำเร็จ' });
  } catch (error) {
    const message = error.code === 'ER_ROW_IS_REFERENCED_2' || error.code === 'ER_ROW_IS_REFERENCED' ? 'ผู้ใช้งานมีประวัติการทำรายการ ไม่สามารถลบได้ ให้เปลี่ยนสถานะเป็น Inactive แทน' : error.message;
    res.status(400).json({ success: false, message });
  }
});

module.exports = router;

