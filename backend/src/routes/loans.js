const express = require('express');
const pool = require('../db');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../config/permissions');
const { writeAudit } = require('../services/audit');
const { createNotification, notifyRoles } = require('../services/notification');

const router = express.Router();
router.use(authenticateToken);

const auditSafe = async (data) => {
  try {
    await writeAudit(data);
  } catch (e) {
    console.error('AUDIT_LOAN_ERROR:', e.message);
  }
};

const notifySafe = async (fn) => {
  try {
    await fn();
  } catch (e) {
    console.error('NOTIFICATION_LOAN_ERROR:', e.message);
  }
};

router.get('/', requirePermission(PERMISSIONS.LOAN_READ), async (req, res) => {
  try {
    // Automatically update overdue loans
    await pool.execute("UPDATE loans SET status = 'Overdue' WHERE status = 'Borrowed' AND due_date < CURDATE()");

    const { status = '', search = '' } = req.query;
    const p = [];
    let w = 'WHERE 1=1';

    if (!['Administrator', 'Staff'].includes(req.user.role)) {
      w += ' AND l.borrower_id = ?';
      p.push(req.user.id);
    }
    if (status) {
      w += ' AND l.status = ?';
      p.push(status);
    }
    if (search) {
      w += ' AND (e.asset_code LIKE ? OR e.equipment_name LIKE ? OR u.name LIKE ? OR u.username LIKE ?)';
      const q = `%${search}%`;
      p.push(q, q, q, q);
    }

    const [rows] = await pool.execute(`
      SELECT l.*, e.asset_code, e.equipment_name,
             u.name AS borrower_name, u.username AS borrower_username,
             approver.name AS approver_name
      FROM loans l
      JOIN equipment e ON e.equipment_id = l.equipment_id
      JOIN users u ON u.user_id = l.borrower_id
      LEFT JOIN users approver ON approver.user_id = l.approved_by
      ${w}
      ORDER BY l.loan_id DESC
    `, p);

    res.json({ success: true, data: rows });
  } catch (e) {
    console.error('LOAN_LIST_ERROR:', e.message);
    res.status(500).json({ success: false, message: 'ไม่สามารถโหลดรายการยืม-คืนได้' });
  }
});

router.get('/available-equipment', requirePermission(PERMISSIONS.LOAN_READ), async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT e.equipment_id, e.asset_code, e.equipment_name, e.brand, e.model, c.category_name
      FROM equipment e
      LEFT JOIN categories c ON c.category_id = e.category_id
      WHERE e.status = 'Available'
      ORDER BY e.equipment_name, e.asset_code
    `);
    res.json({ success: true, data: rows });
  } catch (e) {
    res.status(500).json({ success: false, message: 'ไม่สามารถโหลดอุปกรณ์ที่พร้อมยืมได้' });
  }
});

router.post('/', requirePermission(PERMISSIONS.LOAN_CREATE), async (req, res) => {
  const c = await pool.getConnection();
  try {
    const { equipment_id, due_date, purpose, remark } = req.body;
    if (!equipment_id || !due_date) {
      return res.status(400).json({ success: false, message: 'กรุณาเลือกอุปกรณ์และกำหนดวันครบกำหนดคืน' });
    }

    await c.beginTransaction();
    const [eq] = await c.execute('SELECT equipment_id, status FROM equipment WHERE equipment_id = ? FOR UPDATE', [equipment_id]);
    if (!eq.length) {
      await c.rollback();
      return res.status(404).json({ success: false, message: 'ไม่พบอุปกรณ์' });
    }
    if (eq[0].status !== 'Available') {
      await c.rollback();
      return res.status(409).json({ success: false, message: 'อุปกรณ์นี้ไม่พร้อมให้ยืม' });
    }

    const [r] = await c.execute(
      `INSERT INTO loans(equipment_id, borrower_id, request_date, due_date, purpose, status, remark)
       VALUES(?, ?, NOW(), ?, ?, 'Pending', ?)`,
      [equipment_id, req.user.id, due_date, purpose || null, remark || null]
    );

    await c.commit();
    await auditSafe({ userId: req.user.id, action: 'CREATE_LOAN', tableName: 'loans', recordId: r.insertId });
    await notifySafe(() =>
      notifyRoles({
        roles: ['Administrator', 'Staff'],
        title: 'มีคำขอยืมอุปกรณ์ใหม่',
        message: `มีคำขอยืมรายการ #${r.insertId} รอการอนุมัติ`,
      })
    );

    res.status(201).json({ success: true, message: 'ส่งคำขอยืมสำเร็จ', loan_id: r.insertId });
  } catch (e) {
    await c.rollback();
    console.error('LOAN_CREATE_ERROR:', e.message);
    res.status(500).json({ success: false, message: 'ไม่สามารถสร้างคำขอยืมได้' });
  } finally {
    c.release();
  }
});

