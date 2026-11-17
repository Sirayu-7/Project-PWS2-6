<template>
  <main class="page">
    <div class="head">
      <div>
        <h1>รายงานและสถิติระบบ</h1>
        <p>สรุปข้อมูลทะเบียนอุปกรณ์ การยืม-คืน งานซ่อมบำรุง และส่งออกข้อมูล</p>
      </div>
      <div class="actions">
        <button class="btn" @click="loadAll">↻ รีเฟรช</button>
        <button class="primary" @click="printReport">🖨 พิมพ์รายงาน</button>
      </div>
    </div>

    <div v-if="error" class="alert error">{{ error }}</div>

    <!-- Overall KPI Stats -->
    <section class="stats">
      <div class="stat">
        <span>อุปกรณ์ทั้งหมด</span>
        <b>{{ num(summary.equipment.totalEquipment) }}</b>
      </div>
      <div class="stat">
        <span>พร้อมใช้งาน</span>
        <b>{{ num(summary.equipment.available) }}</b>
      </div>
      <div class="stat">
        <span>กำลังถูกยืม</span>
        <b>{{ num(summary.equipment.borrowed) }}</b>
      </div>
      <div class="stat">
        <span>กำลังซ่อม</span>
        <b>{{ num(summary.equipment.maintenance) }}</b>
      </div>
      <div class="stat">
        <span>รายการยืมสะสม</span>
        <b>{{ num(summary.loans.totalLoans) }}</b>
      </div>
      <div class="stat">
        <span>งานซ่อมสะสม</span>
        <b>{{ num(summary.maintenance.totalMaintenance) }}</b>
      </div>
    </section>

    <!-- KPI Summary Grid -->
    <div class="grid">
      <section class="card">
        <h2>สรุปสถานะการยืม-คืน</h2>
        <div class="summary-row"><span>รออนุมัติ</span><b>{{ num(summary.loans.pending) }}</b></div>
        <div class="summary-row"><span>อนุมัติแล้ว</span><b>{{ num(summary.loans.approved) }}</b></div>
        <div class="summary-row"><span>กำลังยืม</span><b>{{ num(summary.loans.borrowed) }}</b></div>
        <div class="summary-row"><span>คืนแล้ว</span><b>{{ num(summary.loans.returned) }}</b></div>
        <div class="summary-row danger"><span>เกินกำหนด</span><b>{{ num(summary.loans.overdue) }}</b></div>
        <div class="summary-row"><span>ถูกปฏิเสธ</span><b>{{ num(summary.loans.rejected) }}</b></div>
      </section>

      <section class="card">
        <h2>สรุปสถานะงานซ่อม</h2>
        <div class="summary-row"><span>งานที่กำลังดำเนินการ</span><b>{{ num(summary.maintenance.active) }}</b></div>
        <div class="summary-row"><span>ซ่อมเสร็จสิ้น</span><b>{{ num(summary.maintenance.completed) }}</b></div>
        <div class="summary-row"><span>ยกเลิก</span><b>{{ num(summary.maintenance.cancelled) }}</b></div>
        <div class="summary-row cost-row"><span>ค่าใช้จ่ายซ่อมรวม</span><b>฿{{ money(summary.maintenance.repairCost) }}</b></div>
      </section>
    </div>

    <!-- Report Type Tabs -->
    <div class="report-nav">
      <button :class="{ active: activeTab === 'loans' }" @click="activeTab = 'loans'">
        รายงานการยืม-คืน ({{ loans.length }})
      </button>
      <button :class="{ active: activeTab === 'maintenance' }" @click="activeTab = 'maintenance'">
        รายงานการซ่อมบำรุง ({{ maintenance.length }})
      </button>
      <button :class="{ active: activeTab === 'equipment' }" @click="activeTab = 'equipment'">
        รายงานทะเบียนอุปกรณ์ ({{ equipmentList.length }})
      </button>
    </div>

    <!-- Date/Category Filter Toolbar -->
    <section class="filters">
      <template v-if="activeTab !== 'equipment'">
        <label>
          ตั้งแต่วันที่
          <input type="date" v-model="filters.from" />
        </label>
        <label>
          ถึงวันที่
          <input type="date" v-model="filters.to" />
        </label>
      </template>
      <template v-else>
        <label>
          หมวดหมู่อุปกรณ์
          <select v-model="filters.categoryId">
            <option value="">ทุกหมวดหมู่</option>
            <option v-for="c in categories" :key="c.category_id" :value="c.category_id">
              {{ c.category_name }}
            </option>
          </select>
        </label>
      </template>
      <label>
        สถานะ
        <select v-model="filters.status">
          <option value="">ทุกสถานะ</option>
          <template v-if="activeTab === 'loans'">
            <option v-for="(lbl, key) in loanLabels" :key="key" :value="key">{{ lbl }}</option>
          </template>
          <template v-else-if="activeTab === 'maintenance'">
            <option v-for="(lbl, key) in maintLabels" :key="key" :value="key">{{ lbl }}</option>
          </template>
          <template v-else>
            <option value="Available">พร้อมใช้งาน</option>
            <option value="Borrowed">กำลังถูกยืม</option>
            <option value="Maintenance">กำลังซ่อม</option>
            <option value="Damaged">ชำรุด</option>
            <option value="Lost">สูญหาย</option>
            <option value="Retired">จำหน่ายแล้ว</option>
          </template>
        </select>
      </label>

      <button class="btn" @click="loadCurrentTab">ค้นหา</button>
      <button class="btn" @click="clearFilters">ล้างตัวกรอง</button>
      <button class="btn export-btn" @click="exportCurrentTabCSV">📥 ส่งออก CSV</button>
    </section>

    <!-- Table 1: Loans Report -->
    <section v-if="activeTab === 'loans'" class="card table-card">
      <div class="section-head">
        <h2>รายงานการยืม-คืนอุปกรณ์</h2>
        <span>{{ loans.length }} รายการ</span>
      </div>
      <div v-if="loading" class="empty">กำลังโหลดข้อมูล...</div>
      <div v-else-if="!loans.length" class="empty">ไม่พบข้อมูลการยืม-คืนตามเงื่อนไข</div>
      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>รหัสทรัพย์สิน</th>
              <th>อุปกรณ์</th>
              <th>ผู้ยืม</th>
              <th>วันที่ยืม</th>
              <th>ครบกำหนด</th>
              <th>วันที่คืนจริง</th>
              <th>ผู้อนุมัติ</th>
              <th>สถานะ</th>
              <th>วัตถุประสงค์</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="x in loans" :key="x.loan_id">
              <td><b>{{ x.asset_code }}</b></td>
              <td>{{ x.equipment_name }}</td>
              <td>{{ x.borrower_name }}</td>
              <td>{{ fmt(x.borrow_date || x.request_date) }}</td>
              <td>{{ date(x.due_date) }}</td>
              <td>{{ x.return_date ? fmt(x.return_date) : '-' }}</td>
              <td>{{ x.approver_name || '-' }}</td>
              <td><span :class="['badge', x.status.toLowerCase()]">{{ loanLabel(x.status) }}</span></td>
              <td><small>{{ x.purpose || '-' }}</small></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Table 2: Maintenance Report -->
    <section v-if="activeTab === 'maintenance'" class="card table-card">
      <div class="section-head">
        <h2>รายงานงานแจ้งซ่อมและบำรุงรักษา</h2>
        <span>{{ maintenance.length }} รายการ</span>
      </div>
      <div v-if="loading" class="empty">กำลังโหลดข้อมูล...</div>
      <div v-else-if="!maintenance.length" class="empty">ไม่พบข้อมูลงานซ่อมตามเงื่อนไข</div>
      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>รหัสทรัพย์สิน</th>
              <th>อุปกรณ์</th>
              <th>ปัญหา / อาการเสีย</th>
              <th>ผู้แจ้ง</th>
              <th>ช่างผู้รับผิดชอบ</th>
              <th>ความเร่งด่วน</th>
              <th>สถานะ</th>
              <th>ค่าซ่อม</th>
              <th>วันที่แจ้ง</th>
              <th>วิธีแก้ไข</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="x in maintenance" :key="x.maintenance_id">
              <td><b>{{ x.asset_code }}</b></td>
              <td>{{ x.equipment_name }}</td>
              <td><b>{{ x.problem_type }}</b><br/><small>{{ x.problem_description }}</small></td>
              <td>{{ x.reporter_name }}</td>
              <td>{{ x.technician_name || '-' }}</td>
              <td><span :class="['priority', x.priority.toLowerCase()]">{{ x.priority }}</span></td>
              <td><span class="badge" :class="x.status.toLowerCase()">{{ maintLabel(x.status) }}</span></td>
              <td><b>{{ x.repair_cost > 0 ? '฿' + money(x.repair_cost) : '-' }}</b></td>
              <td>{{ fmt(x.created_at) }}</td>
              <td><small>{{ x.solution || '-' }}</small></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Table 3: Equipment Report -->
    <section v-if="activeTab === 'equipment'" class="card table-card">
      <div class="section-head">
        <h2>รายงานทะเบียนอุปกรณ์และประวัติสะสม</h2>
        <span>{{ equipmentList.length }} รายการ</span>
      </div>
      <div v-if="loading" class="empty">กำลังโหลดข้อมูล...</div>
      <div v-else-if="!equipmentList.length" class="empty">ไม่พบข้อมูลอุปกรณ์ตามเงื่อนไข</div>
      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>รหัสทรัพย์สิน</th>
              <th>ชื่ออุปกรณ์</th>
              <th>หมวดหมู่</th>
              <th>ยี่ห้อ / รุ่น</th>
              <th>Serial Number</th>
              <th>วันที่จัดซื้อ</th>
              <th>สถานะ</th>
              <th>ยืมสะสม</th>
              <th>ซ่อมสะสม</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="x in equipmentList" :key="x.equipment_id">
              <td><b>{{ x.asset_code }}</b></td>
              <td>{{ x.equipment_name }}</td>
              <td>{{ x.category_name || '-' }}</td>
              <td>{{ [x.brand, x.model].filter(Boolean).join(' / ') || '-' }}</td>
              <td>{{ x.serial_number || '-' }}</td>
              <td>{{ date(x.purchase_date) }}</td>
              <td><span :class="['badge', x.status.toLowerCase()]">{{ equipStatusLabel(x.status) }}</span></td>
              <td>{{ x.total_loans || 0 }} ครั้ง</td>
              <td>{{ x.total_repairs || 0 }} ครั้ง</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </main>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../services/api'
