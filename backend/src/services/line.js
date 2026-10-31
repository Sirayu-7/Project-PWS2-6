const line = require('@line/bot-sdk');
const pool = require('../db');

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  channelSecret: process.env.LINE_CHANNEL_SECRET || '',
};

let client = null;
if (config.channelAccessToken) {
  try {
    client = new line.messagingApi.MessagingApiClient({
      channelAccessToken: config.channelAccessToken,
    });
  } catch (e) {
    console.error('[LINE_INIT_ERROR]:', e.message);
  }
}

// Safe push wrapper
async function sendPush(lineUserId, messageOrMessages) {
  if (!client || !lineUserId) return null;
  const messages = Array.isArray(messageOrMessages) ? messageOrMessages : [messageOrMessages];
  try {
    return await client.pushMessage({
      to: lineUserId,
      messages,
    });
  } catch (e) {
    console.error(`[LINE_PUSH_ERROR to ${lineUserId}]:`, e.message);
    return null;
  }
}

// Safe reply wrapper
async function replyMessage(replyToken, messageOrMessages) {
  if (!client || !replyToken) return null;
  const messages = Array.isArray(messageOrMessages) ? messageOrMessages : [messageOrMessages];
  try {
    return await client.replyMessage({
      replyToken,
      messages,
    });
  } catch (e) {
    console.error('[LINE_REPLY_ERROR]:', e.message);
    return null;
  }
}

// Send to staff group or individual linked staff accounts
async function sendToStaffChannel(messageOrMessages) {
  const staffGroup = process.env.LINE_STAFF_GROUP_ID;
  if (staffGroup) {
    return await sendPush(staffGroup, messageOrMessages);
  }

  // Fallback: send to all linked Admins and Staff
  try {
    const [rows] = await pool.execute(`
      SELECT u.line_user_id 
      FROM users u 
      JOIN roles r ON r.role_id = u.role_id 
      WHERE u.status = 'Active' 
        AND r.role_name IN ('Administrator', 'Staff') 
        AND u.line_user_id IS NOT NULL
    `);
    if (!rows.length) return null;
    return await Promise.all(rows.map(u => sendPush(u.line_user_id, messageOrMessages)));
  } catch (e) {
    console.error('[LINE_STAFF_BROADCAST_ERROR]:', e.message);
    return null;
  }
}

// ---------------- Flex Builders ----------------

function buildLoanRequestCard(loan) {
  return {
    type: 'flex',
    altText: `📋 มีคำขอยืมอุปกรณ์ใหม่ (#${loan.loan_id})`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#2563eb',
        paddingAll: '16px',
        contents: [
          {
            type: 'text',
            text: '📋 มีคำขอยืมอุปกรณ์ใหม่',
            weight: 'bold',
            color: '#ffffff',
            size: 'md',
          },
          {
            type: 'text',
            text: `รายการคำขอ #${loan.loan_id}`,
            color: '#bfdbfe',
            size: 'xs',
            margin: 'xs',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '16px',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'อุปกรณ์:', size: 'xs', color: '#64748b', flex: 2 },
              { type: 'text', text: `${loan.equipment_name || '-'}`, size: 'xs', weight: 'bold', color: '#1e293b', flex: 4, wrap: true },
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'รหัสครุภัณฑ์:', size: 'xs', color: '#64748b', flex: 2 },
              { type: 'text', text: `${loan.asset_code || '-'}`, size: 'xs', color: '#1e293b', flex: 4 },
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'ผู้ขอยืม:', size: 'xs', color: '#64748b', flex: 2 },
              { type: 'text', text: `${loan.borrower_name || '-'}`, size: 'xs', color: '#1e293b', flex: 4 },
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'กำหนดคืน:', size: 'xs', color: '#64748b', flex: 2 },
              { type: 'text', text: `${loan.due_date ? String(loan.due_date).slice(0, 10) : '-'}`, size: 'xs', weight: 'bold', color: '#2563eb', flex: 4 },
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'วัตถุประสงค์:', size: 'xs', color: '#64748b', flex: 2 },
              { type: 'text', text: `${loan.purpose || '-'}`, size: 'xs', color: '#64748b', flex: 4, wrap: true },
            ],
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'horizontal',
        spacing: 'md',
        paddingAll: '14px',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#16a34a',
            height: 'sm',
            action: {
              type: 'postback',
              label: 'อนุมัติ',
              data: `action=approve_loan&loan_id=${loan.loan_id}`,
              displayText: `อนุมัติคำขอยืม #${loan.loan_id}`,
            },
          },
          {
            type: 'button',
            style: 'primary',
            color: '#dc2626',
            height: 'sm',
            action: {
              type: 'postback',
              label: 'ปฏิเสธ',
              data: `action=reject_loan_init&loan_id=${loan.loan_id}`,
              displayText: `ปฏิเสธคำขอยืม #${loan.loan_id}`,
            },
          },
        ],
      },
    },
  };
}

