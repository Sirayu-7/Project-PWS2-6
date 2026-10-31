# LINE Messaging API Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate LINE Messaging API into the IT Equipment Management System, providing account linking via 6-digit PIN, real-time rich Flex Message notifications, two-way chatbot queries, staff loan approval/rejection actions, and automated due-date/overdue reminder cron jobs.

**Architecture:** Express.js backend receives LINE Webhook events at `/api/line/webhook` with HMAC-SHA256 signature verification. A dedicated `lineService` builds responsive Flex Message payloads and manages push/reply dispatching. Domain routes (`loans.js`, `maintenance.js`) and a daily scheduled cron task trigger notifications, while the Vue 3 frontend Profile modal provides a dedicated tab for PIN-based LINE account linking.

**Tech Stack:** Node.js, Express.js, `@line/bot-sdk`, MySQL / MariaDB (`mysql2/promise`), Vue 3, Vite, Pinia.

**Spec:** `docs/superpowers/specs/2026-10-31-line-messaging-api-design.md`

## Global Constraints

- Backend runs Node.js 18+ and Express.js on port 3000.
- Database is MariaDB/MySQL (`it_equipment_db`) using `mysql2/promise`.
- LINE webhook signature validation requires raw body buffer access before or during JSON parsing.
- Role-Based Access Control (RBAC) must strictly verify that only `Administrator` and `Staff` roles can approve or reject loans via LINE.
- Approved loans transition to `status = 'Borrowed'` and equipment `status = 'Borrowed'` in accordance with the existing database schema.
- Operations on the web must not fail or hang if LINE API calls fail (wrap calls in non-blocking try/catch error logging).

## Review Focus

1. **Webhook Signature Security**: An invalid or forged `X-Line-Signature` header must be rejected with 401/403 and must never execute any action.
2. **Expired or Used PIN Token**: Submitting an expired (>10 mins) or already used PIN in LINE must not link the account and must prompt the user with a friendly error.
3. **RBAC on Approval/Rejection Postback**: A non-staff or unlinked LINE user tapping an approval or rejection button must be denied with a clear permission notice.
4. **Loan State Conflicts**: Tapping "Approve" on a loan that has already been approved, rejected, or cancelled must gracefully inform the user without duplicate updates.
5. **Conversational Rejection Timeout**: If a staff member taps "Reject" but abandons the chat without entering a reason, the pending conversation state must expire safely after 5 minutes and allow subsequent interactions.

---

### Task 1: Database Migration & Environment Setup

**Files:**
- Create: `backend/scripts/migrate-line.js`
- Modify: `backend/.env`
- Modify: `backend/.env.example`
- Test: `backend/scripts/migrate-line.js`

**Interfaces:**
- Consumes: `backend/src/db.js`
- Produces: `users.line_user_id` column, `line_link_tokens` table, `line_conversation_states` table.

- [ ] **Step 1: Write database migration script**

Create `backend/scripts/migrate-line.js` that executes the schema updates safely:
1. Adds `line_user_id VARCHAR(50) DEFAULT NULL` and UNIQUE index `idx_users_line_user_id` to `users` if not exists.
2. Creates table `line_link_tokens` (`token_id`, `user_id`, `pin_code`, `expires_at`, `is_used`, `created_at`).
3. Creates table `line_conversation_states` (`state_id`, `user_id`, `state_action`, `payload`, `expires_at`, `created_at`).

- [ ] **Step 2: Run migration script**

Run: `node backend/scripts/migrate-line.js`
Expected: "Migration completed successfully: tables and columns ready."

- [ ] **Step 3: Update environment files**

Add `LINE_CHANNEL_ID`, `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_BOT_BASIC_ID`, and `LINE_STAFF_GROUP_ID` to `backend/.env` and `backend/.env.example`.

- [ ] **Step 4: Commit**

```bash
git add backend/scripts/migrate-line.js backend/.env.example
git commit -m "feat(line): add database migration and environment configuration for LINE integration"
```

---

### Task 2: Line Service Core & Flex Card Builders

**Files:**
- Create: `backend/src/services/line.js`
- Modify: `backend/package.json`
- Test: `backend/tests/test-line-service.js`

**Interfaces:**
- Consumes: `@line/bot-sdk`, `backend/src/db.js`
- Produces: 
  - `sendPush(lineUserId, flexOrText)`
  - `replyMessage(replyToken, flexOrText)`
  - `sendToStaffChannel(flexOrText)`
  - `buildLoanRequestCard(loan)`
  - `buildLoanDecisionCard(loan, isApproved, approverName, remark)`
  - `buildOverdueCard(loan)`
  - `buildMaintenanceCard(ticket)`
  - `buildUserLoansCarousel(loans)`

- [ ] **Step 1: Install `@line/bot-sdk` in backend**

Run: `cmd.exe /c "npm install @line/bot-sdk --prefix backend"`
Expected: package installed and added to `backend/package.json`.

