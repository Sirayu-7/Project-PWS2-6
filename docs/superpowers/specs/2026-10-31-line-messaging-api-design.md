# Design Document: LINE Messaging API Integration (Interactive Bot + Flex Actions)

## 1. Intent & Context

### 1.1 Intent & The "Why"
The current IT Equipment Management System handles equipment registration, loan-return workflows, maintenance tracking, and user management with an in-app notification system (MySQL + SSE/WebSocket). However, staff and borrowers rely on opening the web browser to discover pending requests, status updates, or overdue equipment. 

Integrating the LINE Messaging API via an **Interactive Bot with Flex Message Actions (Approach 2)** enables:
- Instant real-time alerts directly on users' mobile phones where they already communicate.
- Quick staff actions (approving or rejecting loans) with a single tap inside LINE without needing to log in to the web console on mobile.
- Self-service inquiries for borrowers (checking current loan statuses and browsing available equipment) directly via chat commands and quick replies.

### 1.2 User Personas & Scenarios
1. **Borrower (Student / Staff member)**:
   - Links their system account to LINE via a 6-digit PIN generated in their web profile.
   - Receives instant notifications when their loan request is approved or rejected.
   - Receives automated reminders on the day of return and overdue warnings.
   - Inquires about their current borrowed items by texting "รายการยืมของฉัน" to the bot.
2. **Staff / Administrator**:
   - Links their account to LINE and/or belongs to a staff LINE notification group.
   - Receives interactive Flex Message cards when a new loan or repair ticket is submitted.
   - Taps "อนุมัติ" (Approve) or "ปฏิเสธ" (Reject) directly from the Flex Message card.
3. **Automated Scheduler**:
   - Daily cron job scanning for impending returns and overdue loans, dispatching LINE push messages.

---

## 2. Goals, Non-Goals, and Anti-Goals

### 2.1 Goals
- **Account Linking**: Provide a frictionless 6-digit PIN linking flow between web users (`users` table) and LINE accounts (`line_user_id`).
- **Rich Notifications**: Dispatch responsive, clear LINE Flex Messages for all key workflow events:
  - Loan request created (sent to Staff).
  - Loan approved / rejected (sent to Borrower).
  - Equipment returned & inspection status (sent to Borrower).
  - Maintenance ticket created / status updated (sent to Staff & Reporter).
  - Due date reminder & Overdue alert (sent to Borrower).
- **Two-way Interactive Bot**:
  - Secure webhook endpoint (`POST /api/line/webhook`) with HMAC-SHA256 signature verification.
  - Interactive commands: "รายการยืมของฉัน", "อุปกรณ์ว่าง", "ช่วยเหลือ / เมนู".
- **Interactive Postback Actions**:
  - Staff can approve / reject loan requests directly from LINE with full RBAC authentication and audit logging.
- **Resilience & Fallback**:
  - System operations on the web continue uninterrupted if LINE API is unreachable or fails (non-blocking notification delivery).

### 2.2 Non-Goals
- Full LINE Login (LIFF OAuth) for initial scope; web application continues to use existing JWT authentication.
- Creating loan requests or maintenance tickets entirely through freeform conversational AI (NLP); complex forms remain on the web application.
- Supporting rich multimedia uploads (voice messages, location pins) beyond standard text and structured postbacks.

### 2.3 Anti-Goals
- Never bypass role-based access control (RBAC). A user tapping an "Approve" button in LINE must have their `line_user_id` verified against `users` and `roles` to ensure `Staff` or `Administrator` privilege.
- Never crash or block web API endpoints if the external LINE platform experiences network latency or rate limits.

---

## 3. Constraints & Technical Foundations

1. **Backend Environment**:
   - Node.js & Express.js (`backend/src/server.js`).
   - Database: MySQL / MariaDB via `mysql2/promise`.
   - Existing real-time infrastructure: Server-Sent Events (`backend/src/services/realtime.js`) and notification dispatcher (`backend/src/services/notification.js`).
2. **LINE Platform Requirements**:
   - Channel Access Token (long-lived) and Channel Secret from LINE Developers Console.
   - Webhook URL requires a valid HTTPS public endpoint (e.g., ngrok / Cloudflare Tunnel during local development; production domain in deployment).
   - LINE webhook signature validation requires access to the raw HTTP request body prior to standard JSON parsing.