function buildLoanDecisionCard(loan, isApproved, approverName, remark) {
  const bgColor = isApproved ? '#16a34a' : '#dc2626';
  const title = isApproved ? '✅ คำขอยืมได้รับการอนุมัติ' : '❌ คำขอยืมไม่ได้รับการอนุมัติ';
  const statusBadge = isApproved ? 'อนุมัติแล้ว (กำลังยืม)' : 'ไม่อนุมัติ';

  const bodyContents = [
    {
      type: 'box',
      layout: 'horizontal',
      contents: [
        { type: 'text', text: 'รายการ:', size: 'xs', color: '#64748b', flex: 2 },
        { type: 'text', text: `#${loan.loan_id} (${loan.equipment_name || '-'})`, size: 'xs', weight: 'bold', flex: 4, wrap: true },
      ],
    },
    {
      type: 'box',
      layout: 'horizontal',
      contents: [
        { type: 'text', text: 'สถานะ:', size: 'xs', color: '#64748b', flex: 2 },
        { type: 'text', text: statusBadge, size: 'xs', weight: 'bold', color: bgColor, flex: 4 },
      ],
    },
    {
      type: 'box',
      layout: 'horizontal',
      contents: [
        { type: 'text', text: 'ผู้ดำเนินการ:', size: 'xs', color: '#64748b', flex: 2 },
        { type: 'text', text: `${approverName || 'เจ้าหน้าที่ IT'}`, size: 'xs', flex: 4 },
      ],
    },
  ];

  if (!isApproved && remark) {
    bodyContents.push({
      type: 'box',
      layout: 'horizontal',
      contents: [
        { type: 'text', text: 'เหตุผล:', size: 'xs', color: '#dc2626', flex: 2 },
        { type: 'text', text: remark, size: 'xs', color: '#dc2626', flex: 4, wrap: true },
      ],
    });
  }

  if (isApproved && loan.due_date) {
    bodyContents.push({
      type: 'box',
      layout: 'horizontal',
      contents: [
        { type: 'text', text: 'กำหนดคืน:', size: 'xs', color: '#64748b', flex: 2 },
        { type: 'text', text: String(loan.due_date).slice(0, 10), size: 'xs', weight: 'bold', color: '#2563eb', flex: 4 },
      ],
    });
  }

  return {
    type: 'flex',
    altText: `${title} (#${loan.loan_id})`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: bgColor,
        paddingAll: '16px',
        contents: [
          { type: 'text', text: title, weight: 'bold', color: '#ffffff', size: 'md' },
          { type: 'text', text: `รายการคำขอ #${loan.loan_id}`, color: '#f1f5f9', size: 'xs', margin: 'xs' },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '16px',
        contents: bodyContents,
      },
    },
  };
}

function buildOverdueCard(loan) {
  return {
    type: 'flex',
    altText: `⚠️ อุปกรณ์เกินกำหนดส่งคืน (#${loan.loan_id})`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#dc2626',
        paddingAll: '16px',
        contents: [
          { type: 'text', text: '⚠️ อุปกรณ์เกินกำหนดส่งคืน', weight: 'bold', color: '#ffffff', size: 'md' },
          { type: 'text', text: `รายการยืม #${loan.loan_id}`, color: '#fee2e2', size: 'xs', margin: 'xs' },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '16px',
        contents: [
          {
            type: 'text',
            text: 'กรุณานำอุปกรณ์มาส่งคืนที่ห้องไอทีโดยเร็วที่สุด',
            size: 'xs',
            weight: 'bold',
            color: '#b91c1c',
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'อุปกรณ์:', size: 'xs', color: '#64748b', flex: 2 },
              { type: 'text', text: `${loan.equipment_name || '-'}`, size: 'xs', weight: 'bold', flex: 4 },
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'กำหนดคืนเดิม:', size: 'xs', color: '#64748b', flex: 2 },
              { type: 'text', text: `${loan.due_date ? String(loan.due_date).slice(0, 10) : '-'}`, size: 'xs', color: '#dc2626', flex: 4 },
            ],
          },
        ],
      },
    },
  };
}

function buildMaintenanceCard(ticket) {
  return {
    type: 'flex',
    altText: `⚒ มีรายการแจ้งซ่อมใหม่ (#${ticket.maintenance_id})`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#d97706',
        paddingAll: '16px',
        contents: [
          { type: 'text', text: '⚒ มีรายการแจ้งซ่อมอุปกรณ์', weight: 'bold', color: '#ffffff', size: 'md' },
          { type: 'text', text: `ใบแจ้งซ่อม #${ticket.maintenance_id}`, color: '#fef3c7', size: 'xs', margin: 'xs' },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '16px',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'อุปกรณ์:', size: 'xs', color: '#64748b', flex: 2 },
              { type: 'text', text: `${ticket.equipment_name || '-'}`, size: 'xs', weight: 'bold', flex: 4 },
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'อาการเสีย:', size: 'xs', color: '#64748b', flex: 2 },
              { type: 'text', text: `${ticket.problem_description || ticket.issue_description || '-'}`, size: 'xs', flex: 4, wrap: true },
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'ความเร่งด่วน:', size: 'xs', color: '#64748b', flex: 2 },
              { type: 'text', text: `${ticket.priority || 'Normal'}`, size: 'xs', weight: 'bold', flex: 4 },
            ],
          },
        ],
      },
    },
  };
}

