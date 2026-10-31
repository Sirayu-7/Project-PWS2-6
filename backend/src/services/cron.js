const pool = require('../db');
const lineService = require('./line');
const { emitToAll } = require('./realtime');

let cronTimer = null;
let lastScannedDate = null;

async function runDailyScan(options = {}) {
  const todayStr = new Date().toISOString().slice(0, 10);
  if (!options.force && lastScannedDate === todayStr) {
    console.log(`[CRON] Daily scan already completed for today (${todayStr}). Skipping.`);
    return { skipped: true, dueTodayCount: 0, overdueCount: 0 };
  }

  console.log('[CRON] Running daily loan scan (due today & overdue)...');
  let dueTodayCount = 0;
  let overdueCount = 0;

  try {
    // 1. Scan loans due today
    const [dueTodayLoans] = await pool.execute(`
      SELECT l.*, e.equipment_name, e.asset_code, u.name AS borrower_name, u.line_user_id
      FROM loans l
      JOIN equipment e ON e.equipment_id = l.equipment_id
      JOIN users u ON u.user_id = l.borrower_id
      WHERE l.status = 'Borrowed' AND DATE(l.due_date) = CURDATE()
    `);

    dueTodayCount = dueTodayLoans.length;
    for (const loan of dueTodayLoans) {
      if (loan.line_user_id) {
        await lineService.sendPush(loan.line_user_id, {
          type: 'text',
          text: `🔔 แจ้งเตือนครบกำหนดคืนอุปกรณ์วันนี้!\n\nรายการ #${loan.loan_id}: ${loan.equipment_name} (${loan.asset_code})\nกรุณานำส่งคืนที่ห้องไอทีภายในเวลาทำการครับ`,
        });
      }
    }

    // 2. Scan loans that have passed due date -> update to 'Overdue'
    const [overdueLoans] = await pool.execute(`
      SELECT l.*, e.equipment_name, e.asset_code, u.name AS borrower_name, u.line_user_id
      FROM loans l
      JOIN equipment e ON e.equipment_id = l.equipment_id
      JOIN users u ON u.user_id = l.borrower_id
      WHERE l.status = 'Borrowed' AND l.due_date < CURDATE()
    `);

    overdueCount = overdueLoans.length;
    for (const loan of overdueLoans) {
      await pool.execute("UPDATE loans SET status = 'Overdue' WHERE loan_id = ?", [loan.loan_id]);

      const overdueCard = lineService.buildOverdueCard(loan);

      // Notify borrower
      if (loan.line_user_id) {
        await lineService.sendPush(loan.line_user_id, overdueCard);
      }

      // Notify staff channel
      await lineService.sendToStaffChannel(overdueCard);
    }

    if (overdueCount > 0) {
      emitToAll('data:refresh', { source: '/api/loan', method: 'CRON_OVERDUE' });
    }

    console.log(`[CRON] Daily scan complete: ${dueTodayCount} due today, ${overdueCount} marked overdue.`);
    lastScannedDate = todayStr;
  } catch (e) {
    console.error('[CRON_SCAN_ERROR]:', e.message);
  }

  return { skipped: false, dueTodayCount, overdueCount };
}

function startCron() {
  if (cronTimer) clearInterval(cronTimer);
  // Run scan once on start, then repeat every 1 hour
  runDailyScan().catch(() => {});
  cronTimer = setInterval(runDailyScan, 60 * 60 * 1000);
}

function stopCron() {
  if (cronTimer) {
    clearInterval(cronTimer);
    cronTimer = null;
  }
}

module.exports = {
  runDailyScan,
  startCron,
  stopCron,
};

