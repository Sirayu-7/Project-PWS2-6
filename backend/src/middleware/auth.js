const jwt = require('jsonwebtoken');
const { hasPermission } = require('../config/permissions');

function authenticateToken(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) return res.status(401).json({ success: false, message: 'กรุณาเข้าสู่ระบบ' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-change-me');
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Session ไม่ถูกต้องหรือหมดอายุ' });
  }
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' });
    }
    next();
  };
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user || !hasPermission(req.user.role, permission)) {
      return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์ดำเนินการนี้', permission });
    }
    next();
  };
}

module.exports = { authenticateToken, requireRoles, requirePermission };
