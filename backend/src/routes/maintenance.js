const express = require('express');
const pool = require('../db');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../config/permissions');
const { writeAudit } = require('../services/audit');
const { createNotification, notifyRoles } = require('../services/notification');
const lineService = require('../services/line');

const router = express.Router();
router.use(authenticateToken);

const auditSafe = async (data) => {
  try {
    await writeAudit(data);
  } catch (e) {
    console.error('AUDIT_MAINT_ERROR:', e.message);
  }
};

const notifySafe = async (fn) => {
  try {
    await fn();
  } catch (e) {
    console.error('NOTIFICATION_MAINT_ERROR:', e.message);
  }
};

router.get('/', requirePermission(PERMISSIONS.MAINTENANCE_READ), async (req, res) => {
  try {
    const { status = '', priority = '', search = '' } = req.query;
    const p = [];
    let w = 'WHERE 1=1';

    if (req.user.role === 'Borrower') {
      w += ' AND m.reporter_id = ?';
      p.push(req.user.id);
    }
    if (status) {
      w += ' AND m.status = ?';
      p.push(status);
    }
    if (priority) {
      w += ' AND m.priority = ?';
      p.push(priority);
    }
    if (search) {
      w += ' AND (e.asset_code LIKE ? OR e.equipment_name LIKE ? OR m.problem_type LIKE ? OR m.problem_description LIKE ? OR u.name LIKE ?)';
      const q = `%${search}%`;
      p.push(q, q, q, q, q);
    }

    const [rows] = await pool.execute(`
      SELECT m.*, e.asset_code, e.equipment_name,
             u.name AS reporter_name,
             t.name AS technician_name
      FROM maintenance m
      JOIN equipment e ON e.equipment_id = m.equipment_id
      JOIN users u ON u.user_id = m.reporter_id
      LEFT JOIN users t ON t.user_id = m.technician_id
      ${w}
      ORDER BY m.maintenance_id DESC
    `, p);

    res.json({ success: true, data: rows });
  } catch (e) {
    console.error('MAINT_LIST_ERROR:', e.message);
    res.status(500).json({ success: false, message: 'ไม่สามารถโหลดรายการแจ้งซ่อมได้' });
  }
});

router.get('/equipment', requirePermission(PERMISSIONS.MAINTENANCE_READ), async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT e.equipment_id, e.asset_code, e.equipment_name, e.brand, e.model, e.status
      FROM equipment e
      WHERE e.status NOT IN ('Retired', 'Lost')
      ORDER BY e.equipment_name, e.asset_code
    `);
    res.json({ success: true, data: rows });
  } catch (e) {
    res.status(500).json({ success: false, message: 'ไม่สามารถโหลดอุปกรณ์ได้' });
  }
});

router.get('/technicians', requirePermission(PERMISSIONS.MAINTENANCE_READ), async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT u.user_id, u.name, u.username, r.role_name
      FROM users u
      JOIN roles r ON r.role_id = u.role_id
      WHERE r.role_name IN ('Staff', 'Administrator') AND u.status = 'Active'
      ORDER BY u.name ASC
    `);
    res.json({ success: true, data: rows });
  } catch (e) {
    res.status(500).json({ success: false, message: 'ไม่สามารถโหลดรายชื่อช่าง/เจ้าหน้าที่ได้' });
  }
});

router.post('/', requirePermission(PERMISSIONS.MAINTENANCE_CREATE), async (req, res) => {
  try {
    const { equipment_id, problem_type, problem_description, priority = 'Normal' } = req.body;
    if (!equipment_id || !problem_type || !problem_description) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุอุปกรณ์ ประเภทปัญหา และรายละเอียดปัญหา' });
    }

    const [r] = await pool.execute(
      `INSERT INTO maintenance(equipment_id, reporter_id, problem_type, problem_description, priority, status)
       VALUES(?, ?, ?, ?, ?, 'Reported')`,
      [equipment_id, req.user.id, problem_type, problem_description, priority]
    );

    // Initial log
    await pool.execute(
      `INSERT INTO maintenance_logs(maintenance_id, status, remark, updated_by) VALUES (?, 'Reported', 'ส่งเรื่องแจ้งซ่อมเข้าระบบ', ?)`,
      [r.insertId, req.user.id]
    );

    await pool.execute(
      `UPDATE equipment SET status = 'Maintenance' WHERE equipment_id = ? AND status NOT IN ('Borrowed')`,
      [equipment_id]
    );

    await auditSafe({ userId: req.user.id, action: 'CREATE_MAINTENANCE', tableName: 'maintenance', recordId: r.insertId });
    await notifySafe(async () => {
      await notifyRoles({
        roles: ['Administrator', 'Staff'],
        title: 'มีรายการแจ้งซ่อมใหม่',
        message: `มีรายการแจ้งซ่อม #${r.insertId} (${problem_type}) รอตรวจสอบ`,
      });
      await lineService.notifyMaintenanceTicket(r.insertId);
    });

    res.status(201).json({ success: true, message: 'แจ้งซ่อมสำเร็จ', maintenance_id: r.insertId });
  } catch (e) {
    console.error('MAINT_CREATE_ERROR:', e.message);
    res.status(500).json({ success: false, message: 'ไม่สามารถแจ้งซ่อมได้' });
  }
});

