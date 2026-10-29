const PERMISSIONS = Object.freeze({
  DASHBOARD_READ: 'dashboard.read',
  EQUIPMENT_READ: 'equipment.read',
  EQUIPMENT_CREATE: 'equipment.create',
  EQUIPMENT_UPDATE: 'equipment.update',
  EQUIPMENT_DELETE: 'equipment.delete',
  CATEGORY_READ: 'category.read',
  CATEGORY_MANAGE: 'category.manage',
  LOAN_READ: 'loan.read',
  LOAN_CREATE: 'loan.create',
  LOAN_APPROVE: 'loan.approve',
  LOAN_REJECT: 'loan.reject',
  LOAN_RETURN: 'loan.return',
  MAINTENANCE_READ: 'maintenance.read',
  MAINTENANCE_CREATE: 'maintenance.create',
  MAINTENANCE_UPDATE: 'maintenance.update',
  REPORT_READ: 'report.read',
  USER_READ: 'user.read',
  USER_CREATE: 'user.create',
  USER_UPDATE: 'user.update',
  USER_DELETE: 'user.delete',
  AUDIT_READ: 'audit.read',
  NOTIFICATION_READ: 'notification.read',
  NOTIFICATION_UPDATE: 'notification.update',
});

const ROLE_PERMISSIONS = Object.freeze({
  Administrator: Object.values(PERMISSIONS),
  Staff: [
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.EQUIPMENT_READ,
    PERMISSIONS.EQUIPMENT_CREATE,
    PERMISSIONS.EQUIPMENT_UPDATE,
    PERMISSIONS.CATEGORY_READ,
    PERMISSIONS.CATEGORY_MANAGE,
    PERMISSIONS.LOAN_READ,
    PERMISSIONS.LOAN_CREATE,
    PERMISSIONS.LOAN_APPROVE,
    PERMISSIONS.LOAN_REJECT,
    PERMISSIONS.LOAN_RETURN,
    PERMISSIONS.MAINTENANCE_READ,
    PERMISSIONS.MAINTENANCE_CREATE,
    PERMISSIONS.MAINTENANCE_UPDATE,
    PERMISSIONS.REPORT_READ,
    PERMISSIONS.NOTIFICATION_READ,
    PERMISSIONS.NOTIFICATION_UPDATE,
  ],
  Borrower: [
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.EQUIPMENT_READ,
    PERMISSIONS.CATEGORY_READ,
    PERMISSIONS.LOAN_READ,
    PERMISSIONS.LOAN_CREATE,
    PERMISSIONS.LOAN_RETURN,
    PERMISSIONS.MAINTENANCE_READ,
    PERMISSIONS.MAINTENANCE_CREATE,
    PERMISSIONS.NOTIFICATION_READ,
    PERMISSIONS.NOTIFICATION_UPDATE,
  ],
});

function hasPermission(role, permission) {
  return Boolean(ROLE_PERMISSIONS[role]?.includes(permission));
}

function permissionsForRole(role) {
  return ROLE_PERMISSIONS[role] ? [...ROLE_PERMISSIONS[role]] : [];
}

module.exports = { PERMISSIONS, ROLE_PERMISSIONS, hasPermission, permissionsForRole };

