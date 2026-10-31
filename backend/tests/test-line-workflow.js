const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const assert = require('assert');
const pool = require('../src/db');
const cronService = require('../src/services/cron');
const lineService = require('../src/services/line');

async function runTests() {
  console.log('[*] Starting Task 5: Domain Workflow Hooks & Daily Cron tests...');

  // 1. Test helper methods on lineService
  assert.strictEqual(typeof lineService.notifyNewLoanRequest, 'function', 'notifyNewLoanRequest must be defined');
  assert.strictEqual(typeof lineService.notifyMaintenanceTicket, 'function', 'notifyMaintenanceTicket must be defined');

  // 2. Setup test data for Daily Scan
  const [eqs] = await pool.execute("SELECT equipment_id FROM equipment WHERE status = 'Available' LIMIT 2");
  assert.ok(eqs.length >= 2, 'Need 2 available items');
  const eqToday = eqs[0].equipment_id;
  const eqPast = eqs[1].equipment_id;

  // Insert loan due today
  const [r1] = await pool.execute(`
    INSERT INTO loans (equipment_id, borrower_id, request_date, due_date, status)
    VALUES (?, 3, NOW(), CURDATE(), 'Borrowed')
  `, [eqToday]);
  const loanTodayId = r1.insertId;

  // Insert loan past due
  const [r2] = await pool.execute(`
    INSERT INTO loans (equipment_id, borrower_id, request_date, due_date, status)
    VALUES (?, 3, DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_SUB(CURDATE(), INTERVAL 1 DAY), 'Borrowed')
  `, [eqPast]);
  const loanPastId = r2.insertId;

  // Run daily scan
  console.log('[*] Running cronService.runDailyScan()...');
  const result = await cronService.runDailyScan();
  console.log(`[i] Scan result: due today: ${result.dueTodayCount}, marked overdue: ${result.overdueCount}`);

  // Assert past due loan is now 'Overdue'
  const [checkOverdue] = await pool.execute('SELECT status FROM loans WHERE loan_id = ?', [loanPastId]);
  assert.strictEqual(checkOverdue[0].status, 'Overdue', 'Past loan must transition to Overdue');

  // Assert today's loan remains 'Borrowed'
  const [checkToday] = await pool.execute('SELECT status FROM loans WHERE loan_id = ?', [loanTodayId]);
  assert.strictEqual(checkToday[0].status, 'Borrowed', "Today's loan should remain Borrowed");

  console.log('[✓] Daily scan correctly flagged overdue loan and preserved due-today loan');

  // Cleanup
  await pool.execute('DELETE FROM loans WHERE loan_id IN (?, ?)', [loanTodayId, loanPastId]);

  console.log('\nTask 5: All Domain Workflow Hooks & Daily Cron tests PASSED!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('[!] Test failed:', err);
  process.exit(1);
});

