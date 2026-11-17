<template>
  <div class="dashboard">
    <div class="page-header">
      <div>
        <div class="eyebrow">{{ isBorrower ? 'MY OVERVIEW' : 'SYSTEM OVERVIEW' }}</div>
        <h1>Dashboard</h1>
        <p>{{ isBorrower ? 'ภาพรวมการยืม-คืนอุปกรณ์และประวัติการแจ้งซ่อมของคุณ' : 'ภาพรวมข้อมูลจริงจากระบบยืม-คืนอุปกรณ์และงานแจ้งซ่อม' }}</p>
      </div>
      <div class="header-actions">
        <span v-if="lastUpdated" class="updated">อัปเดต {{ lastUpdated }}</span>
        <button class="btn primary" :disabled="loading" @click="loadSummary">{{ loading ? 'กำลังโหลด…' : '↻ รีเฟรชข้อมูล' }}</button>
      </div>
    </div>

    <div v-if="error" class="alert error">{{ error }}</div>

    <section class="stats-grid">
      <div v-for="card in statCards" :key="card.key" class="stat-card">
        <div class="stat-icon" :class="card.tone">{{ card.icon }}</div>
        <div><span>{{ card.label }}</span><strong>{{ card.value }}</strong><small>รายการ</small></div>
      </div>
    </section>

    <section class="dashboard-grid">
      <div class="page-card">
        <div class="card-title">
          <div><h3>{{ isBorrower ? 'สถานะการยืมของคุณ' : 'สถานะการยืม-คืน' }}</h3><p>{{ isBorrower ? 'รายการยืมอุปกรณ์ทั้งหมดของคุณ' : 'นับจากสถานะจริงในตาราง loans' }}</p></div>
          <RouterLink to="/loan" class="text-link">ดูทั้งหมด →</RouterLink>
        </div>
        <div class="loan-status-grid">
          <div v-for="item in loanStatus" :key="item.key" class="status-box">
            <span class="dot" :class="item.tone"></span>
            <div><label>{{ item.label }}</label><strong>{{ item.value }}</strong></div>
          </div>
        </div>
        <div class="loan-total"><span>รายการยืมทั้งหมด</span><strong>{{ summary.totalLoans }}</strong></div>
      </div>

      <div class="page-card">
        <div class="card-title">
          <div><h3>{{ isBorrower ? 'งานแจ้งซ่อมของคุณ' : 'งานแจ้งซ่อม' }}</h3><p>{{ isBorrower ? 'รายการแจ้งซ่อมทั้งหมดของคุณ' : 'นับตามสถานะจริงในตาราง maintenance' }}</p></div>
          <RouterLink to="/maintenance" class="text-link">ดูทั้งหมด →</RouterLink>
        </div>
        <div class="maintenance-status-grid">
          <div v-for="item in maintenanceStatus" :key="item.key" class="repair-row">
            <div><span>{{ item.label }}</span><strong>{{ item.value }}</strong></div>
            <div class="bar"><i :style="{ width: maintenancePercent(item.value) + '%' }"></i></div>
          </div>
        </div>
        <div class="loan-total"><span>งานซ่อมทั้งหมด</span><strong>{{ summary.totalMaintenance }}</strong></div>
      </div>
    </section>

    <section class="data-grid">
      <div class="page-card">
        <div class="card-title"><div><h3>{{ isBorrower ? 'รายการยืมล่าสุดของคุณ' : 'ภาพรวมรายการยืมอุปกรณ์' }}</h3><p>5 รายการล่าสุดจากฐานข้อมูลจริง</p></div><RouterLink to="/loan" class="text-link">ดูทั้งหมด →</RouterLink></div>
        <div v-if="loading" class="empty">กำลังโหลดข้อมูล…</div>
        <div v-else-if="!summary.recentLoans.length" class="empty">ยังไม่มีรายการยืมอุปกรณ์</div>
        <div v-else class="table-wrap">
          <table><thead><tr><th>อุปกรณ์</th><th>ผู้ยืม</th><th>กำหนดคืน</th><th>สถานะ</th></tr></thead>
            <tbody><tr v-for="row in summary.recentLoans" :key="row.loan_id"><td><strong>{{ row.asset_code }}</strong><small>{{ row.equipment_name }}</small></td><td>{{ row.borrower_name }}</td><td>{{ formatDate(row.due_date) }}</td><td><span class="badge" :class="statusTone(row.status)">{{ loanLabel(row.status) }}</span></td></tr></tbody>
          </table>
        </div>
      </div>

      <div class="page-card">
        <div class="card-title"><div><h3>{{ isBorrower ? 'งานแจ้งซ่อมล่าสุดของคุณ' : 'งานแจ้งซ่อมล่าสุด' }}</h3><p>5 รายการล่าสุดจากฐานข้อมูลจริง</p></div><RouterLink to="/maintenance" class="text-link">ดูทั้งหมด →</RouterLink></div>
        <div v-if="loading" class="empty">กำลังโหลดข้อมูล…</div>
        <div v-else-if="!summary.recentMaintenance.length" class="empty">ยังไม่มีรายการแจ้งซ่อม</div>
        <div v-else class="table-wrap">
          <table><thead><tr><th>อุปกรณ์</th><th>ปัญหา</th><th>ความสำคัญ</th><th>สถานะ</th></tr></thead>
            <tbody><tr v-for="row in summary.recentMaintenance" :key="row.maintenance_id"><td><strong>{{ row.asset_code }}</strong><small>{{ row.equipment_name }}</small></td><td>{{ row.problem_type }}</td><td><span class="badge" :class="priorityTone(row.priority)">{{ row.priority }}</span></td><td><span class="badge info">{{ maintenanceLabel(row.status) }}</span></td></tr></tbody>
          </table>
        </div>
      </div>
    </section>

    <section class="page-card quick-card">
      <div class="card-title"><div><h3>เมนูด่วน</h3><p>เข้าถึงฟังก์ชันที่ใช้งานบ่อย</p></div></div>
      <div class="quick-grid">
        <RouterLink to="/equipment" class="quick-item"><span class="quick-icon blue">▣</span><div><strong>จัดการอุปกรณ์</strong><small>ดูและจัดการรายการอุปกรณ์</small></div><b>→</b></RouterLink>
        <RouterLink to="/loan" class="quick-item"><span class="quick-icon green">⇄</span><div><strong>การยืม-คืน</strong><small>ตรวจสอบและจัดการรายการยืม</small></div><b>→</b></RouterLink>
        <RouterLink to="/maintenance" class="quick-item"><span class="quick-icon orange">⚒</span><div><strong>แจ้งซ่อม</strong><small>แจ้งและติดตามงานซ่อม</small></div><b>→</b></RouterLink>
        <RouterLink v-if="canReport" to="/reports" class="quick-item"><span class="quick-icon purple">▤</span><div><strong>รายงาน</strong><small>ดูสรุปและรายงานของระบบ</small></div><b>→</b></RouterLink>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import api from '../services/api'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const isBorrower = computed(() => auth.role === 'Borrower')