router.put('/:id/approve', requirePermission(PERMISSIONS.LOAN_APPROVE), async (req, res) => {
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    const [rows] = await c.execute(
      `SELECT l.loan_id, l.equipment_id, l.borrower_id, l.status, e.status AS equipment_status
       FROM loans l
       JOIN equipment e ON e.equipment_id = l.equipment_id
       WHERE l.loan_id = ? FOR UPDATE`,
      [req.params.id]
    );

    if (!rows.length) {
      await c.rollback();
      return res.status(404).json({ success: false, message: 'ไม่พบคำขอยืม' });
    }

    const l = rows[0];
    if (l.status !== 'Pending') {
      await c.rollback();
      return res.status(409).json({ success: false, message: 'คำขอนี้ไม่อยู่ในสถานะรออนุมัติ' });
    }
    if (l.equipment_status !== 'Available') {
      await c.rollback();
      return res.status(409).json({ success: false, message: 'อุปกรณ์ไม่พร้อมให้ยืมแล้ว' });
    }

    await c.execute(
      `UPDATE loans SET status = 'Borrowed', borrow_date = NOW(), approved_by = ?, approved_at = NOW() WHERE loan_id = ?`,
      [req.user.id, req.params.id]
    );
    await c.execute(`UPDATE equipment SET status = 'Borrowed' WHERE equipment_id = ?`, [l.equipment_id]);
    await c.commit();

    await auditSafe({ userId: req.user.id, action: 'APPROVE_LOAN', tableName: 'loans', recordId: req.params.id });
    await notifySafe(() =>
      createNotification({
        userId: l.borrower_id,
        title: 'คำขอยืมได้รับการอนุมัติ',
        message: `คำขอยืมรายการ #${req.params.id} ได้รับการอนุมัติและอยู่ในสถานะกำลังยืม`,
      })
    );

    res.json({ success: true, message: 'อนุมัติการยืมสำเร็จ' });
  } catch (e) {
    await c.rollback();
    console.error('LOAN_APPROVE_ERROR:', e.message);
    res.status(500).json({ success: false, message: 'ไม่สามารถอนุมัติคำขอยืมได้' });
  } finally {
    c.release();
  }
});

router.put('/:id/reject', requirePermission(PERMISSIONS.LOAN_REJECT), async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT borrower_id FROM loans WHERE loan_id = ? AND status = \'Pending\'', [req.params.id]);
    if (!rows.length) {
      return res.status(409).json({ success: false, message: 'ไม่พบคำขอ หรือคำขอนี้ไม่อยู่ในสถานะรออนุมัติ' });
    }

    const [r] = await pool.execute(
      `UPDATE loans SET status = 'Rejected', approved_by = ?, approved_at = NOW(), remark = ? WHERE loan_id = ? AND status = 'Pending'`,
      [req.user.id, req.body?.remark || null, req.params.id]
    );

    if (!r.affectedRows) {
      return res.status(409).json({ success: false, message: 'ไม่พบคำขอ หรือคำขอนี้ไม่อยู่ในสถานะรออนุมัติ' });
    }

    await auditSafe({ userId: req.user.id, action: 'REJECT_LOAN', tableName: 'loans', recordId: req.params.id });
    await notifySafe(() =>
      createNotification({
        userId: rows[0].borrower_id,
        title: 'คำขอยืมถูกปฏิเสธ',
        message: `คำขอยืมรายการ #${req.params.id} ถูกปฏิเสธ${req.body?.remark ? ` — ${req.body.remark}` : ''}`,
      })
    );

    res.json({ success: true, message: 'ปฏิเสธคำขอยืมแล้ว' });
  } catch (e) {
    res.status(500).json({ success: false, message: 'ไม่สามารถปฏิเสธคำขอยืมได้' });
  }
});

