const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const assert = require('assert');
const crypto = require('crypto');
const pool = require('../src/db');
const app = require('../src/server');

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || '90bf72df009f082ce57967292356e0f2';

function createLineSignature(bodyString, secret) {
  return crypto.createHmac('sha256', secret).update(bodyString, 'utf8').digest('base64');
}

async function runTests() {
  console.log('[*] Starting Task 4: Interactive Bot & Conversational Rejection tests...');

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = server.address().port;
  const BASE_URL = `http://127.0.0.1:${port}/api/line/webhook`;

  try {
    // Setup staff user (id: 2) and borrower user (id: 3)
    const staffLineId = 'Ustaff_line_test_456';
    const borrowerLineId = 'Uborrower_line_test_789';

    await pool.execute("UPDATE users SET line_user_id = ? WHERE username = 'staff'", [staffLineId]);
    await pool.execute("UPDATE users SET line_user_id = ? WHERE username = 'borrower'", [borrowerLineId]);

    // Ensure we have an available equipment
    const [eqs] = await pool.execute("SELECT equipment_id FROM equipment WHERE status = 'Available' LIMIT 2");
    assert.ok(eqs.length >= 2, 'Need at least 2 equipment items');
    const eq1 = eqs[0].equipment_id;
    const eq2 = eqs[1].equipment_id;

    // Create Test Loan 1 for Approval
    const [r1] = await pool.execute(`
      INSERT INTO loans (equipment_id, borrower_id, request_date, due_date, purpose, status)
      VALUES (?, 3, NOW(), DATE_ADD(NOW(), INTERVAL 3 DAY), 'Test Loan 1', 'Pending')
    `, [eq1]);
    const loan1Id = r1.insertId;

    // Create Test Loan 2 for Rejection
    const [r2] = await pool.execute(`
      INSERT INTO loans (equipment_id, borrower_id, request_date, due_date, purpose, status)
      VALUES (?, 3, NOW(), DATE_ADD(NOW(), INTERVAL 3 DAY), 'Test Loan 2', 'Pending')
    `, [eq2]);
    const loan2Id = r2.insertId;

    // 1. Staff approves Loan 1 via postback
    console.log(`[*] Testing Staff postback approval on loan #${loan1Id}...`);
    const approvePayload = JSON.stringify({
      destination: 'xxx',
      events: [{
        type: 'postback',
        postback: { data: `action=approve_loan&loan_id=${loan1Id}` },
        source: { type: 'user', userId: staffLineId },
        replyToken: 'repApprove1',
        timestamp: Date.now()
      }]
    });
    const resApprove = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-line-signature': createLineSignature(approvePayload, CHANNEL_SECRET)
      },
      body: approvePayload
    });
    assert.strictEqual(resApprove.status, 200);

    const [updatedLoan1] = await pool.execute('SELECT status, approved_by FROM loans WHERE loan_id = ?', [loan1Id]);
    assert.strictEqual(updatedLoan1[0].status, 'Borrowed', 'Loan 1 status should be Borrowed');
    assert.strictEqual(updatedLoan1[0].approved_by, 2, 'Approved by staff (id=2)');

    const [updatedEq1] = await pool.execute('SELECT status FROM equipment WHERE equipment_id = ?', [eq1]);
    assert.strictEqual(updatedEq1[0].status, 'Borrowed', 'Equipment 1 should be Borrowed');
    console.log('[✓] Staff approval postback successfully processed');

    // 2. Non-staff user tries to approve loan 2 -> should be rejected
    console.log('[*] Testing Borrower trying to approve loan #2 (RBAC check)...');
    const badApprovePayload = JSON.stringify({
      destination: 'xxx',
      events: [{
        type: 'postback',
        postback: { data: `action=approve_loan&loan_id=${loan2Id}` },
        source: { type: 'user', userId: borrowerLineId },
        replyToken: 'repApproveBad',
        timestamp: Date.now()
      }]
    });
    await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-line-signature': createLineSignature(badApprovePayload, CHANNEL_SECRET)
      },
      body: badApprovePayload
    });
    const [checkLoan2Pending] = await pool.execute('SELECT status FROM loans WHERE loan_id = ?', [loan2Id]);
    assert.strictEqual(checkLoan2Pending[0].status, 'Pending', 'Loan 2 should remain Pending when non-staff attempts approval');
    console.log('[✓] Non-staff postback correctly blocked');

    // 3. Conversational Rejection Flow:
    // Step 3a: Staff clicks Reject button -> triggers reject_loan_init
    console.log(`[*] Testing Staff reject_loan_init on loan #${loan2Id}...`);
    const initRejectPayload = JSON.stringify({
      destination: 'xxx',
      events: [{
        type: 'postback',
        postback: { data: `action=reject_loan_init&loan_id=${loan2Id}` },
        source: { type: 'user', userId: staffLineId },
        replyToken: 'repRejectInit',
        timestamp: Date.now()
      }]
    });
    await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-line-signature': createLineSignature(initRejectPayload, CHANNEL_SECRET)
      },
      body: initRejectPayload
    });

    const [states] = await pool.execute('SELECT * FROM line_conversation_states WHERE user_id = 2');
    assert.strictEqual(states.length, 1, 'Should have active conversation state');
    assert.strictEqual(states[0].state_action, 'AWAITING_REJECT_REASON');
    console.log('[✓] Active conversation state saved');

    // Step 3b: Staff replies with reason text
    console.log('[*] Testing Staff sending rejection reason in chat...');
    const reasonText = 'อุปกรณ์ต้องส่งบำรุงรักษาด่วน';
    const msgReasonPayload = JSON.stringify({
      destination: 'xxx',
      events: [{
        type: 'message',
        message: { type: 'text', id: 'mReject1', text: reasonText },
        source: { type: 'user', userId: staffLineId },
        replyToken: 'repReason1',
        timestamp: Date.now()
      }]
    });
    await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-line-signature': createLineSignature(msgReasonPayload, CHANNEL_SECRET)
      },
      body: msgReasonPayload
    });

    const [updatedLoan2] = await pool.execute('SELECT status, remark, approved_by FROM loans WHERE loan_id = ?', [loan2Id]);
    assert.strictEqual(updatedLoan2[0].status, 'Rejected', 'Loan 2 should be Rejected');
    assert.strictEqual(updatedLoan2[0].remark, reasonText, 'Remark should match staff message');
    assert.strictEqual(updatedLoan2[0].approved_by, 2);

    const [statesAfter] = await pool.execute('SELECT * FROM line_conversation_states WHERE user_id = 2');
    assert.strictEqual(statesAfter.length, 0, 'Conversation state should be cleared after completion');
    console.log('[✓] Conversational rejection completed and state cleared');

    // 4. Test Keyword "รายการยืมของฉัน"
    console.log('[*] Testing Keyword "รายการยืมของฉัน"...');
    const myLoansPayload = JSON.stringify({
      destination: 'xxx',
      events: [{
        type: 'message',
        message: { type: 'text', id: 'mQuery1', text: 'รายการยืมของฉัน' },
        source: { type: 'user', userId: borrowerLineId },
        replyToken: 'repMyLoans',
        timestamp: Date.now()
      }]
    });
    const resMyLoans = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-line-signature': createLineSignature(myLoansPayload, CHANNEL_SECRET)
      },
      body: myLoansPayload
    });
    assert.strictEqual(resMyLoans.status, 200);
    console.log('[✓] Keyword "รายการยืมของฉัน" handled successfully');

    // 5. Test Keyword "อุปกรณ์ว่าง"
    console.log('[*] Testing Keyword "อุปกรณ์ว่าง"...');
    const availPayload = JSON.stringify({
      destination: 'xxx',
      events: [{
        type: 'message',
        message: { type: 'text', id: 'mQuery2', text: 'อุปกรณ์ว่าง' },
        source: { type: 'user', userId: borrowerLineId },
        replyToken: 'repAvail',
        timestamp: Date.now()
      }]
    });
    const resAvail = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-line-signature': createLineSignature(availPayload, CHANNEL_SECRET)
      },
      body: availPayload
    });
    assert.strictEqual(resAvail.status, 200);
    console.log('[✓] Keyword "อุปกรณ์ว่าง" handled successfully');

    // Cleanup test loans
    await pool.execute('DELETE FROM loans WHERE loan_id IN (?, ?)', [loan1Id, loan2Id]);
    await pool.execute("UPDATE equipment SET status = 'Available' WHERE equipment_id IN (?, ?)", [eq1, eq2]);

  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

runTests()
  .then(() => {
    console.log('\nTask 4: All Interactive Bot & Conversational Rejection tests PASSED!');
    process.exit(0);
  })
  .catch(err => {
    console.error('[!] Test failed:', err);
    process.exit(1);
  });