- [ ] **Step 2: Write unit test for Flex builders**

Create `backend/tests/test-line-service.js` verifying that:
1. `buildLoanRequestCard` generates valid LINE Flex JSON containing loan details and Postback buttons (`action=approve_loan&loan_id=1` and `action=reject_loan_init&loan_id=1`).
2. `buildLoanDecisionCard` formats approval and rejection with correct color themes (`#16a34a` for approved, `#dc2626` for rejected).
3. `buildUserLoansCarousel` handles empty array and multi-item loan lists.

- [ ] **Step 3: Run test to verify it fails**

Run: `node backend/tests/test-line-service.js`
Expected: FAIL ("Cannot find module '../src/services/line'")

- [ ] **Step 4: Implement `backend/src/services/line.js`**

Implement LINE SDK client wrapper, messaging dispatch methods with error shielding, and Flex Message templates matching system branding.

- [ ] **Step 5: Run test to verify it passes**

Run: `node backend/tests/test-line-service.js`
Expected: All builder tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/line.js backend/tests/test-line-service.js backend/package.json
git commit -m "feat(line): implement core LINE messaging service and Flex card templates"
```

---

### Task 3: Account Linking API & Secure Webhook Infrastructure

**Files:**
- Create: `backend/src/routes/line.js`
- Modify: `backend/src/server.js:4-10`
- Test: `backend/tests/test-line-webhook.js`

**Interfaces:**
- Consumes: `backend/src/services/line.js`, `backend/src/middleware/auth.js`
- Produces: 
  - `POST /api/line/link-token` (Generates 6-digit PIN with 10-minute expiry)
  - `GET /api/line/status` (Returns link status for logged-in user)
  - `POST /api/line/unlink` (Unlinks user's LINE account)
  - `POST /api/line/webhook` (Public webhook for LINE event handling with HMAC-SHA256 verification)

- [ ] **Step 1: Write failing integration test for linking and webhook**

Create `backend/tests/test-line-webhook.js` testing:
1. Calling `/api/line/link-token` produces a 6-digit numeric PIN in `line_link_tokens`.
2. Sending a webhook event with invalid `x-line-signature` returns 401 Unauthorized.
3. Sending a valid signed message event containing the 6-digit PIN links the user and sets `users.line_user_id`.
4. Sending an expired or non-existent PIN returns an informative warning reply.

- [ ] **Step 2: Run test to verify it fails**

Run: `node backend/tests/test-line-webhook.js`
Expected: FAIL (Endpoints not found)

- [ ] **Step 3: Configure raw body capture in `backend/src/server.js`**

Update `express.json()` in `backend/src/server.js` to capture `req.rawBody = buf` for signature verification. Mount `/api/line` routes.

- [ ] **Step 4: Implement `backend/src/routes/line.js`**

Implement PIN generation, link status, unlinking endpoints, and the webhook route with signature verification (`validateSignature` via HMAC-SHA256).

- [ ] **Step 5: Run test to verify it passes**

Run: `node backend/tests/test-line-webhook.js`
Expected: All linking and webhook tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/line.js backend/src/server.js backend/tests/test-line-webhook.js
git commit -m "feat(line): implement account linking PIN API and secure webhook endpoint"
```

---

### Task 4: Interactive Bot Commands & Conversational Rejection Workflow

**Files:**
- Modify: `backend/src/routes/line.js`
- Modify: `backend/src/services/line.js`
- Test: `backend/tests/test-line-actions.js`

**Interfaces:**
- Consumes: `backend/src/routes/line.js`, `backend/src/db.js`, `backend/src/services/audit.js`
- Produces: Postback handler for loan approvals, 2-step conversational rejection with reason capture, keyword queries ("รายการยืมของฉัน", "อุปกรณ์ว่าง", "ช่วยเหลือ").

- [ ] **Step 1: Write test for interactive postbacks and conversation state**

Create `backend/tests/test-line-actions.js` testing:
1. Postback `action=approve_loan&loan_id=X` from an authorized Staff updates loan to `Borrowed` and equipment to `Borrowed`.
2. Postback `action=approve_loan&loan_id=X` from a non-staff user is rejected.
3. Postback `action=reject_loan_init&loan_id=X` stores state in `line_conversation_states` and prompts for reason.
4. Next message with text "อุปกรณ์ซ่อมไม่ทันกำหนด" updates loan to `Rejected` with that remark and clears state.
5. Message "ยกเลิก" clears rejection state without modifying the loan.
6. Keyword "รายการยืมของฉัน" returns user's active loans.

- [ ] **Step 2: Run test to verify it fails**

Run: `node backend/tests/test-line-actions.js`
Expected: FAIL (Postback actions and conversation state not implemented)

- [ ] **Step 3: Implement Postback handlers & Conversational Rejection Engine in `backend/src/routes/line.js`**

