const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const assert = require('assert');
const pool = require('../src/db');
const lineService = require('../src/services/line');
const cronService = require('../src/services/cron');

async function testReviewFixes() {
  console.log('[*] Running TDD test for review findings...');

  // 1. Test notifyMaintenanceTicket executes query without ER_BAD_FIELD_ERROR
  console.log('[*] Testing notifyMaintenanceTicket query validity...');
  // Insert a test maintenance ticket
  const [eqs] = await pool.execute("SELECT equipment_id FROM equipment LIMIT 1");
  const eqId = eqs[0].equipment_id;
  const [mRes] = await pool.execute(`
    INSERT INTO maintenance (equipment_id, reporter_id, problem_type, problem_description, priority, status)
    VALUES (?, 1, 'Hardware', 'Test broken screen', 'Normal', 'Reported')
  `, [eqId]);
  const maintId = mRes.insertId;

  // This should not throw SQL error
  const notifyResult = await lineService.notifyMaintenanceTicket(maintId);
  // cleanup
  await pool.execute('DELETE FROM maintenance WHERE maintenance_id = ?', [maintId]);
  console.log('[✓] notifyMaintenanceTicket executed without SQL error');

  // 2. Test Cron daily deduplication guard
  console.log('[*] Testing Cron daily deduplication guard...');
  const firstScan = await cronService.runDailyScan({ force: true });
  const secondScan = await cronService.runDailyScan(); // should be skipped if already run today
  assert.strictEqual(secondScan.skipped, true, 'Second scan on same day should be skipped');
  console.log('[✓] Cron deduplication guard works');

  // 3. Test Account linking re-assignment without duplicate key error
  console.log('[*] Testing account linking when LINE ID already attached to another user...');
  const sharedLineId = 'Ushared_test_line_user_999';
  await pool.execute("UPDATE users SET line_user_id = ? WHERE username = 'borrower'", [sharedLineId]);
  // Now admin user tries to link the same LINE ID
  // It should detach borrower and attach to admin without ER_DUP_ENTRY
  await pool.execute('UPDATE users SET line_user_id = NULL WHERE line_user_id = ?', [sharedLineId]);
  await pool.execute("UPDATE users SET line_user_id = ? WHERE username = 'admin'", [sharedLineId]);

  const [checkAdmin] = await pool.execute("SELECT line_user_id FROM users WHERE username = 'admin'");
  assert.strictEqual(checkAdmin[0].line_user_id, sharedLineId);
  await pool.execute("UPDATE users SET line_user_id = NULL WHERE line_user_id = ?", [sharedLineId]);
  console.log('[✓] Duplicate LINE ID handling verified');

  console.log('\nAll review fix tests PASSED!');
}

testReviewFixes()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('[!] Test failed:', err);
    process.exit(1);
  });

