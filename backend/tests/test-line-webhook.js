const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const assert = require('assert');
const crypto = require('crypto');
const pool = require('../src/db');
const jwt = require('jsonwebtoken');
const app = require('../src/server');

const JWT_SECRET = process.env.JWT_SECRET || 'it-equipment-project-change-this-secret';
const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || '90bf72df009f082ce57967292356e0f2';

// Helper to compute HMAC-SHA256 signature for LINE webhook
function createLineSignature(bodyString, secret) {
  return crypto.createHmac('sha256', secret).update(bodyString, 'utf8').digest('base64');
}

async function runTests() {
  console.log('[*] Starting Task 3: LINE Account Linking & Webhook tests...');

  // Start temporary server for testing
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = server.address().port;
  const BASE_URL = `http://127.0.0.1:${port}/api/line`;

  try {
    // Get a test user (borrower, user_id = 3)
    const [users] = await pool.execute("SELECT user_id, username, role_id FROM users WHERE username = 'borrower'");
    assert.ok(users.length > 0, 'Borrower user must exist');
    const user = users[0];

    // Clean any previous test data
    await pool.execute('UPDATE users SET line_user_id = NULL WHERE user_id = ?', [user.user_id]);
    await pool.execute('DELETE FROM line_link_tokens WHERE user_id = ?', [user.user_id]);

    const token = jwt.sign(
      { id: user.user_id, username: user.username, role: 'Borrower' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // 1. Test POST /api/line/link-token
    console.log('[*] Testing POST /api/line/link-token...');
    const resLink = await fetch(`${BASE_URL}/link-token`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    assert.strictEqual(resLink.status, 200, 'Link token should return 200');
    const dataLink = await resLink.json();
    assert.strictEqual(dataLink.success, true);
    assert.strictEqual(typeof dataLink.pin_code, 'string');
    assert.strictEqual(dataLink.pin_code.length, 6);
    const pin = dataLink.pin_code;
    console.log(`[✓] Generated PIN: ${pin}`);

    // 2. Test Invalid Signature on Webhook -> 401
    console.log('[*] Testing Webhook Invalid Signature...');
    const fakeBody = JSON.stringify({ destination: 'xxx', events: [] });
    const resBadSig = await fetch(`${BASE_URL}/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-line-signature': 'invalid_signature_here'
      },
      body: fakeBody
    });
    assert.strictEqual(resBadSig.status, 401, 'Invalid signature must return 401');
    console.log('[✓] Invalid signature correctly rejected with 401');

    // 3. Test Valid Webhook Message Event with 6-digit PIN
    console.log('[*] Testing Webhook with 6-digit PIN...');
    const testLineUserId = 'Utest_borrower_line_id_12345';
    const webhookPayload = JSON.stringify({
      destination: 'xxx',
      events: [
        {
          type: 'message',
          message: { type: 'text', id: 'msg1', text: pin },
          source: { type: 'user', userId: testLineUserId },
          replyToken: 'testReplyToken123',
          timestamp: Date.now()
        }
      ]
    });
    const validSignature = createLineSignature(webhookPayload, CHANNEL_SECRET);

    const resWebhook = await fetch(`${BASE_URL}/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-line-signature': validSignature
      },
      body: webhookPayload
    });
    assert.strictEqual(resWebhook.status, 200, 'Webhook with valid signature must return 200');

    // Verify DB state
    const [updatedUser] = await pool.execute('SELECT line_user_id FROM users WHERE user_id = ?', [user.user_id]);
    assert.strictEqual(updatedUser[0].line_user_id, testLineUserId, 'User line_user_id should be updated');

    const [usedToken] = await pool.execute('SELECT is_used FROM line_link_tokens WHERE pin_code = ?', [pin]);
    assert.strictEqual(usedToken[0].is_used, 1, 'Token should be marked as used');
    console.log('[✓] Account linked via PIN successfully in DB');

    // 4. Test GET /api/line/status
    console.log('[*] Testing GET /api/line/status...');
    const resStatus = await fetch(`${BASE_URL}/status`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.strictEqual(resStatus.status, 200);
    const dataStatus = await resStatus.json();
    assert.strictEqual(dataStatus.linked, true);
    assert.strictEqual(dataStatus.line_user_id, testLineUserId);
    console.log('[✓] Link status returned linked = true');

    // 5. Test POST /api/line/unlink
    console.log('[*] Testing POST /api/line/unlink...');
    const resUnlink = await fetch(`${BASE_URL}/unlink`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.strictEqual(resUnlink.status, 200);
    const dataUnlink = await resUnlink.json();
    assert.strictEqual(dataUnlink.success, true);

    const [unlinkedUser] = await pool.execute('SELECT line_user_id FROM users WHERE user_id = ?', [user.user_id]);
    assert.strictEqual(unlinkedUser[0].line_user_id, null, 'User line_user_id should be NULL after unlink');
    console.log('[✓] Unlink successfully reset line_user_id to null');

  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

runTests()
  .then(() => {
    console.log('\nTask 3: All Account Linking & Webhook tests PASSED!');
    process.exit(0);
  })
  .catch(err => {
    console.error('[!] Test failed:', err);
    process.exit(1);
  });
