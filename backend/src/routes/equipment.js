const express = require('express');
const pool = require('../db');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();
router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const { search = '', status = '', category_id = '' } = req.query;
    const params = [];
    let where = 'WHERE 1=1';
    if (search) {
      where += ' AND (e.asset_code LIKE ? OR e.equipment_name LIKE ? OR e.brand LIKE ? OR e.model LIKE ? OR e.serial_number LIKE ?)';
      const q = `%${search}%`; params.push(q, q, q, q, q);
    }
    if (status) { where += ' AND e.status = ?'; params.push(status); }
    if (category_id) { where += ' AND e.category_id = ?'; params.push(category_id); }
    const [rows] = await pool.execute(`
      SELECT e.*, c.category_name
      FROM equipment e LEFT JOIN categories c ON c.category_id=e.category_id
      ${where} ORDER BY e.equipment_id DESC`, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('EQUIPMENT_LIST_ERROR:', error.message);
    res.status(500).json({ success: false, message: 'ไม่สามารถโหลดรายการอุปกรณ์ได้' });
  }
});

router.get('/categories', async (req, res) => {
  try {
    const [rows] = await pool.execute(`SELECT category_id, category_name FROM categories WHERE status='Active' ORDER BY category_name`);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'ไม่สามารถโหลดหมวดหมู่ได้' });
  }
});

router.get('/:id/history', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'รหัสอุปกรณ์ไม่ถูกต้อง' });
    const [loans] = await pool.execute(`
      SELECT l.loan_id, l.request_date, l.borrow_date, l.due_date, l.return_date, l.status, l.purpose,
             u.name AS borrower_name, approver.name AS approver_name
      FROM loans l
      JOIN users u ON u.user_id = l.borrower_id
      LEFT JOIN users approver ON approver.user_id = l.approved_by
      WHERE l.equipment_id = ?
      ORDER BY l.loan_id DESC
    `, [id]);

    const [repairs] = await pool.execute(`
      SELECT m.maintenance_id, m.problem_type, m.problem_description, m.priority, m.status,
             m.reported_at, m.started_at, m.completed_at, m.repair_cost, m.solution,
             u.name AS reporter_name, t.name AS technician_name
      FROM maintenance m
      JOIN users u ON u.user_id = m.reporter_id
      LEFT JOIN users t ON t.user_id = m.technician_id
      WHERE m.equipment_id = ?
      ORDER BY m.maintenance_id DESC
    `, [id]);

    res.json({ success: true, data: { loans, repairs } });
  } catch (error) {
    console.error('EQUIPMENT_HISTORY_ERROR:', error.message);
    res.status(500).json({ success: false, message: 'ไม่สามารถโหลดประวัติอุปกรณ์ได้' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute(`SELECT e.*, c.category_name FROM equipment e LEFT JOIN categories c ON c.category_id=e.category_id WHERE e.equipment_id=?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'ไม่พบอุปกรณ์' });
    res.json({ success: true, data: rows[0] });
  } catch (error) { res.status(500).json({ success: false, message: 'ไม่สามารถโหลดข้อมูลอุปกรณ์ได้' }); }
});

router.post('/', requirePermission(PERMISSIONS.EQUIPMENT_CREATE), async (req, res) => {
  try {
    const { category_id, asset_code, equipment_name, brand, model, serial_number, purchase_date, status='Available', description } = req.body;
    if (!category_id || !asset_code || !equipment_name) return res.status(400).json({ success:false, message:'กรุณากรอกหมวดหมู่ รหัสทรัพย์สิน และชื่ออุปกรณ์' });
    const [result] = await pool.execute(`INSERT INTO equipment (category_id,asset_code,equipment_name,brand,model,serial_number,purchase_date,status,description) VALUES (?,?,?,?,?,?,?,?,?)`, [category_id,asset_code,equipment_name,brand||null,model||null,serial_number||null,purchase_date||null,status,description||null]);
    res.status(201).json({ success:true, message:'เพิ่มอุปกรณ์สำเร็จ', equipment_id:result.insertId });
  } catch (error) {
    console.error('EQUIPMENT_CREATE_ERROR:', error.message);
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success:false, message:'รหัสทรัพย์สินนี้มีอยู่แล้ว' });
    res.status(500).json({ success:false, message:'ไม่สามารถเพิ่มอุปกรณ์ได้' });
  }
});

router.put('/:id', requirePermission(PERMISSIONS.EQUIPMENT_UPDATE), async (req, res) => {
  try {
    const { category_id, asset_code, equipment_name, brand, model, serial_number, purchase_date, status, description } = req.body;
    if (!category_id || !asset_code || !equipment_name || !status) return res.status(400).json({ success:false, message:'ข้อมูลอุปกรณ์ไม่ครบถ้วน' });
    const [result] = await pool.execute(`UPDATE equipment SET category_id=?,asset_code=?,equipment_name=?,brand=?,model=?,serial_number=?,purchase_date=?,status=?,description=? WHERE equipment_id=?`, [category_id,asset_code,equipment_name,brand||null,model||null,serial_number||null,purchase_date||null,status,description||null,req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ success:false, message:'ไม่พบอุปกรณ์' });
    res.json({ success:true, message:'แก้ไขอุปกรณ์สำเร็จ' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success:false, message:'รหัสทรัพย์สินนี้มีอยู่แล้ว' });
    console.error('EQUIPMENT_UPDATE_ERROR:', error.message);
    res.status(500).json({ success:false, message:'ไม่สามารถแก้ไขอุปกรณ์ได้' });
  }
});

router.delete('/:id', requirePermission(PERMISSIONS.EQUIPMENT_DELETE), async (req, res) => {
  try {
    const [result] = await pool.execute(`DELETE FROM equipment WHERE equipment_id=?`, [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ success:false, message:'ไม่พบอุปกรณ์' });
    res.json({ success:true, message:'ลบอุปกรณ์สำเร็จ' });
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.code === 'ER_ROW_IS_REFERENCED') return res.status(409).json({ success:false, message:'ไม่สามารถลบอุปกรณ์ที่มีประวัติการยืมหรือซ่อมได้' });
    console.error('EQUIPMENT_DELETE_ERROR:', error.message);
    res.status(500).json({ success:false, message:'ไม่สามารถลบอุปกรณ์ได้' });
  }
});

module.exports = router;