const loading = ref(false)
const error = ref('')
const lastUpdated = ref('')
const summary = ref({ totalEquipment: 0, available: 0, borrowed: 0, maintenance: 0, totalLoans: 0, pendingLoans: 0, approvedLoans: 0, activeLoans: 0, overdueLoans: 0, returnedLoans: 0, rejectedLoans: 0, totalMaintenance: 0, activeMaintenance: 0, reportedMaintenance: 0, receivedMaintenance: 0, diagnosingMaintenance: 0, repairingMaintenance: 0, completedMaintenance: 0, cancelledMaintenance: 0, recentLoans: [], recentMaintenance: [] })

const statCards = computed(() => [
  { key: 'equipment', label: 'อุปกรณ์ทั้งหมด', value: summary.value.totalEquipment, icon: '▣', tone: 'blue' },
  { key: 'available', label: 'พร้อมใช้งาน', value: summary.value.available, icon: '✓', tone: 'green' },
  { key: 'borrowed', label: isBorrower.value ? 'คุณกำลังยืม' : 'กำลังถูกยืม', value: summary.value.borrowed, icon: '⇄', tone: 'orange' },
  { key: 'maintenance', label: isBorrower.value ? 'แจ้งซ่อมของคุณ' : 'อยู่ระหว่างซ่อม', value: summary.value.maintenance, icon: '⚒', tone: 'red' },
])
const loanStatus = computed(() => [
  { key: 'pending', label: 'รออนุมัติ', value: summary.value.pendingLoans, tone: 'pending' },
  { key: 'approved', label: 'อนุมัติแล้ว', value: summary.value.approvedLoans, tone: 'approved' },
  { key: 'active', label: 'กำลังยืม', value: summary.value.activeLoans, tone: 'borrowed' },
  { key: 'overdue', label: 'เกินกำหนด', value: summary.value.overdueLoans, tone: 'overdue' },
  { key: 'returned', label: 'คืนแล้ว', value: summary.value.returnedLoans, tone: 'returned' },
])
const maintenanceStatus = computed(() => [
  { key: 'reported', label: 'แจ้งใหม่', value: summary.value.reportedMaintenance },
  { key: 'received', label: 'รับเรื่อง', value: summary.value.receivedMaintenance },
  { key: 'diagnosing', label: 'กำลังตรวจสอบ', value: summary.value.diagnosingMaintenance },
  { key: 'repairing', label: 'กำลังซ่อม', value: summary.value.repairingMaintenance },
  { key: 'completed', label: 'เสร็จสิ้น', value: summary.value.completedMaintenance },
])
const canReport = computed(() => auth.hasPermission?.('report.read') ?? ['Administrator', 'Staff'].includes(auth.user?.role))