3. **Package Dependencies**:
   - `@line/bot-sdk` (official SDK for webhook parsing, message construction, and client API calls).

---

## 4. Architectural Approaches Considered

### Approach 1: One-Way Event Push Only
- Pros: Simple to implement, no public webhook required.
- Cons: Misses interactive mobile capabilities (no staff approval buttons, no self-service chat).
- Status: Rejected in favor of Approach 2.

### Approach 2: Interactive Bot + Flex Actions (Selected)
- Pros: Seamless mobile workflow, quick approval buttons for staff, self-service queries for borrowers, scalable architecture.
- Cons: Requires public HTTPS webhook endpoint and secure postback verification.
- Status: **Adopted**.

### Approach 3: Full LIFF Integration (Embedded Web App)
- Pros: Full web app inside LINE.
- Cons: Significant frontend routing and auth refactoring required.
- Status: Deferred for future phases.

---

## 5. Detailed Design & Architecture

```
+-----------------------------------------------------------------------------------+
|                                  LINE PLATFORM                                    |
+-----------------------------------------------------------------------------------+
           |                                                       ^
           | 1. Webhook Events                                     | 2. Push & Reply
           |    (message, postback, follow)                        |    (Flex Messages)
           v                                                       |
+-----------------------------------------------------------------------------------+
|                              EXPRESS BACKEND                                      |
|                                                                                   |
|  [ /api/line/webhook ]                                                            |
|    |--> Middleware: Validate Signature (HMAC-SHA256 via LINE Channel Secret)      |
|    |--> Event Router:                                                             |
|          |-- 'follow': Send welcome message with linking guidance                 |
|          |-- 'message': Handle 6-digit PIN linking & keyword queries              |
|          |-- 'postback': Handle Staff Actions (Approve/Reject Loan)               |
|                                                                                   |
|  [ /api/line/link-token ] (Authenticated Web API)                                  |
|    |--> Generates 6-digit PIN linked to req.user.userId, 10-minute TTL            |
|                                                                                   |
|  [ Services: lineService.js ]                                                     |
|    |--> notifyNewLoanRequest(loanId)                                              |
|    |--> notifyLoanDecision(loanId, action, approverName, remark)                  |
|    |--> notifyOverdueAlert(loanId)                                                |
|    |--> notifyMaintenanceTicket(maintenanceId)                                    |
|    |--> sendPush(lineUserId, flexContent)                                         |
|    |--> sendToStaffChannel(flexContent) (sends to group or linked staff DMs)      |
|                                                                                   |
|  [ Domain Routes & Cron ]                                                         |
|    |--> loans.js / maintenance.js: invoke lineService domain helpers              |
|    |--> cron.js: scans due_date and invokes lineService alerts                    |
|    |--> notification.js: remains dedicated to web in-app notifications            |
+-----------------------------------------------------------------------------------+
           |                                                       |
           v                                                       v
+-----------------------+                               +---------------------------+
|     MySQL DATABASE    |                               |    VUE 3 FRONTEND         |
|  - users.line_user_id |                               |  - ProfileView.vue:       |
|  - line_link_tokens   |                               |    "เชื่อมต่อ LINE" Modal  |
|  - audit_logs         |                               |    Displays 6-digit PIN   |
+-----------------------+                               +---------------------------+
```

---

## 6. Database Schema Updates

### 6.1 Alter `users` Table
```sql
ALTER TABLE `users` 
ADD COLUMN `line_user_id` VARCHAR(50) DEFAULT NULL AFTER `status`,
ADD UNIQUE KEY `idx_users_line_user_id` (`line_user_id`);
```

