const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

// 1. Ensure backend/.env exists
const backendEnvPath = path.join(__dirname, '../.env');
const backendEnvExamplePath = path.join(__dirname, '../.env.example');
if (!fs.existsSync(backendEnvPath) && fs.existsSync(backendEnvExamplePath)) {
  fs.copyFileSync(backendEnvExamplePath, backendEnvPath);
  console.log('[INFO] Created backend/.env from .env.example');
}
require('dotenv').config({ path: backendEnvPath });

// 2. Ensure frontend/.env exists
const frontendEnvPath = path.join(__dirname, '../../frontend/.env');
const frontendEnvExamplePath = path.join(__dirname, '../../frontend/.env.example');
if (!fs.existsSync(frontendEnvPath) && fs.existsSync(frontendEnvExamplePath)) {
  fs.copyFileSync(frontendEnvExamplePath, frontendEnvPath);
  console.log('[INFO] Created frontend/.env from .env.example');
}

const host = process.env.DB_HOST || '127.0.0.1';
const port = Number(process.env.DB_PORT || 3306);
const user = process.env.DB_USER || 'root';
const password = process.env.DB_PASSWORD || '';
const dbName = process.env.DB_NAME || 'it_equipment_db';

(async () => {
  console.log(`[*] Connecting to MySQL at ${host}:${port}...`);
  let connection;
  try {
    connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      multipleStatements: true,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
    });
  } catch (err) {
    console.error('\n[ERROR] ไม่สามารถเชื่อมต่อกับ MySQL Server ได้:');
    console.error(`- Host: ${host}:${port}`);
    console.error(`- User: ${user}`);
    console.error(`- รายละเอียด: ${err.message}`);
    console.error('\nกรุณาตรวจสอบว่าเปิด MySQL (เช่น ในโปรแกรม XAMPP Control Panel) แล้วหรือยัง\n');
    process.exit(1);
  }

  // 3. Create Database if not exists
  console.log(`[*] Checking database: ${dbName}...`);
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  await connection.query(`USE \`${dbName}\`;`);

  // 4. Run Schema SQL
  const schemaPath = path.join(__dirname, '../../database/schema.sql');
  if (fs.existsSync(schemaPath)) {
    console.log('[*] Applying database schema...');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await connection.query(schemaSql);
    console.log('[✓] Schema & Tables are ready.');
  } else {
    console.warn(`[!] Warning: schema.sql not found at ${schemaPath}`);
  }

  // 5. Seed Users (Admin, Staff, Borrower)
  console.log('[*] Checking default system users...');
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
  console.log('[✓] Default users verified (admin, staff, borrower).');

  // 6. Seed Sample Equipment if table is empty
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
  } else {
    console.log(`[✓] Equipment table already contains data (${existingEq[0].cnt} items).`);
  }

  await connection.end();

  console.log('\n===================================================');
  console.log(' [✓] Database setup completed successfully!');
  console.log(` - Database: ${dbName}`);
  console.log(' - Admin    : admin    / Admin@1234');
  console.log(' - Staff    : staff    / Staff@1234');
  console.log(' - Borrower : borrower / Borrower@1234');
  console.log('===================================================\n');
})().catch(err => {
  console.error('[!] INIT_DB_ERROR:', err.message);
  process.exit(1);
});

