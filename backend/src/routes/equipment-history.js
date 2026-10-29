const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const router = require('express').Router();
router.use(authenticateToken);

router.get('/:id/history', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success:false, message:'รหัสอุปกรณ์ไม่ถูกต้อง' });
    const [loans] = await pool.execute(`SELECT l.loan_id,l.request_date,l.borrow_date,l.due_date,l.return_date,l.status,l.purpose,u.name AS borrower_name FROM loans l JOIN users u ON u.user_id=l.borrower_id WHERE l.equipment_id=? ORDER BY l.loan_id DESC`, [id]);
    const [repairs] = await pool.execute(`SELECT m.maintenance_id,m.problem_type,m.priority,m.status,m.reported_at,m.started_at,m.completed_at,m.repair_cost,m.solution,u.name AS reporter_name FROM maintenance m JOIN users u ON u.user_id=m.reporter_id WHERE m.equipment_id=? ORDER BY m.maintenance_id DESC`, [id]);
    res.json({ success:true, data:{ loans, repairs } });
  } catch (error) {
    console.error('GET_EQUIPMENT_HISTORY_ERROR:', error.message);
    res.status(500).json({ success:false, message:'ไม่สามารถโหลดประวัติอุปกรณ์ได้' });
  }
});

module.exports = router;
