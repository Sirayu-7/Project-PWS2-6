const express = require('express');
const pool = require('../db');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../config/permissions');
const { writeAudit } = require('../services/audit');

const router = express.Router();
router.use(authenticateToken);

const auditSafe = async (data) => {
  try {
    await writeAudit(data);
  } catch (e) {
    console.error('AUDIT_CAT_ERROR:', e.message);
  }
};

// GET /api/categories - List all categories with equipment count
router.get('/', requirePermission(PERMISSIONS.CATEGORY_READ), async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT c.*, COUNT(e.equipment_id) AS equipment_count
      FROM categories c
      LEFT JOIN equipment e ON e.category_id = c.category_id
      GROUP BY c.category_id
      ORDER BY c.category_name ASC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('CATEGORIES_LIST_ERROR:', error.message);
    res.status(500).json({ success: false, message: 'ไม่สามารถโหลดหมวดหมู่อุปกรณ์ได้' });
  }
});

// POST /api/categories - Create category
router.post('/', requirePermission(PERMISSIONS.CATEGORY_MANAGE), async (req, res) => {
  try {
    const { category_name, description, status = 'Active' } = req.body;
    if (!category_name || !category_name.trim()) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุชื่อหมวดหมู่' });
    }

    const [result] = await pool.execute(
      `INSERT INTO categories (category_name, description, status) VALUES (?, ?, ?)`,
      [category_name.trim(), description ? description.trim() : null, status]
    );

    await auditSafe({
      userId: req.user.id,
      action: 'CREATE_CATEGORY',
      tableName: 'categories',
      recordId: result.insertId,
    });

    res.status(201).json({ success: true, message: 'เพิ่มหมวดหมู่สำเร็จ', category_id: result.insertId });
  } catch (error) {
    console.error('CATEGORY_CREATE_ERROR:', error.message);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'ชื่อหมวดหมู่นี้มีอยู่ในระบบแล้ว' });
    }
    res.status(500).json({ success: false, message: 'ไม่สามารถเพิ่มหมวดหมู่ได้' });
  }
});

// PUT /api/categories/:id - Update category
router.put('/:id', requirePermission(PERMISSIONS.CATEGORY_MANAGE), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { category_name, description, status } = req.body;

    if (!id || !category_name || !category_name.trim()) {
      return res.status(400).json({ success: false, message: 'ข้อมูลหมวดหมู่ไม่ครบถ้วน' });
    }

    const [result] = await pool.execute(
      `UPDATE categories SET category_name = ?, description = ?, status = ? WHERE category_id = ?`,
      [category_name.trim(), description ? description.trim() : null, status || 'Active', id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'ไม่พบหมวดหมู่นี้' });
    }

    await auditSafe({
      userId: req.user.id,
      action: 'UPDATE_CATEGORY',
      tableName: 'categories',
      recordId: id,
    });

    res.json({ success: true, message: 'แก้ไขหมวดหมู่สำเร็จ' });
  } catch (error) {
    console.error('CATEGORY_UPDATE_ERROR:', error.message);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'ชื่อหมวดหมู่นี้มีอยู่ในระบบแล้ว' });
    }
    res.status(500).json({ success: false, message: 'ไม่สามารถแก้ไขหมวดหมู่ได้' });
  }
});

// DELETE /api/categories/:id - Delete category
router.delete('/:id', requirePermission(PERMISSIONS.CATEGORY_MANAGE), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'รหัสหมวดหมู่ไม่ถูกต้อง' });

    // Check if any equipment uses this category
    const [count] = await pool.execute('SELECT COUNT(*) as cnt FROM equipment WHERE category_id = ?', [id]);
    if (count[0].cnt > 0) {
      return res.status(409).json({
        success: false,
        message: `ไม่สามารถลบหมวดหมู่นี้ได้เนื่องจากมีอุปกรณ์ ${count[0].cnt} รายการใช้งานอยู่ ให้เปลี่ยนสถานะเป็น Inactive แทน`,
      });
    }

    const [result] = await pool.execute('DELETE FROM categories WHERE category_id = ?', [id]);
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'ไม่พบหมวดหมู่นี้' });
    }

    await auditSafe({
      userId: req.user.id,
      action: 'DELETE_CATEGORY',
      tableName: 'categories',
      recordId: id,
    });

    res.json({ success: true, message: 'ลบหมวดหมู่สำเร็จ' });
  } catch (error) {
    console.error('CATEGORY_DELETE_ERROR:', error.message);
    res.status(500).json({ success: false, message: 'ไม่สามารถลบหมวดหมู่ได้' });
  }
});

module.exports = router;
