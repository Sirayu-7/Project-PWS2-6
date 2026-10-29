// language: JavaScript, file: backend/scripts/test-auth-login.js, runtime: Node.js 20+/26, target: local IT Equipment API
// Integration test for POST /api/auth/login using the project's seeded Administrator credentials.
require('dotenv').config();
const http = require('http');
const mysql = require('mysql2/promise');

const host = process.env.API_HOST || '127.0.0.1';
const port = Number(process.env.API_PORT || 3000);
const username = process.env.TEST_ADMIN_USERNAME || process.env.ADMIN_USERNAME || 'admin';
const password = process.env.TEST_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || 'Admin@1234';

function postLogin() {
  const body = JSON.stringify({ username, password });
  return new Promise((resolve, reject) => {
    const req = http.request({
      host,
      port,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
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
  const result = await postLogin();
  if (result.status !== 200 || !result.json?.success) {
    throw new Error(`LOGIN HTTP FAILURE: status=${result.status} body=${result.raw}`);
  }
  if (!result.json.token) throw new Error('LOGIN FAILURE: missing JWT token');
  if (result.json.user?.username !== username) throw new Error('LOGIN FAILURE: returned username mismatch');
  if (result.json.user?.role !== 'Administrator') throw new Error(`LOGIN FAILURE: expected Administrator, got ${result.json.user?.role}`);

  const db = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'it_equipment_db',
    charset: 'utf8mb4',
  });
  try {
    const [rows] = await db.execute(
      'SELECT action, table_name, record_id FROM audit_logs WHERE user_id=? AND action=? ORDER BY log_id DESC LIMIT 1',
      [result.json.user.id, 'LOGIN']
    );
    if (!rows.length) throw new Error('LOGIN FAILURE: audit LOGIN record not created');
    console.log(`AUTH_LOGIN_PASS status=${result.status} username=${result.json.user.username} role=${result.json.user.role} token=present audit=PASS`);
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