router.put('/:id/status', requirePermission(PERMISSIONS.MAINTENANCE_UPDATE), async (req, res) => {
  try {
    const { status, remark = '', technician_id = null, repair_cost = null, solution = '' } = req.body;
    const allowed = ['Reported', 'Received', 'Diagnosing', 'Repairing', 'Completed', 'Cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'สถานะไม่ถูกต้อง' });
    }

    const [rows] = await pool.execute('SELECT * FROM maintenance WHERE maintenance_id = ?', [req.params.id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'ไม่พบรายการแจ้งซ่อม' });
    }

    const old = rows[0];
    const techId = technician_id !== null && technician_id !== '' ? Number(technician_id) : old.technician_id;
    const cost = repair_cost !== null && repair_cost !== '' ? Number(repair_cost) : old.repair_cost;
    const sol = solution || (status === 'Completed' ? remark : old.solution);

    let startedAt = old.started_at;
    let completedAt = old.completed_at;

    if (['Diagnosing', 'Repairing'].includes(status) && !startedAt) {
      startedAt = new Date();
    }
    if (['Completed', 'Cancelled'].includes(status)) {
      completedAt = new Date();
    }

    await pool.execute(
      `UPDATE maintenance
       SET status = ?, technician_id = ?, repair_cost = ?, solution = ?, started_at = COALESCE(?, started_at), completed_at = COALESCE(?, completed_at)
       WHERE maintenance_id = ?`,
      [status, techId, cost, sol, startedAt, completedAt, req.params.id]
    );

    await pool.execute(
      `INSERT INTO maintenance_logs(maintenance_id, status, remark, updated_by) VALUES(?, ?, ?, ?)`,
      [req.params.id, status, remark || (sol ? `วิธีแก้ไข: ${sol}` : null), req.user.id]
    );

    if (status === 'Completed' || status === 'Cancelled') {
      await pool.execute(
        `UPDATE equipment SET status = CASE WHEN status = 'Maintenance' THEN 'Available' ELSE status END WHERE equipment_id = ?`,
        [old.equipment_id]
      );
    } else {
      await pool.execute(
        `UPDATE equipment SET status = 'Maintenance' WHERE equipment_id = ? AND status <> 'Borrowed'`,
        [old.equipment_id]
      );
    }

    await auditSafe({ userId: req.user.id, action: 'UPDATE_MAINTENANCE_STATUS', tableName: 'maintenance', recordId: req.params.id });
    await notifySafe(() =>
      createNotification({
        userId: old.reporter_id,
        title: 'สถานะแจ้งซ่อมมีการอัปเดต',
        message: `รายการแจ้งซ่อม #${req.params.id} เปลี่ยนเป็น ${status}${remark ? ` — ${remark}` : ''}`,
      })
    );

    res.json({ success: true, message: 'อัปเดตสถานะงานซ่อมสำเร็จ' });
  } catch (e) {
    console.error('MAINT_STATUS_ERROR:', e.message);
    res.status(500).json({ success: false, message: 'ไม่สามารถอัปเดตงานซ่อมได้' });
  }
});

router.get('/:id/logs', requirePermission(PERMISSIONS.MAINTENANCE_READ), async (req, res) => {
  try {
    if (req.user.role === 'Borrower') {
      const [owner] = await pool.execute('SELECT reporter_id FROM maintenance WHERE maintenance_id = ?', [req.params.id]);
      if (!owner.length) return res.status(404).json({ success: false, message: 'ไม่พบรายการแจ้งซ่อม' });
      if (owner[0].reporter_id !== req.user.id) return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์ดูประวัติงานซ่อมรายการนี้' });
    }

    const [rows] = await pool.execute(
      `SELECT ml.*, u.name AS updated_by_name
       FROM maintenance_logs ml
       LEFT JOIN users u ON u.user_id = ml.updated_by
       WHERE ml.maintenance_id = ?
       ORDER BY ml.log_id ASC`,
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (e) {
    res.status(500).json({ success: false, message: 'ไม่สามารถโหลดประวัติงานซ่อมได้' });
  }
});

module.exports = router;