router.put('/:id/return', requirePermission(PERMISSIONS.LOAN_RETURN), async (req, res) => {
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    const [rows] = await c.execute('SELECT loan_id, equipment_id, borrower_id, status FROM loans WHERE loan_id = ? FOR UPDATE', [req.params.id]);
    if (!rows.length) {
      await c.rollback();
      return res.status(404).json({ success: false, message: 'ไม่พบรายการยืม' });
    }

    if (!['Administrator', 'Staff'].includes(req.user.role) && rows[0].borrower_id !== req.user.id) {
      await c.rollback();
      return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์คืนอุปกรณ์รายการนี้' });
    }

    if (!['Borrowed', 'Overdue'].includes(rows[0].status)) {
      await c.rollback();
      return res.status(409).json({ success: false, message: 'รายการนี้ไม่สามารถคืนได้ในสถานะปัจจุบัน' });
    }

    const condition = req.body?.condition_status || 'Normal';
    if (!['Normal', 'Minor Damage', 'Major Damage', 'Lost'].includes(condition)) {
      await c.rollback();
      return res.status(400).json({ success: false, message: 'สถานะสภาพอุปกรณ์ไม่ถูกต้อง' });
    }

    await c.execute(`UPDATE loans SET status = 'Returned', return_date = NOW(), remark = ? WHERE loan_id = ?`, [req.body?.remark || null, req.params.id]);
    await c.execute(
      `INSERT INTO returns(loan_id, condition_status, return_date, inspected_by, remark) VALUES(?, ?, NOW(), ?, ?)`,
      [req.params.id, condition, req.user.id, req.body?.remark || null]
    );

    let equipmentStatus = 'Available';
    if (condition === 'Lost') {
      equipmentStatus = 'Lost';
    } else if (condition === 'Major Damage') {
      equipmentStatus = 'Damaged';
    } else if (condition === 'Minor Damage') {
      equipmentStatus = req.body?.create_maintenance ? 'Maintenance' : 'Available';
    }

    // Auto-create maintenance if requested or damaged
    let maintenanceCreated = false;
    if ((condition === 'Minor Damage' || condition === 'Major Damage') && req.body?.create_maintenance) {
      equipmentStatus = 'Maintenance';
      const [m] = await c.execute(
        `INSERT INTO maintenance (equipment_id, reporter_id, problem_type, problem_description, priority, status)
         VALUES (?, ?, ?, ?, ?, 'Reported')`,
        [
          rows[0].equipment_id,
          req.user.id,
          req.body.problem_type || 'ชำรุดจากการยืม-คืน',
          req.body.problem_description || `ตรวจพบสภาพ ${condition}: ${req.body.remark || 'ส่งซ่อมทันทีหลังรับคืน'}`,
          condition === 'Major Damage' ? 'High' : 'Normal',
        ]
      );
      maintenanceCreated = true;
    }

    await c.execute('UPDATE equipment SET status = ? WHERE equipment_id = ?', [equipmentStatus, rows[0].equipment_id]);
    await c.commit();

    await auditSafe({ userId: req.user.id, action: 'RETURN_LOAN', tableName: 'loans', recordId: req.params.id });
    await notifySafe(() =>
      notifyRoles({
        roles: ['Administrator', 'Staff'],
        title: 'มีการคืนอุปกรณ์',
        message: `มีการคืนอุปกรณ์จากรายการยืม #${req.params.id} สภาพ: ${condition}${maintenanceCreated ? ' (สร้างใบแจ้งซ่อมแล้ว)' : ''}`,
      })
    );

    res.json({
      success: true,
      message: 'บันทึกการคืนอุปกรณ์สำเร็จ' + (maintenanceCreated ? ' และสร้างใบแจ้งซ่อมแล้ว' : ''),
      maintenance_created: maintenanceCreated,
    });
  } catch (e) {
    await c.rollback();
    console.error('LOAN_RETURN_ERROR:', e.message);
    res.status(500).json({ success: false, message: 'ไม่สามารถบันทึกการคืนได้' });
  } finally {
    c.release();
  }
});

module.exports = router;