const loadSummary = async () => {
  loading.value = true; error.value = ''
  try {
    const { data } = await api.get('/dashboard/summary')
    summary.value = { ...summary.value, ...(data.data || {}) }
    lastUpdated.value = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch (e) { error.value = e.response?.data?.message || 'ไม่สามารถโหลดข้อมูล Dashboard ได้' }
  finally { loading.value = false }
}
const refreshHandler = () => loadSummary()
const maintenancePercent = (value) => summary.value.totalMaintenance ? Math.round((Number(value) / Number(summary.value.totalMaintenance)) * 100) : 0
const formatDate = (v) => v ? new Date(v).toLocaleDateString('th-TH') : '-'
const loanLabel = (v) => ({ Pending: 'รออนุมัติ', Approved: 'อนุมัติแล้ว', Borrowed: 'กำลังยืม', Overdue: 'เกินกำหนด', Returned: 'คืนแล้ว', Rejected: 'ปฏิเสธ' }[v] || v)
const maintenanceLabel = (v) => ({ Reported: 'แจ้งใหม่', Received: 'รับเรื่อง', Diagnosing: 'กำลังตรวจสอบ', Repairing: 'กำลังซ่อม', Completed: 'เสร็จสิ้น', Cancelled: 'ยกเลิก' }[v] || v)
const statusTone = (v) => ({ Pending: 'warning', Approved: 'info', Borrowed: 'info', Overdue: 'danger', Returned: 'success', Rejected: 'danger' }[v] || 'info')
const priorityTone = (v) => ({ Critical: 'danger', High: 'danger', Medium: 'warning', Low: 'success', Normal: 'info' }[v] || 'info')

onMounted(() => { loadSummary(); window.addEventListener('it-equipment:data-refresh', refreshHandler) })
onBeforeUnmount(() => window.removeEventListener('it-equipment:data-refresh', refreshHandler))
</script>

<style scoped>
.dashboard{display:grid;gap:18px}
.page-header{display:flex;justify-content:space-between;align-items:end;gap:20px}
.eyebrow{font-size:10px;font-weight:700;color:#2563eb;letter-spacing:.08em}
.page-header h1{margin:3px 0 5px;font-size:24px}
.page-header p{font-size:13px}
.header-actions{display:flex;align-items:center;gap:12px}
.updated{font-size:10px;color:#8a96a8}
.btn.primary{background:#2563eb;color:#fff;border-color:#2563eb}
.btn:disabled{opacity:.6;cursor:not-allowed}
.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:15px}
.stat-card{background:#fff;border:1px solid #e6eaf0;border-radius:14px;padding:18px;display:flex;align-items:center;gap:14px;box-shadow:0 2px 9px rgba(15,23,42,.025);min-width:0}
.stat-card span,.stat-card small{display:block;color:#7b8798;font-size:11px}
.stat-card strong{display:inline-block;font-size:25px;margin:2px 6px 0 0}
.stat-icon,.quick-icon{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;font-size:19px;font-weight:700;flex:none}
.blue{background:#eff6ff;color:#2563eb}
.green{background:#ecfdf3;color:#16a34a}
.orange{background:#fff7ed;color:#ea580c}
.red{background:#fef2f2;color:#dc2626}
.purple{background:#f5f3ff;color:#7c3aed}
.dashboard-grid,.data-grid{display:grid;grid-template-columns:1.35fr 1fr;gap:18px}
.dashboard-grid>*,.data-grid>*{min-width:0}
.card-title{display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px 15px;margin-bottom:18px}
.card-title h3{margin:0;font-size:16px}
.card-title p{margin:3px 0 0;font-size:11px;color:#7b8798}
.text-link{font-size:11px;color:#2563eb;text-decoration:none;white-space:nowrap}
.loan-status-grid{display:grid;grid-template-columns:repeat(5,1fr);border:1px solid #edf0f4;border-radius:10px;overflow:hidden}
.status-box{padding:14px 10px;display:flex;gap:8px;align-items:flex-start;min-width:0}
@media(min-width:901px){
  .status-box+.status-box{border-left:1px solid #edf0f4}
}
.status-box label{display:block;font-size:10px;color:#66758a;white-space:nowrap}
.status-box strong{font-size:20px}
.dot{width:8px;height:8px;border-radius:50%;margin-top:5px;flex:none}
.pending{background:#f59e0b}
.approved{background:#6366f1}
.borrowed{background:#2563eb}
.overdue{background:#ef4444}
.returned{background:#16a34a}
.loan-total{margin-top:16px;padding-top:14px;border-top:1px solid #edf0f4;display:flex;justify-content:space-between;font-size:11px;color:#66758a}
.loan-total strong{color:#172033;font-size:14px}
.maintenance-status-grid{display:grid;gap:12px}
.repair-row>div:first-child{display:flex;justify-content:space-between;font-size:10px;color:#66758a;margin-bottom:6px}
.repair-row strong{color:#172033}
.bar{height:7px;background:#eef2f7;border-radius:99px;overflow:hidden}
.bar i{display:block;height:100%;background:#2563eb;border-radius:99px}
.page-card{background:#fff;border:1px solid #e6eaf0;border-radius:14px;padding:20px;box-shadow:0 2px 9px rgba(15,23,42,.025);min-width:0}
.table-wrap{overflow:auto}
.table-wrap table{width:100%;border-collapse:collapse;font-size:10px}
.table-wrap th{text-align:left;color:#7b8798;font-size:9px;font-weight:700;padding:8px;border-bottom:1px solid #e9edf2}
.table-wrap td{padding:10px 8px;border-bottom:1px solid #f0f2f5;white-space:nowrap}
.table-wrap td strong,.table-wrap td small{display:block}
.table-wrap td small{font-size:9px;color:#8b96a7;margin-top:2px}
.badge{display:inline-flex;padding:4px 8px;border-radius:99px;font-size:9px;font-weight:700;background:#eef2f7;color:#475569}
.badge.success{background:#ecfdf3;color:#15803d}
.badge.warning{background:#fff7ed;color:#c2410c}
.badge.danger{background:#fef2f2;color:#dc2626}
.badge.info{background:#eff6ff;color:#1d4ed8}
.empty{min-height:150px;display:grid;place-items:center;color:#9aa5b5;font-size:11px}
.quick-card{padding-bottom:18px}
.quick-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:11px}
.quick-item{display:flex;align-items:center;gap:10px;padding:13px;border:1px solid #e9edf2;border-radius:11px;text-decoration:none;color:#172033;background:#fff;min-width:0}
.quick-item:hover{border-color:#cbd8ee;background:#f8fbff}
.quick-item div{min-width:0;flex:1}
.quick-item strong,.quick-item small{display:block}
.quick-item strong{font-size:11px}
.quick-item small{font-size:9px;color:#8995a7;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.quick-item b{color:#9aa5b5;font-size:14px}
.quick-icon{width:36px;height:36px;border-radius:9px;font-size:15px}
@media(max-width:1100px){
  .stats-grid{grid-template-columns:repeat(2,1fr)}
  .dashboard-grid,.data-grid{grid-template-columns:1fr}
  .quick-grid{grid-template-columns:repeat(2,1fr)}
}
@media(max-width:900px) and (min-width:561px){
  .loan-status-grid{grid-template-columns:repeat(3,1fr)}
  .status-box:nth-child(3n+2),.status-box:nth-child(3n+3){border-left:1px solid #edf0f4}
  .status-box:nth-child(n+4){border-top:1px solid #edf0f4}
}
@media(max-width:650px){
  .quick-grid{grid-template-columns:1fr}
  .page-header{align-items:flex-start;flex-direction:column}
  .header-actions{width:100%;justify-content:space-between}
}
@media(max-width:560px){
  .loan-status-grid{grid-template-columns:repeat(2,1fr)}
  .status-box:nth-child(even){border-left:1px solid #edf0f4}
  .status-box:nth-child(n+3){border-top:1px solid #edf0f4}
}
@media(max-width:480px){
  .stats-grid{grid-template-columns:1fr}
  .stat-card{padding:14px}
}
</style>
