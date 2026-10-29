const express = require('express');
const pool = require('../db');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();
router.use(authenticateToken);

router.get('/summary', requirePermission(PERMISSIONS.REPORT_READ), async (req, res) => {
  try {
    const [[equipment]] = await pool.query(`
      SELECT
        COUNT(*) AS totalEquipment,
        SUM(status = 'Available') AS available,
        SUM(status = 'Borrowed') AS borrowed,
        SUM(status = 'Maintenance') AS maintenance,
        SUM(status = 'Damaged') AS damaged,
        SUM(status = 'Lost') AS lost,
        SUM(status = 'Retired') AS retired
      FROM equipment
    `);

    const [[loans]] = await pool.query(`
      SELECT
        COUNT(*) AS totalLoans,
        SUM(status = 'Pending') AS pending,
        SUM(status = 'Approved') AS approved,
        SUM(status = 'Borrowed') AS borrowed,
        SUM(status = 'Returned') AS returned,
        SUM(status = 'Overdue') AS overdue,
        SUM(status = 'Rejected') AS rejected
      FROM loans
    `);

    const [[maintenance]] = await pool.query(`
      SELECT
        COUNT(*) AS totalMaintenance,
        SUM(status NOT IN ('Completed', 'Cancelled')) AS active,
        SUM(status = 'Completed') AS completed,
        SUM(status = 'Cancelled') AS cancelled,
        COALESCE(SUM(repair_cost), 0) AS repairCost
      FROM maintenance
    `);

    res.json({
      success: true,
      data: {
        equipment,
        loans,
        maintenance,
      },
    });
  } catch (e) {
    console.error('REPORT_SUMMARY_ERROR:', e.message);
    res.status(500).json({ success: false, message: 'ไม่สามารถโหลดสรุปรายงานได้' });
  }
});

router.get('/loans', requirePermission(PERMISSIONS.REPORT_READ), async (req, res) => {
  try {
    const { from = '', to = '', status = '' } = req.query;
    const p = [];
    let w = 'WHERE 1=1';

    if (from) {
      w += ' AND DATE(l.request_date) >= ?';
      p.push(from);
    }
    if (to) {
      w += ' AND DATE(l.request_date) <= ?';
      p.push(to);
    }
    if (status) {
      w += ' AND l.status = ?';
      p.push(status);
    }

    const [rows] = await pool.execute(`
      SELECT l.loan_id, l.request_date, l.borrow_date, l.due_date, l.return_date, l.status, l.purpose,
             e.asset_code, e.equipment_name, u.name AS borrower_name, approver.name AS approver_name
      FROM loans l
      JOIN equipment e ON e.equipment_id = l.equipment_id
      JOIN users u ON u.user_id = l.borrower_id
      LEFT JOIN users approver ON approver.user_id = l.approved_by
      ${w}
      ORDER BY l.loan_id DESC
    `, p);

    res.json({ success: true, data: rows });
  } catch (e) {
    console.error('REPORT_LOAN_ERROR:', e.message);
    res.status(500).json({ success: false, message: 'ไม่สามารถโหลดรายงานการยืม-คืนได้' });
  }
});

router.get('/maintenance', requirePermission(PERMISSIONS.REPORT_READ), async (req, res) => {
  try {
    const { from = '', to = '', status = '', priority = '' } = req.query;
    const p = [];
    let w = 'WHERE 1=1';

    if (from) {
      w += ' AND DATE(m.reported_at) >= ?';
      p.push(from);
    }
    if (to) {
      w += ' AND DATE(m.reported_at) <= ?';
      p.push(to);
    }
    if (status) {
      w += ' AND m.status = ?';
      p.push(status);
    }
    if (priority) {
      w += ' AND m.priority = ?';
      p.push(priority);
    }

    const [rows] = await pool.execute(`
      SELECT m.maintenance_id, m.reported_at AS created_at, m.problem_type, m.problem_description,
             m.priority, m.status, m.repair_cost, m.solution, m.started_at, m.completed_at,
             e.asset_code, e.equipment_name, u.name AS reporter_name, t.name AS technician_name
      FROM maintenance m
      JOIN equipment e ON e.equipment_id = m.equipment_id
      JOIN users u ON u.user_id = m.reporter_id
      LEFT JOIN users t ON t.user_id = m.technician_id
      ${w}
      ORDER BY m.maintenance_id DESC
    `, p);

    res.json({ success: true, data: rows });
  } catch (e) {
    console.error('REPORT_MAINT_ERROR:', e.message);
    res.status(500).json({ success: false, message: 'ไม่สามารถโหลดรายงานงานซ่อมได้' });
  }
});

router.get('/equipment', requirePermission(PERMISSIONS.REPORT_READ), async (req, res) => {
  try {
    const { category_id = '', status = '' } = req.query;
    const p = [];
    let w = 'WHERE 1=1';

    if (category_id) {
      w += ' AND e.category_id = ?';
      p.push(category_id);
    }
    if (status) {
      w += ' AND e.status = ?';
      p.push(status);
    }

    const [rows] = await pool.execute(`
      SELECT e.equipment_id, e.asset_code, e.equipment_name, e.brand, e.model, e.serial_number,
             e.purchase_date, e.status, e.description, c.category_name,
             (SELECT COUNT(*) FROM loans WHERE equipment_id = e.equipment_id) AS total_loans,
             (SELECT COUNT(*) FROM maintenance WHERE equipment_id = e.equipment_id) AS total_repairs
      FROM equipment e
      LEFT JOIN categories c ON c.category_id = e.category_id
      ${w}
      ORDER BY e.equipment_id DESC
    `, p);

    res.json({ success: true, data: rows });
  } catch (e) {
    console.error('REPORT_EQUIPMENT_ERROR:', e.message);
    res.status(500).json({ success: false, message: 'ไม่สามารถโหลดรายงานอุปกรณ์ได้' });
  }
});

module.exports = router;
