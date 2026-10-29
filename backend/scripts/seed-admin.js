require('dotenv').config();
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

(async () => {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'Admin@1234';
  const name = process.env.ADMIN_NAME || 'ผู้ดูแลระบบ';
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, charset: 'utf8mb4' });
  const [roles] = await db.execute('SELECT role_id FROM roles WHERE role_name=? LIMIT 1', ['Administrator']);
  if (!roles.length) throw new Error('ไม่พบ Administrator role');
  const hash = await bcrypt.hash(password, 12);
  await db.execute(`INSERT INTO users(role_id,name,username,password_hash,status) VALUES(?,?,?,?, 'Active') ON DUPLICATE KEY UPDATE role_id=VALUES(role_id),name=VALUES(name),password_hash=VALUES(password_hash),status='Active'`, [roles[0].role_id,name,username,hash]);
  console.log(`ADMIN_READY username=${username}`);
  console.log(`DEV_PASSWORD=${password}`);
  await db.end();
})().catch(e => { console.error('SEED_ERROR:', e.message); process.exit(1); });