import { useAutoRefresh } from '../composables/useAutoRefresh'

const error = ref('')
const loading = ref(false)
const activeTab = ref('loans')

const loans = ref([])
const maintenance = ref([])
const equipmentList = ref([])
const categories = ref([])

const filters = ref({ from: '', to: '', status: '', categoryId: '' })
const summary = ref({ equipment: {}, loans: {}, maintenance: {} })

const num = (v) => Number(v || 0).toLocaleString('th-TH')
const money = (v) => Number(v || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmt = (v) => (v ? new Date(v).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '-')
const date = (v) => (v ? new Date(v).toLocaleDateString('th-TH') : '-')

const loanLabels = {
  Pending: 'รออนุมัติ',
  Approved: 'อนุมัติแล้ว',
  Borrowed: 'กำลังยืม',
  Returned: 'คืนแล้ว',
  Overdue: 'เกินกำหนด',
  Rejected: 'ถูกปฏิเสธ',
}
const maintLabels = {
  Reported: 'แจ้งแล้ว',
  Received: 'รับเรื่อง',
  Diagnosing: 'กำลังตรวจสอบ',
  Repairing: 'กำลังซ่อม',
  Completed: 'เสร็จสิ้น',
  Cancelled: 'ยกเลิก',
}

const loanLabel = (s) => loanLabels[s] || s
const maintLabel = (s) => maintLabels[s] || s
const equipStatusLabel = (s) =>
  ({
    Available: 'พร้อมใช้งาน',
    Borrowed: 'กำลังถูกยืม',
    Reserved: 'จอง',
    Maintenance: 'กำลังซ่อม',
    Damaged: 'ชำรุด',
    Lost: 'สูญหาย',
    Retired: 'จำหน่ายแล้ว',
  }[s] || s)

async function loadSummary() {
  const { data } = await api.get('/reports/summary')
  summary.value = data.data || summary.value
}

async function loadCategories() {
  try {
    const { data } = await api.get('/categories')
    categories.value = data.data || []
  } catch {}
}

async function loadLoans() {
  const p = { from: filters.value.from, to: filters.value.to, status: filters.value.status }
  const { data } = await api.get('/reports/loans', { params: p })
  loans.value = data.data || []
}

async function loadMaintenance() {
  const p = { from: filters.value.from, to: filters.value.to, status: filters.value.status }
  const { data } = await api.get('/reports/maintenance', { params: p })
  maintenance.value = data.data || []
}

async function loadEquipmentReport() {
  const p = { category_id: filters.value.categoryId, status: filters.value.status }
  const { data } = await api.get('/reports/equipment', { params: p })
  equipmentList.value = data.data || []
}

async function loadCurrentTab() {
  loading.value = true
  error.value = ''
  try {
    if (activeTab.value === 'loans') await loadLoans()
    else if (activeTab.value === 'maintenance') await loadMaintenance()
    else if (activeTab.value === 'equipment') await loadEquipmentReport()
  } catch (e) {
    error.value = e.response?.data?.message || 'ไม่สามารถโหลดข้อมูลรายงานได้'
  } finally {
    loading.value = false
  }
}

async function loadAll() {
  loading.value = true
  error.value = ''
  try {
    await Promise.all([loadSummary(), loadCategories(), loadLoans(), loadMaintenance(), loadEquipmentReport()])
  } catch (e) {
    error.value = e.response?.data?.message || 'ไม่สามารถโหลดรายงานได้'
  } finally {
    loading.value = false
  }
}

function clearFilters() {
  filters.value = { from: '', to: '', status: '', categoryId: '' }
  loadCurrentTab()
}

function printReport() {
  window.print()
}

// Export CSV Helper with UTF-8 BOM
function exportCSV(filename, headers, rows) {
  const escapeCell = (cell) => {
    if (cell === null || cell === undefined) return '""'
    const str = String(cell).replace(/"/g, '""')
    return `"${str}"`
  }

  const csvContent =
    '\uFEFF' +
    [headers.map(escapeCell).join(','), ...rows.map((row) => row.map(escapeCell).join(','))].join('\r\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function exportCurrentTabCSV() {
  if (activeTab.value === 'loans') {
    const headers = ['รหัสรายการ', 'รหัสทรัพย์สิน', 'อุปกรณ์', 'ผู้ยืม', 'วันที่ยืม', 'กำหนดคืน', 'วันที่คืนจริง', 'ผู้อนุมัติ', 'สถานะ', 'วัตถุประสงค์']
    const rows = loans.value.map((l) => [
      l.loan_id,
      l.asset_code,
      l.equipment_name,
      l.borrower_name,
      fmt(l.borrow_date || l.request_date),
      date(l.due_date),
      l.return_date ? fmt(l.return_date) : '-',
      l.approver_name || '-',
      loanLabel(l.status),
      l.purpose || '-',
    ])
    exportCSV('รายงานการยืม-คืนอุปกรณ์', headers, rows)
  } else if (activeTab.value === 'maintenance') {
    const headers = ['รหัสแจ้งซ่อม', 'รหัสทรัพย์สิน', 'อุปกรณ์', 'ปัญหา', 'รายละเอียด', 'ผู้แจ้ง', 'ช่างผู้รับผิดชอบ', 'ความเร่งด่วน', 'สถานะ', 'ค่าซ่อม', 'วันที่แจ้ง', 'วิธีแก้ไข']
    const rows = maintenance.value.map((m) => [
      m.maintenance_id,
      m.asset_code,
      m.equipment_name,
      m.problem_type,
      m.problem_description,
      m.reporter_name,
      m.technician_name || '-',
      m.priority,
      maintLabel(m.status),
      m.repair_cost || 0,
      fmt(m.created_at),
      m.solution || '-',
    ])
    exportCSV('รายงานการซ่อมบำรุง', headers, rows)
  } else if (activeTab.value === 'equipment') {
    const headers = ['รหัสอุปกรณ์', 'รหัสทรัพย์สิน', 'ชื่ออุปกรณ์', 'หมวดหมู่', 'ยี่ห้อ', 'รุ่น', 'Serial Number', 'วันที่จัดซื้อ', 'สถานะ', 'ยืมสะสม(ครั้ง)', 'ซ่อมสะสม(ครั้ง)']
    const rows = equipmentList.value.map((e) => [
      e.equipment_id,
      e.asset_code,
      e.equipment_name,
      e.category_name || '-',
      e.brand || '-',
      e.model || '-',
      e.serial_number || '-',
      date(e.purchase_date),
      equipStatusLabel(e.status),
      e.total_loans || 0,
      e.total_repairs || 0,
    ])
    exportCSV('รายงานทะเบียนอุปกรณ์', headers, rows)
  }
}

onMounted(loadAll)
useAutoRefresh(loadAll)
</script>

<style scoped>
.page {
  padding: 0;
  max-width: 1500px;
  margin: auto;
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 22px;
}
.head h1 {
  margin: 0;
  font-size: 24px;
}
.head p {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 13px;
}
.actions {
  display: flex;
  gap: 8px;
}
.actions button,
.filters button {
  border: 1px solid #cbd5e1;
  border-radius: 9px;
  padding: 10px 14px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
}
.primary {
  border: 0 !important;
  background: #2563eb !important;
  color: #fff !important;
  font-weight: 700;
}
.export-btn {
  background: #ecfdf5 !important;
  border-color: #a7f3d0 !important;
  color: #065f46 !important;
}
.report-nav {
  display: flex;
  gap: 8px;
  border-bottom: 1px solid #e2e8f0;
  margin: 20px 0 16px;
  overflow-x: auto;
  white-space: nowrap;
  -webkit-overflow-scrolling: touch;
}
.report-nav button {
  border: 0;
  background: transparent;
  padding: 11px 18px;
  font-size: 14px;
  font-weight: 700;
  color: #64748b;
  cursor: pointer;
  border-bottom: 3px solid transparent;
  flex-shrink: 0;
}
.report-nav button.active {
  color: #2563eb;
  border-bottom-color: #2563eb;
}
.filters {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  margin-bottom: 18px;
  flex-wrap: wrap;
}
.filters label {
  font-size: 12px;
  font-weight: 700;
  color: #475569;
}
.filters input,
.filters select {
  display: block;
  margin-top: 5px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 9px 12px;
  background: #fff;
}
.stats {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;
  margin-bottom: 18px;
}
.stat {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 13px;
  padding: 17px;
}
.stat span {
  display: block;
  color: #64748b;
  font-size: 12px;
}
.stat b {
  display: block;
  font-size: 25px;
  margin-top: 8px;
}
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 18px;
}
.card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 20px;
  min-width: 0;
}
.card h2 {
  margin: 0 0 14px;
  font-size: 16px;
}
.summary-row {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid #eef2f7;
  font-size: 13px;
}
.summary-row:last-child {
  border-bottom: 0;
}
.summary-row b {
  font-size: 15px;
}
.danger b {
  color: #dc2626;
}
.cost-row b {
  color: #2563eb;
}
.table-card {
  padding: 0;
  margin-bottom: 18px;
  overflow: hidden;
}
.section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 20px;
  border-bottom: 1px solid #eef2f7;
}
.section-head h2 {
  margin: 0;
  font-size: 16px;
}
.section-head span {
  font-size: 12px;
  color: #64748b;
}
.table-wrap {
  overflow: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  min-width: 950px;
}
th,
td {
  padding: 12px 14px;
  text-align: left;
  border-bottom: 1px solid #eef2f7;
  font-size: 13px;
}
th {
  background: #f8fafc;
  color: #475569;
}
td small {
  display: block;
  color: #64748b;
  margin-top: 3px;
  max-width: 280px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 999px;
  background: #e2e8f0;
  font-size: 11px;
  font-weight: 600;
}
.badge.available,
.badge.returned,
.badge.completed {
  background: #dcfce7;
  color: #166534;
}
.badge.borrowed,
.badge.repairing {
  background: #dbeafe;
  color: #1d4ed8;
}
.badge.pending,
.badge.reported {
  background: #fef3c7;
  color: #92400e;
}
.badge.overdue,
.badge.damaged,
.badge.lost,
.badge.rejected {
  background: #fee2e2;
  color: #b91c1c;
}
.priority {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 99px;
  font-size: 11px;
}
.priority.urgent,
.priority.high {
  background: #fee2e2;
  color: #b91c1c;
}
.priority.normal {
  background: #e0f2fe;
  color: #0369a1;
}
.priority.low {
  background: #f1f5f9;
  color: #475569;
}
.alert {
  margin-bottom: 14px;
  background: #fef2f2;
  color: #b91c1c;
  padding: 11px;
  border-radius: 8px;
  font-size: 12px;
}
.empty {
  padding: 40px;
  text-align: center;
  color: #64748b;
}
@media (max-width: 1100px) {
  .stats {
    grid-template-columns: repeat(3, 1fr);
  }
}
@media (max-width: 768px) {
  .filters label {
    flex: 1 1 calc(50% - 8px);
    min-width: 140px;
  }
  .filters input,
  .filters select {
    width: 100%;
    box-sizing: border-box;
  }
  .filters .btn {
    flex: 1 1 auto;
  }
}
@media (max-width: 700px) {
  .head,
  .filters {
    flex-wrap: wrap;
  }
  .stats {
    grid-template-columns: repeat(2, 1fr);
  }
  .grid {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 480px) {
  .head {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  .head .actions {
    width: 100%;
  }
  .head .actions button {
    flex: 1;
  }
  .filters label {
    flex: 1 1 100%;
  }
  .stats {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }
  .stat {
    padding: 14px;
  }
  .stat b {
    font-size: 20px;
  }
}
@media print {
  .sidebar,
  .topbar,
  .head .actions,
  .report-nav,
  .filters {
    display: none !important;
  }
  .main,
  .content {
    margin: 0 !important;
    padding: 0 !important;
  }
  .page {
    max-width: none;
    padding: 0;
  }
  .card {
    break-inside: avoid;
    box-shadow: none;
  }
  .table-card {
    overflow: visible;
  }
  .table-wrap {
    overflow: visible;
  }
}
</style>
