const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from backend/.env
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
if (!token) {
  console.error('❌ Error: LINE_CHANNEL_ACCESS_TOKEN is missing in .env');
  process.exit(1);
}

const assetsDir = path.resolve(__dirname, '../assets/richmenu');
const guestImgPath = path.join(assetsDir, 'Guest.png');
const borrowerImgPath = path.join(assetsDir, 'Borrower.png');
const staffImgPath = path.join(assetsDir, 'Staff.jpg');

// Ensure assets exist
for (const [name, p] of Object.entries({ Guest: guestImgPath, Borrower: borrowerImgPath, Staff: staffImgPath })) {
  if (!fs.existsSync(p)) {
    console.error(`❌ Error: Image file not found: ${p}`);
    process.exit(1);
  }
}

const defaultWebUrl = 'https://project-pws2-6.vercel.app';
const webUrl = (process.env.SYSTEM_WEB_URL && process.env.SYSTEM_WEB_URL.startsWith('http'))
  ? process.env.SYSTEM_WEB_URL
  : defaultWebUrl;

// 1. Definition of Guest Menu (2500 x 843)
const guestMenu = {
  size: { width: 2500, height: 843 },
  selected: true,
  name: 'IT_EQUIPMENT_GUEST',
  chatBarText: 'เมนูระบบไอที',
  areas: [
    {
      bounds: { x: 0, y: 0, width: 833, height: 843 },
      action: { type: 'uri', label: 'ผูกบัญชีระบบ', uri: `${webUrl}/login` },
    },
    {
      bounds: { x: 833, y: 0, width: 834, height: 843 },
      action: { type: 'message', label: 'อุปกรณ์ว่าง', text: 'อุปกรณ์ว่าง' },
    },
    {
      bounds: { x: 1667, y: 0, width: 833, height: 843 },
      action: { type: 'message', label: 'วิธีเชื่อมต่อ/ช่วยเหลือ', text: 'ช่วยเหลือ' },
    },
  ],
};

// 2. Definition of Borrower Menu (2500 x 843)
const borrowerMenu = {
  size: { width: 2500, height: 843 },
  selected: true,
  name: 'IT_EQUIPMENT_BORROWER',
  chatBarText: 'เมนูยืมอุปกรณ์',
  areas: [
    {
      bounds: { x: 0, y: 0, width: 833, height: 843 },
      action: { type: 'message', label: 'รายการยืมของฉัน', text: 'รายการยืมของฉัน' },
    },
    {
      bounds: { x: 833, y: 0, width: 834, height: 843 },
      action: { type: 'message', label: 'อุปกรณ์ว่าง', text: 'อุปกรณ์ว่าง' },
    },
    {
      bounds: { x: 1667, y: 0, width: 833, height: 843 },
      action: { type: 'uri', label: 'เปิดเว็บยืม/แจ้งซ่อม', uri: `${webUrl}/loan` },
    },
  ],
};

// 3. Definition of Staff & Administrator Menu (2500 x 1686, 6 areas)
const staffMenu = {
  size: { width: 2500, height: 1686 },
  selected: true,
  name: 'IT_EQUIPMENT_STAFF',
  chatBarText: 'เมนูทีมไอที',
  areas: [
    // Row 1
    {
      bounds: { x: 0, y: 0, width: 833, height: 843 },
      action: { type: 'message', label: 'คำขอรออนุมัติ', text: 'คำขอรออนุมัติ' },
    },
    {
      bounds: { x: 833, y: 0, width: 834, height: 843 },
      action: { type: 'message', label: 'รายการแจ้งซ่อม', text: 'รายการแจ้งซ่อม' },
    },
    {
      bounds: { x: 1667, y: 0, width: 833, height: 843 },
      action: { type: 'message', label: 'อุปกรณ์ว่าง', text: 'อุปกรณ์ว่าง' },
    },
    // Row 2
    {
      bounds: { x: 0, y: 843, width: 833, height: 843 },
      action: { type: 'message', label: 'รายการยืมของฉัน', text: 'รายการยืมของฉัน' },
    },
    {
      bounds: { x: 833, y: 843, width: 834, height: 843 },
      action: { type: 'uri', label: 'เปิดเว็บระบบ', uri: webUrl },
    },
    {
      bounds: { x: 1667, y: 843, width: 833, height: 843 },
      action: { type: 'message', label: 'คู่มือ/ช่วยเหลือ', text: 'ช่วยเหลือ' },
    },
  ],
};

// API Helpers
async function apiCall(endpoint, method = 'GET', data = null, contentType = 'application/json') {
  const headers = { Authorization: `Bearer ${token}` };
  const options = { method, headers };

  if (data) {
    if (contentType === 'application/json') {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(data);
    } else {
      headers['Content-Type'] = contentType;
      options.body = data;
    }
  }

  const res = await fetch(`https://api.line.me${endpoint}`, options);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}

  if (!res.ok) {
    throw new Error(`[${res.status}] ${endpoint} failed: ${text}`);
  }
  return json || text;
}

async function uploadImage(richMenuId, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = ext === '.png' ? 'image/png' : 'image/jpeg';
  const buffer = fs.readFileSync(filePath);

  const res = await fetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': contentType,
    },
    body: buffer,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`[${res.status}] upload image failed: ${errText}`);
  }
}

