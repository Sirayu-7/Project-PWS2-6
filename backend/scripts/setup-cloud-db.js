const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const host = 'gateway01.ap-northeast-1.prod.aws.tidbcloud.com';
const port = 4000;
const user = '2T39WyZ4bQh9tE2.root';
const password = 'lUxaX2k8cqGoIMTk';
const dbName = 'test'; // TiDB default database

async function setupCloudDb() {
  console.log(`[*] Connecting to TiDB Cloud at ${host}:${port}...`);
  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database: dbName,
    multipleStatements: true,
    ssl: { rejectUnauthorized: false },
  });

  console.log('[✓] Connected successfully to TiDB Cloud!');

  // 1. Run Schema SQL
  console.log('[*] Reading and applying database/schema.sql...');
  const schemaPath = path.join(__dirname, '../../database/schema.sql');
  let schemaSql = fs.readFileSync(schemaPath, 'utf8');

  // Remove CREATE DATABASE and USE statements if present so it uses dbName
  schemaSql = schemaSql.replace(/CREATE DATABASE[\s\S]*?;/gi, '');
  schemaSql = schemaSql.replace(/USE `?it_equipment_db`?;/gi, '');

  await connection.query(schemaSql);
  console.log('[✓] Schema applied successfully');

  // 2. Run LINE Migration
  console.log('[*] Applying LINE tables migration...');
  // Users line_user_id column
  const [cols] = await connection.query(`SHOW COLUMNS FROM users LIKE 'line_user_id'`);
  if (!cols.length) {
    await connection.query(`ALTER TABLE users ADD COLUMN line_user_id VARCHAR(64) NULL AFTER status`);
    await connection.query(`ALTER TABLE users ADD UNIQUE INDEX uniq_line_user_id (line_user_id)`);
    console.log('[✓] Added line_user_id column to users');
  }

  // line_link_tokens
  await connection.query(`
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

  // line_conversation_states
  await connection.query(`
    CREATE TABLE IF NOT EXISTS line_conversation_states (
      user_id INT PRIMARY KEY,
      state_action VARCHAR(64) NOT NULL,
      payload TEXT NULL,
      expires_at DATETIME NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[✓] LINE tables verified/created');

  // 3. Seed Users (Admin, Staff, Borrower)
  console.log('[*] Seeding default system users...');
  const usersToSeed = [
    { roleName: 'Administrator', username: 'admin', password: 'Admin@1234', name: 'ผู้ดูแลระบบ' },
    { roleName: 'Staff', username: 'staff', password: 'Staff@1234', name: 'เจ้าหน้าที่ดูแลอุปกรณ์' },
    { roleName: 'Borrower', username: 'borrower', password: 'Borrower@1234', name: 'ผู้ยืมทั่วไป (สมชาย)' }
  ];

  for (const u of usersToSeed) {
    const [roles] = await connection.execute('SELECT role_id FROM roles WHERE role_name=? LIMIT 1', [u.roleName]);
    if (roles.length > 0) {
      const roleId = roles[0].role_id;
      const hash = await bcrypt.hash(u.password, 12);
      await connection.execute(
        `INSERT INTO users (role_id, name, username, password_hash, status)
         VALUES (?, ?, ?, ?, 'Active')
         ON DUPLICATE KEY UPDATE role_id=VALUES(role_id), name=VALUES(name)`,
        [roleId, u.name, u.username, hash]
      );
    }
  }
  console.log('[✓] Default users verified (admin, staff, borrower)');

  // 4. Seed Sample Equipment
  const [existingEq] = await connection.execute('SELECT COUNT(*) as cnt FROM equipment');
  if (existingEq[0].cnt === 0) {
    console.log('[*] Seeding sample equipment...');
    const items = [
      [1, 'EQ-NB-001', 'Dell Latitude 5440', 'Dell', 'Latitude 5440', 'SN-DL-8821', '2025-01-15', 'Available', 'โน้ตบุ๊กสำหรับทำงาน Core i5 RAM 16GB SSD 512GB'],
      [1, 'EQ-NB-002', 'Lenovo ThinkPad E14 Gen 5', 'Lenovo', 'ThinkPad E14', 'SN-LN-9912', '2025-02-10', 'Borrowed', 'โน้ตบุ๊กสำหรับยืมออกนอกสถานที่'],
      [1, 'EQ-NB-003', 'MacBook Air M2 13"', 'Apple', 'MacBook Air', 'SN-AP-4410', '2025-03-01', 'Available', 'สำหรับงานกราฟิกและสื่อ'],
      [2, 'EQ-DT-001', 'HP ProDesk 400 G7', 'HP', 'ProDesk 400', 'SN-HP-3321', '2024-11-20', 'Available', 'เครื่องคอมพิวเตอร์ตั้งโต๊ะสำนักงาน'],
      [3, 'EQ-PJ-001', 'Epson EB-X06 Projector', 'Epson', 'EB-X06', 'SN-EP-1002', '2024-10-05', 'Available', 'โปรเจกเตอร์ความสว่าง 3,600 Lumens สำหรับห้องประชุม'],
      [4, 'EQ-NW-001', 'Cisco Catalyst 2960-X Switch', 'Cisco', 'Catalyst 2960-X', 'SN-CS-7711', '2024-08-12', 'Maintenance', 'สวิตช์เครือข่าย 24 พอร์ต ส่งตรวจเช็คพอร์ตเสีย'],
      [5, 'EQ-PR-001', 'Logitech MX Master 3S', 'Logitech', 'MX Master 3S', 'SN-LG-5520', '2025-01-20', 'Available', 'เมาส์ไร้สายบลูทูธความแม่นยำสูง']
    ];

    for (const item of items) {
      await connection.execute(
        `INSERT INTO equipment (category_id, asset_code, equipment_name, brand, model, serial_number, purchase_date, status, description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        item
      );
    }
    console.log(`[✓] Seeded ${items.length} sample equipment items.`);
  }

  // 5. Link Staff to real LINE User ID directly!
  const staffLineId = 'Ud5e353ae35b7c91346b5e3695125c420';
  await connection.query('UPDATE users SET line_user_id = ? WHERE username = ?', [staffLineId, 'staff']);
  console.log(`[✓] Linked staff user to LINE User ID: ${staffLineId}`);

  // 6. Verify tables
  const [tables] = await connection.query('SHOW TABLES');
  console.log('[*] Cloud Database Tables:', tables.map(t => Object.values(t)[0]));

  const [users] = await connection.query('SELECT user_id, username, name, line_user_id FROM users');
  console.log('[*] Cloud Database Users:', users);

  await connection.end();
  console.log('\n🎉 TiDB Cloud Database is 100% READY!\n');
}

setupCloudDb().catch(err => {
  console.error('[!] Error setting up TiDB Cloud:', err);
  process.exit(1);
});
