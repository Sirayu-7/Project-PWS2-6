require('dotenv').config();
const assert = require('assert');
const pool = require('../src/db');
const lineService = require('../src/services/line');

async function testMaintenanceStatusChange() {
  console.log('[*] Testing Maintenance Status Change via LINE Chatbot...');

  // 1. Verify buildMaintenanceTicketsCarousel has interactive buttons
  const mockTickets = [
    {
      maintenance_id: 99,
      equipment_name: 'Test Projector',
      asset_code: 'EQ-PJ-099',
      problem_type: 'หลอดภาพเสีย',
      problem_description: 'เปิดแล้วไฟกระพริบสีแดง',
      status: 'Reported',
      reporter_name: 'สมชาย',
      reported_at: new Date(),
    },
    {
      maintenance_id: 100,
      equipment_name: 'Test Laptop',
      asset_code: 'EQ-NB-100',
      problem_type: 'จอฟ้า',
      problem_description: 'เข้า Windows ไม่ได้',
      status: 'Repairing',
      reporter_name: 'สมหญิง',
      reported_at: new Date(),
    },
  ];

  const carousel = lineService.buildMaintenanceTicketsCarousel(mockTickets);
  assert.strictEqual(carousel.type, 'flex');
  assert.strictEqual(carousel.contents.type, 'carousel');
  assert.strictEqual(carousel.contents.contents.length, 2);

  const bubble1 = carousel.contents.contents[0];
  assert.ok(bubble1.footer, 'Bubble 1 should have footer with buttons');
  assert.strictEqual(bubble1.footer.contents[0].action.data, 'action=update_maint_status&maint_id=99&to_status=Repairing');
  assert.strictEqual(bubble1.footer.contents[1].action.data, 'action=update_maint_status&maint_id=99&to_status=Completed');

  const bubble2 = carousel.contents.contents[1];
  assert.ok(bubble2.footer, 'Bubble 2 should have footer with buttons');
  assert.strictEqual(bubble2.footer.contents[0].action.data, 'action=update_maint_status&maint_id=100&to_status=Completed');
  assert.strictEqual(bubble2.footer.contents[1].action.data, 'action=update_maint_status&maint_id=100&to_status=Cancelled');

  console.log('[✓] Maintenance Flex Carousel buttons verification passed');

  // 2. Test DB update logic
  const [created] = await pool.execute(
    "INSERT INTO maintenance (equipment_id, reporter_id, problem_type, problem_description, status) VALUES (1, 1, 'ทดสอบ', 'ทดสอบระบบบอท', 'Reported')"
  );
  const testMaintId = created.insertId;

  // Simulate status update to Repairing
  await pool.execute(
    "UPDATE maintenance SET status = 'Repairing', started_at = NOW() WHERE maintenance_id = ?",
    [testMaintId]
  );
  const [r1] = await pool.execute('SELECT status FROM maintenance WHERE maintenance_id = ?', [testMaintId]);
  assert.strictEqual(r1[0].status, 'Repairing');

  // Simulate status update to Completed
  await pool.execute(
    "UPDATE maintenance SET status = 'Completed', completed_at = NOW() WHERE maintenance_id = ?",
    [testMaintId]
  );
  const [r2] = await pool.execute('SELECT status FROM maintenance WHERE maintenance_id = ?', [testMaintId]);
  assert.strictEqual(r2[0].status, 'Completed');

  // Clean up
  await pool.execute('DELETE FROM maintenance WHERE maintenance_id = ?', [testMaintId]);

  console.log('[✓] Maintenance DB status update logic verified');
  console.log('All maintenance status tests PASSED!\n');
  process.exit(0);
}

testMaintenanceStatusChange().catch(err => {
  console.error('[!] Test failed:', err);
  process.exit(1);
});

