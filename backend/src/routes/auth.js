const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { writeAudit } = require('../services/audit');
const { permissionsForRole } = require('../config/permissions');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'กรุณากรอก Username และ Password' });
    }

    const [rows] = await pool.execute(
      `SELECT u.user_id, u.name, u.username, u.password_hash, u.status, r.role_name AS role
       FROM users u
       JOIN roles r ON r.role_id = u.role_id
       WHERE u.username = ? LIMIT 1`,
      [username]
    );

    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'Username หรือ Password ไม่ถูกต้อง' });
    }

    if (rows[0].status !== 'Active') {
      return res.status(403).json({ success: false, message: 'บัญชีผู้ใช้งานถูกระงับ' });
    }

    const isMatch = await bcrypt.compare(password, rows[0].password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Username หรือ Password ไม่ถูกต้อง' });
    }

    const user = {
      id: rows[0].user_id,
      name: rows[0].name,
      username: rows[0].username,
      role: rows[0].role,
    };

    const token = jwt.sign(user, process.env.JWT_SECRET || 'dev-secret-change-me', { expiresIn: '8h' });

    try {
      await writeAudit({ userId: user.id, action: 'LOGIN', tableName: 'users', recordId: user.id });
    } catch (e) {
      console.error('AUDIT_LOGIN_ERROR:', e.message);
    }

    return res.json({
      success: true,
      token,
      user,
      permissions: permissionsForRole(user.role),
    });
  } catch (e) {
    console.error('LOGIN_ERROR:', e.message);
    return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดของเซิร์ฟเวอร์ในการเข้าสู่ระบบ' });
  }
});

router.get('/permissions', authenticateToken, async (req, res) => {
  res.json({ success: true, role: req.user.role, permissions: permissionsForRole(req.user.role) });
});

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT u.user_id, u.name, u.username, u.status, r.role_name AS role, u.created_at
       FROM users u
       JOIN roles r ON r.role_id = u.role_id
       WHERE u.user_id = ? LIMIT 1`,
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้งาน' });
    res.json({ success: true, data: rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, message: 'ไม่สามารถโหลดข้อมูลผู้ใช้ได้' });
  }
});

router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { old_password, new_password } = req.body;
    if (!old_password || !new_password) {
      return res.status(400).json({ success: false, message: 'กรุณากรอกรหัสผ่านเดิมและรหัสผ่านใหม่' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ success: false, message: 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร' });
    }

    const [rows] = await pool.execute('SELECT password_hash FROM users WHERE user_id = ?', [req.user.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้งาน' });

    const isMatch = await bcrypt.compare(old_password, rows[0].password_hash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'รหัสผ่านเดิมไม่ถูกต้อง' });
    }

    const newHash = await bcrypt.hash(new_password, 12);
    await pool.execute('UPDATE users SET password_hash = ? WHERE user_id = ?', [newHash, req.user.id]);

    try {
      await writeAudit({ userId: req.user.id, action: 'CHANGE_PASSWORD', tableName: 'users', recordId: req.user.id });
    } catch (e) {
      console.error('AUDIT_PASS_ERROR:', e.message);
    }

    res.json({ success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
  } catch (e) {
    console.error('CHANGE_PASSWORD_ERROR:', e.message);
    res.status(500).json({ success: false, message: 'ไม่สามารถเปลี่ยนรหัสผ่านได้' });
  }
});

router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ success: false, message: 'กรุณากรอกชื่อ-นามสกุล' });

    await pool.execute('UPDATE users SET name = ? WHERE user_id = ?', [name, req.user.id]);

    const updatedUser = {
      ...req.user,
      name,
    };
    const token = jwt.sign(updatedUser, process.env.JWT_SECRET || 'dev-secret-change-me', { expiresIn: '8h' });

    try {
      await writeAudit({ userId: req.user.id, action: 'UPDATE_PROFILE', tableName: 'users', recordId: req.user.id });
    } catch (e) {
      console.error('AUDIT_PROFILE_ERROR:', e.message);
    }

    res.json({ success: true, message: 'อัปเดตข้อมูลส่วนตัวสำเร็จ', user: updatedUser, token });
  } catch (e) {
    console.error('UPDATE_PROFILE_ERROR:', e.message);
    res.status(500).json({ success: false, message: 'ไม่สามารถอัปเดตข้อมูลได้' });
  }
});

module.exports = router;
