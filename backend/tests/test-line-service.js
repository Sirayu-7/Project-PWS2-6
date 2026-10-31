const assert = require('assert');
const lineService = require('../src/services/line');

console.log('[*] Testing lineService Flex builders...');

// 1. Test buildLoanRequestCard
const mockLoan = {
  loan_id: 15,
  equipment_name: 'Dell Latitude 3420',
  asset_code: 'EQ-001',
  borrower_name: 'สมชาย ใจดี',
  request_date: '2026-10-31',
  due_date: '2026-11-05',
  purpose: 'จัดอบรมนักศึกษา'
};

const reqCard = lineService.buildLoanRequestCard(mockLoan);
assert.strictEqual(reqCard.type, 'flex');
assert.ok(reqCard.altText.includes('15'));
assert.strictEqual(reqCard.contents.type, 'bubble');

// Check postback actions in footer
const footerButtons = reqCard.contents.footer.contents;
const approveBtn = footerButtons.find(b => b.action && b.action.data.includes('action=approve_loan&loan_id=15'));
const rejectBtn = footerButtons.find(b => b.action && b.action.data.includes('action=reject_loan_init&loan_id=15'));
assert.ok(approveBtn, 'Should have Approve postback button');
assert.ok(rejectBtn, 'Should have Reject postback button');
console.log('[✓] buildLoanRequestCard test passed');

// 2. Test buildLoanDecisionCard (Approved)
const approveCard = lineService.buildLoanDecisionCard(mockLoan, true, 'เจ้าหน้าที่ IT');
assert.strictEqual(approveCard.type, 'flex');
assert.ok(approveCard.altText.includes('อนุมัติ'));
console.log('[✓] buildLoanDecisionCard (Approved) test passed');

// 3. Test buildLoanDecisionCard (Rejected)
const rejectCard = lineService.buildLoanDecisionCard(mockLoan, false, 'เจ้าหน้าที่ IT', 'อุปกรณ์ติดซ่อมด่วน');
assert.strictEqual(rejectCard.type, 'flex');
assert.ok(rejectCard.altText.includes('ไม่ได้รับการอนุมัติ'));
console.log('[✓] buildLoanDecisionCard (Rejected) test passed');

// 4. Test buildUserLoansCarousel
const emptyLoansMsg = lineService.buildUserLoansCarousel([]);
assert.strictEqual(emptyLoansMsg.type, 'text');

const loansCarousel = lineService.buildUserLoansCarousel([
  { loan_id: 1, equipment_name: 'MacBook Air M2', asset_code: 'EQ-002', status: 'Borrowed', due_date: '2026-11-05' },
  { loan_id: 2, equipment_name: 'Projector Epson', asset_code: 'EQ-003', status: 'Pending', due_date: '2026-11-02' }
]);
assert.strictEqual(loansCarousel.type, 'flex');
assert.strictEqual(loansCarousel.contents.type, 'carousel');
assert.strictEqual(loansCarousel.contents.contents.length, 2);
console.log('[✓] buildUserLoansCarousel test passed');

console.log('\nAll lineService unit tests PASSED successfully!');
