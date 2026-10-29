const express = require('express');
const pool = require('../db');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

router.get('/summary', authenticateToken, requirePermission(PERMISSIONS.DASHBOARD_READ), async (req, res) => {
  try {
    const isBorrower = req.user.role === 'Borrower';
    const userId = req.user.id;

    const equipmentWhere = '';
    const loanWhere = isBorrower ? 'WHERE l.borrower_id = ?' : '';
    const maintenanceWhere = isBorrower ? 'WHERE m.reporter_id = ?' : '';
    const baseParams = isBorrower ? [userId] : [];

    const [[equipment]] = await pool.query(`
      SELECT
        COUNT(*) AS totalEquipment,
        COALESCE(SUM(status = 'Available'), 0) AS available,
        COALESCE(SUM(status = 'Borrowed'), 0) AS borrowed,
        COALESCE(SUM(status = 'Maintenance'), 0) AS maintenance,
        COALESCE(SUM(status = 'Damaged'), 0) AS damaged,
        COALESCE(SUM(status = 'Lost'), 0) AS lost,
        COALESCE(SUM(status = 'Retired'), 0) AS retired
      FROM equipment ${equipmentWhere}
    `);

    const [[loans]] = await pool.query(`
      SELECT
        COUNT(*) AS totalLoans,
        COALESCE(SUM(status = 'Pending'), 0) AS pendingLoans,
        COALESCE(SUM(status = 'Approved'), 0) AS approvedLoans,
        COALESCE(SUM(status = 'Borrowed'), 0) AS activeLoans,
        COALESCE(SUM(status = 'Overdue'), 0) AS overdueLoans,
        COALESCE(SUM(status = 'Returned'), 0) AS returnedLoans,
        COALESCE(SUM(status = 'Rejected'), 0) AS rejectedLoans
      FROM loans l ${loanWhere}
    `, baseParams);

    const [[repairs]] = await pool.query(`
      SELECT
        COUNT(*) AS totalMaintenance,
        COALESCE(SUM(status IN ('Reported','Received','Diagnosing','Repairing')), 0) AS activeMaintenance,
        COALESCE(SUM(status = 'Reported'), 0) AS reportedMaintenance,
        COALESCE(SUM(status = 'Received'), 0) AS receivedMaintenance,
        COALESCE(SUM(status = 'Diagnosing'), 0) AS diagnosingMaintenance,
        COALESCE(SUM(status = 'Repairing'), 0) AS repairingMaintenance,
        COALESCE(SUM(status = 'Completed'), 0) AS completedMaintenance,
        COALESCE(SUM(status = 'Cancelled'), 0) AS cancelledMaintenance
      FROM maintenance m ${maintenanceWhere}
    `, baseParams);

    const [recentLoans] = await pool.query(`
      SELECT l.loan_id, l.request_date, l.borrow_date, l.due_date, l.return_date, l.status,
             e.asset_code, e.equipment_name, u.name AS borrower_name
      FROM loans l
      JOIN equipment e ON e.equipment_id = l.equipment_id
      JOIN users u ON u.user_id = l.borrower_id
      ${loanWhere}
      ORDER BY l.loan_id DESC
      LIMIT 5
    `, baseParams);

    const [recentMaintenance] = await pool.query(`
      SELECT m.maintenance_id, m.reported_at, m.problem_type, m.priority, m.status,
             e.asset_code, e.equipment_name, u.name AS reporter_name
      FROM maintenance m
      JOIN equipment e ON e.equipment_id = m.equipment_id
      JOIN users u ON u.user_id = m.reporter_id
      ${maintenanceWhere}
      ORDER BY m.maintenance_id DESC
      LIMIT 5
    `, baseParams);

    res.json({
      success: true,
      data: {
        ...equipment,
        ...loans,
        ...repairs,
        recentLoans,
        recentMaintenance,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('DASHBOARD_SUMMARY_ERROR:', error);
    res.status(500).json({ success: false, message: 'ไม่สามารถโหลดข้อมูล Dashboard ได้' });
  }
});

module.exports = router;