1. Route postback events: check user role, update loan/equipment in a transaction, insert audit log, push status update to borrower.
2. If `reject_loan_init`: insert `line_conversation_states` with 5-minute expiry, prompt staff.
3. When message event arrives: check `line_conversation_states`. If present, complete rejection with the reason or handle "ยกเลิก".
4. If not in state: check keyword commands ("รายการยืมของฉัน", "อุปกรณ์ว่าง", "ช่วยเหลือ / เมนู").

- [ ] **Step 4: Run test to verify it passes**

Run: `node backend/tests/test-line-actions.js`
Expected: All interactive action tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/line.js backend/tests/test-line-actions.js
git commit -m "feat(line): implement staff approval/rejection actions and conversational reason capture"
```

---

### Task 5: Domain Workflow Hooks & Daily Reminder Cron Job

**Files:**
- Modify: `backend/src/routes/loans.js:100-175`
- Modify: `backend/src/routes/maintenance.js:80-160`
- Create: `backend/src/services/cron.js`
- Modify: `backend/src/server.js`
- Test: `backend/tests/test-line-workflow.js`

**Interfaces:**
- Consumes: `backend/src/services/line.js`
- Produces: Automated push notifications on new loan request, maintenance creation, and automated daily scan for due-today & overdue loans.

- [ ] **Step 1: Write integration test for workflow hooks and cron**

Create `backend/tests/test-line-workflow.js` testing:
1. Creating a loan triggers staff push notification.
2. Creating a maintenance ticket triggers technician/staff push notification.
3. Running `runDailyScan()` detects loans due today and overdue loans, updates overdue status, and dispatches reminders.

- [ ] **Step 2: Run test to verify it fails**

Run: `node backend/tests/test-line-workflow.js`
Expected: FAIL

- [ ] **Step 3: Hook `lineService` into `loans.js` and `maintenance.js`**

Add domain LINE notifications inside the existing `notifySafe` blocks of `loans.js` (for new loan creation and manual web approval/rejection) and `maintenance.js` (for ticket creation and status updates).

- [ ] **Step 4: Implement `backend/src/services/cron.js` and initialize in `server.js`**

Implement automated daily check using native interval or timer scheduled at 08:30 AM (with an exported `runDailyScan` function for on-demand execution and testing).

- [ ] **Step 5: Run test to verify it passes**

Run: `node backend/tests/test-line-workflow.js`
Expected: All workflow and reminder tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/loans.js backend/src/routes/maintenance.js backend/src/services/cron.js backend/src/server.js backend/tests/test-line-workflow.js
git commit -m "feat(line): hook domain events into LINE notifications and add automated reminder cron"
```

---

### Task 6: Frontend Account Linking UI in Profile Modal

**Files:**
- Modify: `frontend/src/App.vue:105-165`
- Test: `frontend/src/App.vue` (build and UI check)

**Interfaces:**
- Consumes: `/api/line/status`, `/api/line/link-token`, `/api/line/unlink`
- Produces: LINE Account Linking tab in Profile Modal with PIN code display, expiry countdown, QR link, and unlinking capability.

- [ ] **Step 1: Add "การเชื่อมต่อ LINE" Tab in Profile Modal**

In `frontend/src/App.vue`, add a third tab button:
```html
<button :class="{ active: profileTab === 'line' }" @click="profileTab = 'line'">การเชื่อมต่อ LINE</button>
```

- [ ] **Step 2: Implement LINE linking view and state**

Add reactive state and methods:
1. `lineStatus`: checks if user is linked to LINE.
2. `requestPin()`: calls `POST /api/line/link-token` to get 6-digit PIN and countdown timer.
3. `unlinkLine()`: calls `POST /api/line/unlink` with confirmation.
4. Auto-refresh when `line:linked` event is received via SSE.

- [ ] **Step 3: Verify frontend build**

Run: `cmd.exe /c "npm run build --prefix frontend"`
Expected: Build passes with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.vue
git commit -m "feat(frontend): add LINE account linking tab to user profile modal"
```

---

### Task 7: Full System Verification

**Files:**
- Test: `backend/tests/` (run all test suites)
- Test: `frontend` build

- [ ] **Step 1: Run complete backend test suite**

Run: `node backend/tests/test-line-service.js && node backend/tests/test-line-webhook.js && node backend/tests/test-line-actions.js && node backend/tests/test-line-workflow.js`
Expected: 100% PASS.

- [ ] **Step 2: Run frontend production build**

Run: `cmd.exe /c "npm run build --prefix frontend"`
Expected: 100% PASS.

- [ ] **Step 3: Document configuration guide**

Update `README.md` or `docs/01-requirements.md` with instructions on setting up LINE Developers Console Webhook URL (`https://your-domain/api/line/webhook`) and issuing the Channel Access Token.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add LINE Messaging API setup and webhook configuration guide"
```