### 6.2 New Table: `line_link_tokens`
```sql
CREATE TABLE `line_link_tokens` (
  `token_id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `pin_code` varchar(6) NOT NULL,
  `expires_at` datetime NOT NULL,
  `is_used` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`token_id`),
  KEY `idx_pin_lookup` (`pin_code`, `is_used`, `expires_at`),
  CONSTRAINT `fk_line_token_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 6.3 New Table: `line_conversation_states`
```sql
CREATE TABLE `line_conversation_states` (
  `state_id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `state_action` varchar(50) NOT NULL, -- e.g. 'AWAITING_REJECT_REASON'
  `payload` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`payload`)),
  `expires_at` datetime NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`state_id`),
  UNIQUE KEY `idx_user_state` (`user_id`),
  CONSTRAINT `fk_line_state_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 7. Account Linking Specification (6-Digit PIN Flow)

1. **Step 1 (Web)**: Logged-in user navigates to Profile (`/profile`). Clicks **"เชื่อมต่อ LINE"**.
2. **Step 2 (Backend)**: Web calls `POST /api/line/link-token`.
   - Backend invalidates any previous unused tokens for this user.
   - Generates a random 6-digit numeric PIN (e.g., `482910`), sets `expires_at = NOW() + INTERVAL 10 MINUTE`, saves to `line_link_tokens`.
   - Returns `{ pin_code: '482910', expires_in: 600, qr_url: '...' }`.
3. **Step 3 (LINE)**: User adds the LINE Official Account and types `482910` in the chat.
4. **Step 4 (Webhook)**:
   - Webhook checks `line_link_tokens` for an active matching `pin_code`.
   - If found:
     - Updates `users.line_user_id = event.source.userId`.
     - Marks token `is_used = 1`.
     - Logs `AUDIT_LOG: LINK_LINE_ACCOUNT`.
     - Replies with a welcoming Flex Card: "✅ ผูกบัญชีสำเร็จ: คุณ [ชื่อ-นามสกุล] (สิทธิ์: [Role])".
     - Emits `line:linked` event via `realtime.js` so the user's open web profile instantly reflects the linked status.
   - If invalid/expired:
     - Replies: "❌ รหัสยืนยันไม่ถูกต้องหรือหมดอายุแล้ว กรุณากดขอรหัสใหม่จากหน้าโปรไฟล์บนเว็บ".

---

## 8. Interactive Actions & Postback Protocol

### 8.1 Postback Payload Format
For Staff actions from Flex Message buttons:
```
action=approve_loan&loan_id=15
action=reject_loan_init&loan_id=15
```

### 8.2 Security & RBAC Guard
When a `postback` arrives at `/api/line/webhook`:
1. Look up `user` by `line_user_id = event.source.userId`.
2. If user is not found or `user.status != 'Active'`, reply: "⚠️ คุณยังไม่ได้ผูกบัญชีกับระบบ กรุณาเข้าสู่ระบบผ่านเว็บเพื่อเชื่อมต่อบัญชี".
3. Verify role: `role_name IN ('Administrator', 'Staff')`. If failed, reply: "⛔ คุณไม่มีสิทธิ์ดำเนินการอนุมัติ/ปฏิเสธคำขอนี้".
4. Transactionally process the loan action:
   - Verify loan is still `Pending`. If already processed, reply: "ℹ️ รายการนี้ได้รับการดำเนินการไปแล้ว".
   - **If action is `approve_loan`**:
     - Update loan `status = 'Borrowed'`, `borrow_date = NOW()`, `approved_by = user.user_id`, `approved_at = NOW()`.
     - Update equipment `status = 'Borrowed'`.
     - Insert `audit_logs` record (`APPROVE_LOAN`).
     - Push update to borrower via LINE: "🎉 คำขอยืมอุปกรณ์ #15 ของคุณได้รับการอนุมัติแล้ว".
     - Reply to Staff / Staff Group with updated status Flex Card.
     - Emit SSE `data:refresh` for web clients.
   - **If action is `reject_loan_init` (Conversational Reason Prompt)**:
     - Save pending conversation state in `line_conversation_states`:
       - `user_id = user.user_id`
       - `state_action = 'AWAITING_REJECT_REASON'`
       - `payload = JSON({ loan_id: 15, equipment_id: loan.equipment_id, borrower_id: loan.borrower_id })`
       - `expires_at = NOW() + INTERVAL 5 MINUTE`
     - Reply to staff member: "📝 กรุณาพิมพ์ระบุเหตุผลการไม่อนุมัติคำขอยืม #15 ส่งกลับมาในแชทนี้ (หรือพิมพ์ 'ยกเลิก' เพื่อย้อนกลับ)".

### 8.3 Completing Rejection via Conversational Message
When the staff member replies with text:
1. Check `line_conversation_states` for active `user_id` where `state_action = 'AWAITING_REJECT_REASON'` and `expires_at > NOW()`.
2. If text is `'ยกเลิก'` (Cancel):
   - Delete state from `line_conversation_states`.
   - Reply: "ยกเลิกการปฏิเสธคำขอเรียบร้อยแล้ว คำขอยังคงอยู่ในสถานะรออนุมัติ".
3. Otherwise (Staff provided rejection reason):
   - Extract `loan_id` from payload.
   - Update loan: `UPDATE loans SET status = 'Rejected', remark = ?, approved_by = ?, approved_at = NOW() WHERE loan_id = ?` (using the typed text as remark).
   - Ensure equipment remains/returns to `Available`.
   - Delete state from `line_conversation_states`.
   - Insert `audit_logs` record (`REJECT_LOAN`).
   - Push update to borrower via LINE: "❌ คำขอยืมอุปกรณ์ #15 ของคุณไม่ได้รับการอนุมัติ\nเหตุผล: [ข้อความที่เจ้าหน้าที่ระบุ]".
   - Reply to Staff / Staff Group: "✅ ปฏิเสธคำขอยืม #15 เรียบร้อยแล้ว พร้อมส่งเหตุผลให้ผู้ยืมทราบ".
   - Emit SSE `data:refresh` for web clients.

---

## 9. Interactive Commands & Menu (Two-Way Chatbot)

When a user messages the bot, the webhook processes text events in the following priority:
1. **Active Conversation State Check**:
   - If user has pending `AWAITING_REJECT_REASON`, process as rejection remark (or cancel).
2. **Numeric PIN (6 digits)**:
   - Process account linking for web user.
3. **"รายการยืมของฉัน" / "ยืมอะไรอยู่"**:
   - Query user's active loans (`Pending`, `Borrowed`, `Overdue`).
   - If none: Reply "คุณไม่มีรายการอุปกรณ์ที่กำลังยืมอยู่".
   - If found: Return a horizontal Carousel of Flex Cards showing Equipment Name, Asset Code, Due Date, and Status badge.
4. **"อุปกรณ์ว่าง" / "เช็คอุปกรณ์"**:
   - Query available items (`status = 'Available'`) grouped by category.
   - Return Flex Message summary with count and quick link to web catalog.
5. **"ช่วยเหลือ" / "เมนู"**:
   - Reply with Quick Reply pills: `[ รายการยืมของฉัน ]`, `[ อุปกรณ์ว่าง ]`, `[ แจ้งปัญหา ]`, `[ สถานะบัญชี ]`.

---

## 10. Automated Scheduled Job (Reminders & Overdue)

Add a scheduled task running daily (e.g., at 08:30 AM):
- **Due Today Reminder**:
  - Finds loans where `status = 'Borrowed'` and `DATE(due_date) = CURDATE()`.
  - Sends polite Flex reminder to borrower: "🔔 ครบกำหนดคืนอุปกรณ์วันนี้ กรุณานำส่งคืนที่ห้องไอที".
- **Overdue Check**:
  - Finds loans where `status = 'Borrowed'` and `due_date < NOW()`.
  - Automatically updates `status = 'Overdue'`.
  - Sends alert Flex Message: "⚠️ อุปกรณ์เกินกำหนดส่งคืน กรุณาติดต่อเจ้าหน้าที่ทันที".
  - Notifies staff of overdue equipment.

---

## 11. Environment Configuration

Add to `backend/.env`:
```env
# LINE Messaging API Credentials
LINE_CHANNEL_ACCESS_TOKEN=your_channel_access_token_here
LINE_CHANNEL_SECRET=your_channel_secret_here
LINE_STAFF_GROUP_ID=           # Optional: LINE Group ID for staff broadcast
LINE_BOT_BASIC_ID=@yourbotid   # Used for LINE deep-links
```

---

## 12. What's Left to the Builder (Implementation Calls)

1. Choice between `@line/bot-sdk` built-in `middleware` vs manual HMAC signature verification helper (manual helper is recommended if mounting alongside `express.json` with `verify` hook).
2. UI styling and modal design for the "เชื่อมต่อ LINE" button in `ProfileView.vue`.
3. Flex Message visual color themes (using LINE Flex Message Simulator JSON structure aligned with system color palette: blue `#2563eb`, green `#16a34a`, amber `#d97706`, red `#dc2626`).
4. Automated cron execution mechanism (e.g., `node-cron` package or native `setInterval` check in backend).

