require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  const base = 'http://localhost:3000/api';

  // 1. Login admin
  const loginRes = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'Admin@1234' }),
  });
  const loginData = await loginRes.json();
  if (!loginData.success) throw new Error('Admin login failed');
  const token = loginData.token;
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  console.log('✓ Admin login: PASS');

  // 2. Test Category CRUD
  const catCreate = await fetch(`${base}/categories`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ category_name: 'TestCategory' + Date.now(), description: 'Category for testing' }),
  }).then((r) => r.json());
  if (!catCreate.success) throw new Error('Create category failed: ' + catCreate.message);
  console.log('✓ Create Category: PASS');

  const catList = await fetch(`${base}/categories`, { headers }).then((r) => r.json());
  if (!catList.success || !catList.data.length) throw new Error('List categories failed');
  console.log(`✓ List Categories (${catList.data.length} items): PASS`);

  const catDel = await fetch(`${base}/categories/${catCreate.category_id}`, { method: 'DELETE', headers }).then((r) =>
    r.json()
  );
  if (!catDel.success) throw new Error('Delete category failed: ' + catDel.message);
  console.log('✓ Delete Category: PASS');

  // 3. Test Equipment History
  const eqHist = await fetch(`${base}/equipment/1/history`, { headers }).then((r) => r.json());
  if (!eqHist.success || !Array.isArray(eqHist.data.loans) || !Array.isArray(eqHist.data.repairs)) {
    throw new Error('Equipment history failed');
  }
  console.log('✓ Equipment History: PASS');

  // 4. Test Technicians list
  const techs = await fetch(`${base}/maintenance/technicians`, { headers }).then((r) => r.json());
  if (!techs.success || !techs.data.length) throw new Error('Technicians list failed');
  console.log(`✓ Technicians list (${techs.data.length} techs): PASS`);

  // 5. Test Reports Equipment
  const repEquip = await fetch(`${base}/reports/equipment`, { headers }).then((r) => r.json());
  if (!repEquip.success || !Array.isArray(repEquip.data)) throw new Error('Reports equipment failed');
  console.log(`✓ Reports Equipment (${repEquip.data.length} equipment): PASS`);

  // 6. Test Self Deactivation Protection on Admin
  const selfDeact = await fetch(`${base}/users/${loginData.user.id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      name: 'Admin User',
      username: 'admin',
      role_id: 1,
      status: 'Inactive',
    }),
  }).then((r) => r.json());
  if (selfDeact.success) throw new Error('Self deactivation should have been rejected');
  console.log('✓ Self-Deactivation Protection: PASS');

  // 7. Test Self Delete Protection on Admin
  const selfDel = await fetch(`${base}/users/${loginData.user.id}`, {
    method: 'DELETE',
    headers,
  }).then((r) => r.json());
  if (selfDel.success) throw new Error('Self deletion should have been rejected');
  console.log('✓ Self-Delete Protection: PASS');

  console.log('\n====================================');
  console.log('ALL NEW FEATURES VERIFIED 100% PASS!');
  console.log('====================================');
})().catch((err) => {
  console.error('TEST_NEW_FEATURES_FAILED:', err);
  process.exit(1);
});
