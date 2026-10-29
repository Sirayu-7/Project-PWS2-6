require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'it_equipment_db',
    charset: 'utf8mb4'
  });

  const [existing] = await db.execute('SELECT COUNT(*) as cnt FROM equipment');
  if (existing[0].cnt === 0) {
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
      await db.execute(
        `INSERT INTO equipment (category_id, asset_code, equipment_name, brand, model, serial_number, purchase_date, status, description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        item
      );
    }
    console.log(`Seeded ${items.length} sample equipment items.`);
  } else {
    console.log(`Equipment already has ${existing[0].cnt} items.`);
  }

  await db.end();
})().catch(err => {
  console.error('SEED_SAMPLE_ERROR:', err.message);
  process.exit(1);
});
