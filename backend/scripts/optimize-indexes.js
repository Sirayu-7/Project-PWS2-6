const mysql = require('mysql2/promise');

async function optimizeDb() {
  const conn = await mysql.createConnection({
    host: 'gateway01.ap-northeast-1.prod.aws.tidbcloud.com',
    port: 4000,
    user: '2T39WyZ4bQh9tE2.root',
    password: 'lUxaX2k8cqGoIMTk',
    database: 'test',
    ssl: { rejectUnauthorized: false }
  });

  console.log('=== Checking and creating database indexes for performance ===');

  const indexes = [
    // Table: equipment
    { table: 'equipment', name: 'idx_equipment_status', col: '(status)' },
    { table: 'equipment', name: 'idx_equipment_cat_status', col: '(category_id, status)' },

    // Table: loans
    { table: 'loans', name: 'idx_loans_status', col: '(status)' },
    { table: 'loans', name: 'idx_loans_borrower_status', col: '(borrower_id, status)' },
    { table: 'loans', name: 'idx_loans_due_date', col: '(due_date)' },

    // Table: maintenance
    { table: 'maintenance', name: 'idx_maintenance_status', col: '(status)' },
    { table: 'maintenance', name: 'idx_maintenance_equip_status', col: '(equipment_id, status)' },

    // Table: notifications
    { table: 'notifications', name: 'idx_notif_user_read', col: '(user_id, is_read)' },

    // Table: audit_logs
    { table: 'audit_logs', name: 'idx_audit_created', col: '(created_at DESC)' },
    { table: 'audit_logs', name: 'idx_audit_user', col: '(user_id)' },

    // Table: line_link_tokens
    { table: 'line_link_tokens', name: 'idx_tokens_pin_used', col: '(pin_code, is_used, expires_at)' },
  ];

  for (const idx of indexes) {
    try {
      const [existing] = await conn.query(`SHOW INDEX FROM \`${idx.table}\` WHERE Key_name = ?`, [idx.name]);
      if (existing.length === 0) {
        console.log(`Creating index ${idx.name} on ${idx.table}${idx.col}...`);
        await conn.query(`CREATE INDEX \`${idx.name}\` ON \`${idx.table}\` ${idx.col}`);
        console.log(`  -> Added ${idx.name}`);
      } else {
        console.log(`  -> Index ${idx.name} already exists on ${idx.table}`);
      }
    } catch (e) {
      console.warn(`  [WARN] Failed to create ${idx.name} on ${idx.table}:`, e.message);
    }
  }

  console.log('=== Optimization complete ===');
  await conn.end();
}

optimizeDb().catch(console.error);