async function updateEnvFile(ids) {
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  const entries = [
    ['LINE_RICH_MENU_DEFAULT_ID', ids.guestId],
    ['LINE_RICH_MENU_BORROWER_ID', ids.borrowerId],
    ['LINE_RICH_MENU_STAFF_ID', ids.staffId],
  ];

  for (const [key, val] of entries) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${val}`);
    } else {
      envContent += `\n${key}=${val}`;
    }
  }

  fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf8');
  console.log('✅ Updated backend/.env with new Rich Menu IDs');
}

async function syncExistingDbUsers(ids) {
  try {
    let pool;
    try {
      pool = require('../src/db');
      await pool.query('SELECT 1');
    } catch {
      const mysql = require('mysql2/promise');
      pool = mysql.createPool({
        host: 'gateway01.ap-northeast-1.prod.aws.tidbcloud.com',
        port: 4000,
        user: '2T39WyZ4bQh9tE2.root',
        password: 'lUxaX2k8cqGoIMTk',
        database: 'test',
        ssl: { rejectUnauthorized: false }
      });
    }

    const [rows] = await pool.execute(`
      SELECT u.user_id, u.line_user_id, r.role_name 
      FROM users u
      JOIN roles r ON r.role_id = u.role_id
      WHERE u.line_user_id IS NOT NULL AND u.status = 'Active'
    `);

    if (!rows.length) {
      console.log('ℹ️ No existing linked LINE users in DB to sync.');
      return;
    }

    console.log(`[*] Syncing ${rows.length} existing linked user(s)...`);
    for (const u of rows) {
      const isStaff = ['Administrator', 'Staff'].includes(u.role_name);
      const targetMenuId = isStaff ? ids.staffId : ids.borrowerId;
      try {
        await apiCall(`/v2/bot/user/${u.line_user_id}/richmenu/${targetMenuId}`, 'POST');
        console.log(`  ✓ Linked ${u.role_name} (${u.line_user_id}) -> ${isStaff ? 'STAFF' : 'BORROWER'} menu`);
      } catch (err) {
        console.warn(`  ⚠️ Could not link ${u.line_user_id}: ${err.message}`);
      }
    }
  } catch (err) {
    console.warn('⚠️ DB sync skipped:', err.message);
  }
}

async function run() {
  console.log('🚀 Starting LINE Rich Menu Setup...');

  // 1. Check existing rich menus
  const existing = await apiCall('/v2/bot/richmenu/list');
  console.log(`[*] Existing rich menus on channel: ${existing.richmenus?.length || 0}`);

  // Delete previous IT_EQUIPMENT menus if clean option or found
  if (existing.richmenus && existing.richmenus.length > 0) {
    console.log('[*] Cleaning up old IT_EQUIPMENT rich menus...');
    for (const rm of existing.richmenus) {
      if (rm.name.startsWith('IT_EQUIPMENT_') || process.argv.includes('--clean-all')) {
        await apiCall(`/v2/bot/richmenu/${rm.richMenuId}`, 'DELETE');
        console.log(`  - Deleted old menu: ${rm.name} (${rm.richMenuId})`);
      }
    }
  }

  // 2. Create Guest Menu
  console.log('[1/3] Creating GUEST Rich Menu...');
  const guestRes = await apiCall('/v2/bot/richmenu', 'POST', guestMenu);
  const guestId = guestRes.richMenuId;
  console.log(`  ✓ Created ID: ${guestId}`);
  await uploadImage(guestId, guestImgPath);
  console.log(`  ✓ Uploaded Guest.png (${(fs.statSync(guestImgPath).size / 1024).toFixed(1)} KB)`);

  // 3. Set Guest Menu as Default (Everyone sees this first)
  console.log('[*] Setting GUEST Menu as Default for all users...');
  await apiCall(`/v2/bot/user/all/richmenu/${guestId}`, 'POST');
  console.log('  ✓ Set as Default Rich Menu');

  // 4. Create Borrower Menu
  console.log('[2/3] Creating BORROWER Rich Menu...');
  const borrowerRes = await apiCall('/v2/bot/richmenu', 'POST', borrowerMenu);
  const borrowerId = borrowerRes.richMenuId;
  console.log(`  ✓ Created ID: ${borrowerId}`);
  await uploadImage(borrowerId, borrowerImgPath);
  console.log(`  ✓ Uploaded Borrower.png (${(fs.statSync(borrowerImgPath).size / 1024).toFixed(1)} KB)`);

  // 5. Create Staff Menu
  console.log('[3/3] Creating STAFF Rich Menu...');
  const staffRes = await apiCall('/v2/bot/richmenu', 'POST', staffMenu);
  const staffId = staffRes.richMenuId;
  console.log(`  ✓ Created ID: ${staffId}`);
  await uploadImage(staffId, staffImgPath);
  console.log(`  ✓ Uploaded Staff.jpg (${(fs.statSync(staffImgPath).size / 1024).toFixed(1)} KB)`);

  // 6. Save IDs to .env
  const ids = { guestId, borrowerId, staffId };
  await updateEnvFile(ids);

  // 7. Sync existing DB users
  await syncExistingDbUsers(ids);

  console.log('\n🎉 ALL DONE! Rich Menus successfully configured on LINE!');
  console.log(`- Guest ID (Default): ${guestId}`);
  console.log(`- Borrower ID:       ${borrowerId}`);
  console.log(`- Staff ID:          ${staffId}`);
  process.exit(0);
}

run().catch((err) => {
  console.error('\n❌ Rich Menu setup failed:', err.message);
  process.exit(1);
});
