require('dotenv').config();
const http = require('http');
const mysql = require('mysql2/promise');

const host = process.env.API_HOST || '127.0.0.1';
const port = Number(process.env.API_PORT || 3000);
const accounts = [
  { username: process.env.ADMIN_USERNAME || 'admin', password: process.env.ADMIN_PASSWORD || 'Admin@1234', role: 'Administrator' },
  { username: process.env.TEST_STAFF_USERNAME || 'staff', password: process.env.TEST_STAFF_PASSWORD || 'Staff@1234', role: 'Staff' },
  { username: process.env.TEST_BORROWER_USERNAME || 'borrower', password: process.env.TEST_BORROWER_PASSWORD || 'Borrower@1234', role: 'Borrower' },
];

function post_login(username, password) {
  const body = JSON.stringify({ username, password });
  return new Promise((resolve, reject) => {
    const req = http.request({ host, port, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, res => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json;
        try { json = JSON.parse(data); } catch (_) {}
        resolve({ status: res.statusCode, json, raw: data });
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'it_equipment_db',
    charset: 'utf8mb4',
  });
  try {
    for (const account of accounts) {
      const result = await post_login(account.username, account.password);
      if (result.status !== 200 || !result.json?.success || !result.json?.token) {
        throw new Error(`LOGIN FAILURE ${account.role}: status=${result.status} body=${result.raw}`);
      }
      if (result.json.user?.username !== account.username || result.json.user?.role !== account.role) {
        throw new Error(`LOGIN FAILURE ${account.role}: returned identity/role mismatch`);
      }
      const [rows] = await db.execute(
        'SELECT log_id FROM audit_logs WHERE user_id=? AND action=? ORDER BY log_id DESC LIMIT 1',
        [result.json.user.id, 'LOGIN']
      );
      if (!rows.length) throw new Error(`LOGIN FAILURE ${account.role}: audit record missing`);
      console.log(`AUTH_LOGIN_PASS role=${account.role} username=${account.username} status=${result.status} token=present audit=PASS`);
    }
    console.log('AUTH_LOGIN_ALL_ROLES_PASS');
  } finally {
    await db.end();
  }
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