function buildUserLoansCarousel(loans) {
  if (!loans || !loans.length) {
    return {
      type: 'text',
      text: 'คุณไม่มีรายการอุปกรณ์ที่กำลังยืมอยู่ในขณะนี้',
    };
  }

  const bubbles = loans.slice(0, 10).map((l) => {
    const isOverdue = l.status === 'Overdue';
    const statusColor = isOverdue ? '#dc2626' : (l.status === 'Borrowed' ? '#16a34a' : '#d97706');
    const statusText = isOverdue ? 'เกินกำหนดคืน' : (l.status === 'Borrowed' ? 'กำลังยืม' : 'รออนุมัติ');

    return {
      type: 'bubble',
      size: 'kilo',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#1e293b',
        paddingAll: '12px',
        contents: [
          { type: 'text', text: l.equipment_name || 'อุปกรณ์', weight: 'bold', color: '#ffffff', size: 'sm', wrap: true },
          { type: 'text', text: l.asset_code || '-', color: '#94a3b8', size: 'xxs' },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'xs',
        paddingAll: '12px',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'สถานะ:', size: 'xxs', color: '#64748b', flex: 2 },
              { type: 'text', text: statusText, size: 'xxs', weight: 'bold', color: statusColor, flex: 3 },
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'กำหนดคืน:', size: 'xxs', color: '#64748b', flex: 2 },
              { type: 'text', text: l.due_date ? String(l.due_date).slice(0, 10) : '-', size: 'xxs', weight: 'bold', flex: 3 },
            ],
          },
        ],
      },
    };
  });

  return {
    type: 'flex',
    altText: `📋 รายการยืมอุปกรณ์ของคุณ (${loans.length} รายการ)`,
    contents: {
      type: 'carousel',
      contents: bubbles,
    },
  };
}

async function notifyNewLoanRequest(loanId) {
  try {
    const [rows] = await pool.execute(`
      SELECT l.*, e.equipment_name, e.asset_code, u.name AS borrower_name
      FROM loans l
      JOIN equipment e ON e.equipment_id = l.equipment_id
      JOIN users u ON u.user_id = l.borrower_id
      WHERE l.loan_id = ?
    `, [loanId]);
    if (!rows.length) return null;
    const card = buildLoanRequestCard(rows[0]);
    return await sendToStaffChannel(card);
  } catch (e) {
    console.error('[LINE_NOTIFY_LOAN_ERROR]:', e.message);
    return null;
  }
}

async function notifyLoanDecision(loanId, isApproved, approverName, remark) {
  try {
    const [rows] = await pool.execute(`
      SELECT l.*, e.equipment_name, b.line_user_id AS borrower_line_id
      FROM loans l
      JOIN equipment e ON e.equipment_id = l.equipment_id
      JOIN users b ON b.user_id = l.borrower_id
      WHERE l.loan_id = ?
    `, [loanId]);
    if (!rows.length || !rows[0].borrower_line_id) return null;
    const card = buildLoanDecisionCard(rows[0], isApproved, approverName, remark);
    return await sendPush(rows[0].borrower_line_id, card);
  } catch (e) {
    console.error('[LINE_NOTIFY_DECISION_ERROR]:', e.message);
    return null;
  }
}

async function notifyMaintenanceTicket(maintenanceId) {
  try {
    const [rows] = await pool.execute(`
      SELECT m.*, e.equipment_name, e.asset_code, u.name AS reporter_name
      FROM maintenance m
      JOIN equipment e ON e.equipment_id = m.equipment_id
      JOIN users u ON u.user_id = m.reported_by
      WHERE m.maintenance_id = ?
    `, [maintenanceId]);
    if (!rows.length) return null;
    const card = buildMaintenanceCard(rows[0]);
    return await sendToStaffChannel(card);
  } catch (e) {
    console.error('[LINE_NOTIFY_MAINT_ERROR]:', e.message);
    return null;
  }
}

module.exports = {
  sendPush,
  replyMessage,
  sendToStaffChannel,
  buildLoanRequestCard,
  buildLoanDecisionCard,
  buildOverdueCard,
  buildMaintenanceCard,
  buildUserLoansCarousel,
  notifyNewLoanRequest,
  notifyLoanDecision,
  notifyMaintenanceTicket,
};
