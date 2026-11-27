const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const host = 'gateway01.ap-northeast-1.prod.aws.tidbcloud.com';
const port = 4000;
const user = '2T39WyZ4bQh9tE2.root';
const password = 'lUxaX2k8cqGoIMTk';
const dbName = 'it_equipment_v2';

async function initV2Db() {
  console.log(`[*] Connecting to TiDB Cloud and creating database ${dbName}...`);
  const rootConn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    ssl: { rejectUnauthorized: false }
  });
  await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await rootConn.end();

  console.log(`[*] Connecting directly to ${dbName}...`);
  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database: dbName,
    multipleStatements: true,
    ssl: { rejectUnauthorized: false }
  });

  console.log('[*] Applying schema.sql...');
  const schemaPath = path.join(__dirname, '../../database/schema.sql');
  let sql = fs.readFileSync(schemaPath, 'utf8');
  sql = sql.replace(/CREATE DATABASE[\s\S]*?;/gi, '');
  sql = sql.replace(/USE `?it_equipment_db`?;/gi, '');
  await conn.query(sql);

  console.log('[*] Applying LINE tables migration...');
  const [cols] = await conn.query("SHOW COLUMNS FROM users LIKE 'line_user_id'");
  if (!cols.length) {
    await conn.query("ALTER TABLE users ADD COLUMN line_user_id VARCHAR(64) NULL AFTER status");
    await conn.query("ALTER TABLE users ADD UNIQUE INDEX uniq_line_user_id (line_user_id)");
  }

  await conn.query(`
    CREATE TABLE IF NOT EXISTS line_link_tokens (
      token_id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      pin_code VARCHAR(6) NOT NULL,
      expires_at DATETIME NOT NULL,
      is_used TINYINT(1) DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_pin (pin_code),
      INDEX idx_user (user_id),
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS line_conversation_states (
      user_id INT PRIMARY KEY,
      state_action VARCHAR(64) NOT NULL,
      payload TEXT NULL,
      expires_at DATETIME NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log('[*] Seeding default system users for V2...');
  const users = [
    { role: 'Administrator', username: 'admin', pass: 'Admin@1234', name: 'ผู้ดูแลระบบ (Admin V2)' },
    { role: 'Staff', username: 'staff', pass: 'Staff@1234', name: 'เจ้าหน้าที่ดูแลอุปกรณ์ (Staff V2)' },
    { role: 'Borrower', username: 'borrower', pass: 'Borrower@1234', name: 'ผู้ยืมทั่วไป (Borrower V2)' }
  ];

  for (const u of users) {
    const [roles] = await conn.execute('SELECT role_id FROM roles WHERE role_name=? LIMIT 1', [u.role]);
    if (roles.length > 0) {
      const hash = await bcrypt.hash(u.pass, 12);
      await conn.execute(
        `INSERT INTO users (role_id, name, username, password_hash, status)
         VALUES (?, ?, ?, ?, 'Active')
         ON DUPLICATE KEY UPDATE role_id=VALUES(role_id), name=VALUES(name)`,
        [roles[0].role_id, u.name, u.username, hash]
      );
    }
  }

  console.log('[*] Seeding sample equipment for V2...');
  const [eqCount] = await conn.query('SELECT COUNT(*) as cnt FROM equipment');
  if (eqCount[0].cnt === 0) {
    const items = [
      [1, 'EQ-NB-001', 'Dell Latitude 5440', 'Dell', 'Latitude 5440', 'SN-DL-8821', '2025-01-15', 'Available', 'โน้ตบุ๊กสำหรับทำงาน Core i5 RAM 16GB SSD 512GB'],
      [1, 'EQ-NB-002', 'Lenovo ThinkPad E14 Gen 5', 'Lenovo', 'ThinkPad E14', 'SN-LN-9912', '2025-02-10', 'Available', 'โน้ตบุ๊กสำหรับยืมออกนอกสถานที่'],
      [1, 'EQ-NB-003', 'MacBook Air M2 13"', 'Apple', 'MacBook Air', 'SN-AP-4410', '2025-03-01', 'Available', 'สำหรับงานกราฟิกและสื่อ'],
      [2, 'EQ-DT-001', 'HP ProDesk 400 G7', 'HP', 'ProDesk 400', 'SN-HP-3321', '2024-11-20', 'Available', 'เครื่องคอมพิวเตอร์ตั้งโต๊ะสำนักงาน'],
      [3, 'EQ-PJ-001', 'Epson EB-X06 Projector', 'Epson', 'EB-X06', 'SN-EP-1002', '2024-10-05', 'Available', 'โปรเจกเตอร์ความสว่าง 3,600 Lumens สำหรับห้องประชุม'],
      [4, 'EQ-NW-001', 'Cisco Catalyst 2960-X Switch', 'Cisco', 'Catalyst 2960-X', 'SN-CS-7711', '2024-08-12', 'Maintenance', 'สวิตช์เครือข่าย 24 พอร์ต ส่งตรวจเช็คพอร์ตเสีย'],
      [5, 'EQ-PR-001', 'Logitech MX Master 3S', 'Logitech', 'MX Master 3S', 'SN-LG-5520', '2025-01-20', 'Available', 'เมาส์ไร้สายบลูทูธความแม่นยำสูง']
    ];
    for (const item of items) {
      await conn.execute(
        `INSERT INTO equipment (category_id, asset_code, equipment_name, brand, model, serial_number, purchase_date, status, description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        item
      );
    }
  }

  const [tables] = await conn.query('SHOW TABLES');
  console.log('[✓] V2 Tables created:', tables.map(t => Object.values(t)[0]));

  const [uList] = await conn.query('SELECT user_id, username, name, role_id FROM users');
  console.log('[✓] V2 Initial Users:', uList);

  await conn.end();
  console.log('\n🎉 it_equipment_v2 database is 100% READY and completely SEPARATED from V1!\n');
}

initV2Db().catch(e => {
  console.error('[!] Error initializing V2 database:', e);
  process.exit(1);
});
