require('dotenv').config();
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const fs = require('fs');

(async () => {
  const users = JSON.parse(fs.readFileSync(require('path').join(__dirname, 'test-users.json'), 'utf8'));
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    charset: 'utf8mb4',
  });

  for (const [roleName, data] of [['Staff', users.staff], ['Borrower', users.borrower]]) {
    const [roles] = await db.execute('SELECT role_id FROM roles WHERE role_name=? LIMIT 1', [roleName]);
    if (!roles.length) throw new Error(`ไม่พบ role ${roleName}`);
    const hash = await bcrypt.hash(data.password, 12);
    await db.execute(
      `INSERT INTO users(role_id,name,username,password_hash,status)
       VALUES(?,?,?,?, 'Active')
       ON DUPLICATE KEY UPDATE role_id=VALUES(role_id),name=VALUES(name),password_hash=VALUES(password_hash),status='Active'`,
      [roles[0].role_id, data.name, data.username, hash]
    );
    console.log(`TEST_USER_READY role=${roleName} username=${data.username}`);
  }

  await db.end();
})().catch((e) => { console.error('SETUP_TEST_USERS_ERROR:', e.message); process.exit(1); });
