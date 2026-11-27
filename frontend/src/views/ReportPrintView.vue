<template>
  <div class="print-page-root">
    <component :is="'style'">
      @page { size: A4 {{ orientation }}; margin: 12mm 14mm; }
    </component>

    <!-- Screen-only Top Control Toolbar -->
    <header class="print-toolbar no-print">
      <div class="toolbar-left">
        <button class="btn-back" type="button" @click="goBack">← กลับหน้ารายงาน</button>
        <div class="toolbar-title">
          <strong>ตัวอย่างก่อนพิมพ์รายงาน</strong>
          <small>จัดรูปแบบสำหรับพิมพ์ A4 / บันทึกเป็น PDF</small>
        </div>
      </div>

      <div class="toolbar-controls">
        <label class="ctrl-field">
          <span>ประเภทรายงาน</span>
          <select v-model="reportType" @change="onReportTypeChange">
            <option value="loans">รายงานการยืม-คืนอุปกรณ์</option>
            <option value="maintenance">รายงานการซ่อมบำรุง</option>
            <option value="equipment">รายงานทะเบียนอุปกรณ์</option>
            <option value="all">รายงานสรุปภาพรวมทั้งหมด</option>
          </select>
        </label>

        <label class="ctrl-field">
          <span>แนวกระดาษ</span>
          <select v-model="orientation">
            <option value="landscape">แนวนอน (A4 Landscape)</option>
            <option value="portrait">แนวตั้ง (A4 Portrait)</option>
          </select>
        </label>

        <label class="ctrl-check">
          <input type="checkbox" v-model="showSummary" />
          <span>แสดงสรุปตัวเลข</span>
        </label>

        <label class="ctrl-check">
          <input type="checkbox" v-model="showSignature" />
          <span>แสดงช่องลงนาม</span>
        </label>

        <button class="btn-print" type="button" @click="triggerPrint" :disabled="loading">
          🖨 พิมพ์ / บันทึก PDF
        </button>
      </div>
    </header>

    <!-- Paper Preview Backdrop -->
    <div class="print-canvas">
      <article class="print-sheet" :class="orientation">
        <!-- Formal Document Header -->
        <header class="doc-header">
          <div class="doc-brand">
            <img src="/logo.png" alt="Logo" class="doc-logo" />
            <div>
              <div class="doc-org">ระบบบริหารจัดการครุภัณฑ์ไอที • IT Equipment Management System</div>
              <h1>{{ reportTitle }}</h1>
            </div>
          </div>
          <div class="doc-meta">
            <div><span>วันที่พิมพ์:</span> <b>{{ printedAt }}</b></div>
            <div><span>ผู้พิมพ์รายงาน:</span> <b>{{ printedByLabel }}</b></div>
            <div><span>จำนวนข้อมูล:</span> <b>{{ num(totalRecordCount) }} รายการ</b></div>
          </div>
        </header>

        <!-- Active Filter Banner -->
        <div class="filter-summary">
          <span class="filter-label">เงื่อนไขข้อมูล:</span>
          <span>{{ filterSummaryText }}</span>
        </div>

        <div v-if="error" class="alert-error">{{ error }}</div>
        <div v-if="loading" class="loading-box">กำลังเตรียมข้อมูลรายงานสำหรับพิมพ์...</div>

        <template v-else>
          <!-- KPI Summary Strip -->
          <section v-if="showSummary" class="kpi-strip">
            <div v-for="item in summaryCards" :key="item.label" class="kpi-box">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </div>
          </section>

          <!-- Section 1: Loans Report -->
          <section v-if="reportType === 'loans' || reportType === 'all'" class="report-section">
            <div v-if="reportType === 'all'" class="section-title-row">
              <h2>1. รายงานการยืม-คืนอุปกรณ์</h2>
              <span>{{ num(loans.length) }} รายการ</span>
            </div>

            <div v-if="!loans.length" class="empty-box">ไม่พบข้อมูลการยืม-คืนตามเงื่อนไขที่กำหนด</div>
            <table v-else class="print-table">
              <thead>
                <tr>
                  <th class="col-no">ลำดับ</th>
                  <th>รหัสทรัพย์สิน</th>
                  <th>ชื่ออุปกรณ์</th>
                  <th>ผู้ยืม</th>
                  <th>วันที่ยืม</th>
                  <th>กำหนดคืน</th>
                  <th>วันที่คืนจริง</th>
                  <th>ผู้อนุมัติ</th>
                  <th>สถานะ</th>
                  <th>วัตถุประสงค์</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(x, idx) in loans" :key="x.loan_id">
                  <td class="col-no">{{ idx + 1 }}</td>
                  <td class="nowrap"><b>{{ x.asset_code }}</b></td>
                  <td>{{ x.equipment_name }}</td>
                  <td>{{ x.borrower_name }}</td>
                  <td class="nowrap">{{ fmt(x.borrow_date || x.request_date) }}</td>
                  <td class="nowrap">{{ fmtDate(x.due_date) }}</td>
                  <td class="nowrap">{{ x.return_date ? fmt(x.return_date) : '-' }}</td>
                  <td>{{ x.approver_name || '-' }}</td>
                  <td class="nowrap">
                    <span :class="['status-pill', (x.status || '').toLowerCase()]">{{ loanLabel(x.status) }}</span>
                  </td>
                  <td>{{ x.purpose || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <!-- Section 2: Maintenance Report -->
          <section v-if="reportType === 'maintenance' || reportType === 'all'" class="report-section">
            <div v-if="reportType === 'all'" class="section-title-row">
              <h2>2. รายงานการซ่อมบำรุง</h2>
              <span>{{ num(maintenance.length) }} รายการ</span>
            </div>

            <div v-if="!maintenance.length" class="empty-box">ไม่พบข้อมูลงานซ่อมบำรุงตามเงื่อนไขที่กำหนด</div>
            <table v-else class="print-table">
              <thead>
                <tr>
                  <th class="col-no">ลำดับ</th>
                  <th>รหัสทรัพย์สิน</th>
                  <th>ชื่ออุปกรณ์</th>
                  <th>ปัญหา / อาการเสีย</th>
                  <th>ผู้แจ้ง</th>
                  <th>ช่างผู้รับผิดชอบ</th>
                  <th>ระดับ</th>
                  <th>สถานะ</th>
                  <th class="col-num">ค่าซ่อม (บาท)</th>
                  <th>วันที่แจ้ง</th>
                  <th>วิธีแก้ไข</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(x, idx) in maintenance" :key="x.maintenance_id">
                  <td class="col-no">{{ idx + 1 }}</td>
                  <td class="nowrap"><b>{{ x.asset_code }}</b></td>
                  <td>{{ x.equipment_name }}</td>
                  <td>
                    <b>{{ x.problem_type }}</b>
                    <div v-if="x.problem_description" class="sub-text">{{ x.problem_description }}</div>
                  </td>
                  <td>{{ x.reporter_name }}</td>
                  <td>{{ x.technician_name || '-' }}</td>
                  <td class="nowrap">{{ x.priority || '-' }}</td>
                  <td class="nowrap">
                    <span :class="['status-pill', (x.status || '').toLowerCase()]">{{ maintLabel(x.status) }}</span>
                  </td>
                  <td class="col-num nowrap">
                    {{ Number(x.repair_cost) > 0 ? '฿' + money(x.repair_cost) : '-' }}
                  </td>
                  <td class="nowrap">{{ fmt(x.created_at) }}</td>
                  <td>{{ x.solution || '-' }}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="8" class="tfoot-label">รวมค่าใช้จ่ายซ่อมบำรุงทั้งหมด ({{ num(maintenance.length) }} รายการ)</td>
                  <td class="col-num tfoot-total nowrap">฿{{ money(totalMaintenanceCost) }}</td>
                  <td colspan="2"></td>
                </tr>
              </tfoot>
            </table>
          </section>

          <!-- Section 3: Equipment Report -->
          <section v-if="reportType === 'equipment' || reportType === 'all'" class="report-section">
            <div v-if="reportType === 'all'" class="section-title-row">
              <h2>3. รายงานทะเบียนอุปกรณ์</h2>
              <span>{{ num(equipmentList.length) }} รายการ</span>
            </div>

            <div v-if="!equipmentList.length" class="empty-box">ไม่พบข้อมูลทะเบียนอุปกรณ์ตามเงื่อนไขที่กำหนด</div>
            <table v-else class="print-table">
              <thead>
                <tr>
                  <th class="col-no">ลำดับ</th>
                  <th>รหัสทรัพย์สิน</th>
                  <th>ชื่ออุปกรณ์</th>
                  <th>หมวดหมู่</th>
                  <th>ยี่ห้อ / รุ่น</th>
                  <th>Serial Number</th>
                  <th>วันที่จัดซื้อ</th>
                  <th>สถานะ</th>
                  <th class="col-num">ยืม / ซ่อมสะสม</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(x, idx) in equipmentList" :key="x.equipment_id">
                  <td class="col-no">{{ idx + 1 }}</td>
                  <td class="nowrap"><b>{{ x.asset_code }}</b></td>
                  <td>{{ x.equipment_name }}</td>
                  <td>{{ x.category_name || '-' }}</td>
                  <td>{{ [x.brand, x.model].filter(Boolean).join(' / ') || '-' }}</td>
                  <td class="nowrap">{{ x.serial_number || '-' }}</td>
                  <td class="nowrap">{{ fmtDate(x.purchase_date) }}</td>
                  <td class="nowrap">
                    <span :class="['status-pill', (x.status || '').toLowerCase()]">{{ equipStatusLabel(x.status) }}</span>
                  </td>
                  <td class="col-num nowrap">
                    {{ num(x.total_loans || 0) }} / {{ num(x.total_repairs || 0) }} ครั้ง
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <!-- Formal Signature Block -->
          <footer v-if="showSignature" class="signature-grid">
            <div class="sig-box">
              <div class="sig-line">ลงชื่อ ......................................................</div>
              <div class="sig-name">( {{ printedByName }} )</div>
              <div class="sig-role">ผู้จัดทำรายงาน</div>
              <div class="sig-date">วันที่ ......... / ......... / .............</div>
            </div>
            <div class="sig-box">
              <div class="sig-line">ลงชื่อ ......................................................</div>
              <div class="sig-name">( ...................................................... )</div>
              <div class="sig-role">ผู้ตรวจสอบ / ผู้อนุมัติ</div>
              <div class="sig-date">วันที่ ......... / ......... / .............</div>
            </div>
          </footer>
        </template>
      </article>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../services/api'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const validTabs = ['loans', 'maintenance', 'equipment', 'all']
const initialTab = validTabs.includes(String(route.query.tab || '')) ? String(route.query.tab) : 'loans'

const reportType = ref(initialTab)
const orientation = ref('landscape')
const showSummary = ref(true)
const showSignature = ref(true)

const filterFrom = ref(String(route.query.from || ''))
const filterTo = ref(String(route.query.to || ''))
const filterStatus = ref(String(route.query.status || ''))
const filterCategoryId = ref(String(route.query.categoryId || ''))

const loading = ref(true)
const error = ref('')
const summary = ref({ equipment: {}, loans: {}, maintenance: {} })
const categories = ref([])
const loans = ref([])
const maintenance = ref([])
const equipmentList = ref([])
const printedAt = ref(new Date().toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }))

const currentUser = computed(() => {
  if (auth.user && auth.user.name) return auth.user
  try {
    const raw = localStorage.getItem('it_user')
    if (raw) return JSON.parse(raw)
  } catch {}
  return auth.user || {}
})

const printedByName = computed(() => currentUser.value?.name || auth.userName || 'ผู้ใช้งานระบบ')
const printedByRole = computed(() => currentUser.value?.role || auth.role || '')
const printedByLabel = computed(() =>
  printedByRole.value ? `${printedByName.value} (${printedByRole.value})` : printedByName.value
)

const num = (v) => Number(v || 0).toLocaleString('th-TH')
const money = (v) => Number(v || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmt = (v) => (v ? new Date(v).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '-')
const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('th-TH') : '-')

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
const equipLabels = {
  Available: 'พร้อมใช้งาน',
  Borrowed: 'กำลังถูกยืม',
  Reserved: 'จอง',
  Maintenance: 'กำลังซ่อม',
  Damaged: 'ชำรุด',
  Lost: 'สูญหาย',
  Retired: 'จำหน่ายแล้ว',
}

const loanLabel = (s) => loanLabels[s] || s || '-'
const maintLabel = (s) => maintLabels[s] || s || '-'
const equipStatusLabel = (s) => equipLabels[s] || s || '-'

const reportTitle = computed(() => {
  const titles = {
    loans: 'รายงานการยืม-คืนอุปกรณ์',
    maintenance: 'รายงานการซ่อมบำรุงอุปกรณ์',
    equipment: 'รายงานทะเบียนอุปกรณ์และประวัติสะสม',
    all: 'รายงานสรุปภาพรวมระบบบริหารจัดการครุภัณฑ์ไอที',
  }
  return titles[reportType.value] || titles.loans
})

const totalMaintenanceCost = computed(() =>
  maintenance.value.reduce((acc, item) => acc + Number(item.repair_cost || 0), 0)
)

const totalRecordCount = computed(() => {
  if (reportType.value === 'loans') return loans.value.length
  if (reportType.value === 'maintenance') return maintenance.value.length
  if (reportType.value === 'equipment') return equipmentList.value.length
  return loans.value.length + maintenance.value.length + equipmentList.value.length
})

const selectedCategoryName = computed(() => {
  if (!filterCategoryId.value) return ''
  const found = categories.value.find((c) => String(c.category_id) === String(filterCategoryId.value))
  return found ? found.category_name : `#${filterCategoryId.value}`
})

const filterSummaryText = computed(() => {
  const parts = []
  if (reportType.value !== 'equipment') {
    if (filterFrom.value || filterTo.value) {
      parts.push(`ช่วงวันที่: ${filterFrom.value ? fmtDate(filterFrom.value) : 'เริ่มต้น'} ถึง ${filterTo.value ? fmtDate(filterTo.value) : 'ปัจจุบัน'}`)
    }
  } else if (filterCategoryId.value) {
    parts.push(`หมวดหมู่: ${selectedCategoryName.value}`)
  }

  if (filterStatus.value && reportType.value !== 'all') {
    const lbl =
      reportType.value === 'loans'
        ? loanLabel(filterStatus.value)
        : reportType.value === 'maintenance'
          ? maintLabel(filterStatus.value)
          : equipStatusLabel(filterStatus.value)
    parts.push(`สถานะ: ${lbl}`)
  }

  return parts.length ? parts.join('   |   ') : 'ข้อมูลทั้งหมด (ไม่ระบุตัวกรอง)'
})

const summaryCards = computed(() => {
  if (reportType.value === 'loans') {
    const countStatus = (s) => loans.value.filter((x) => x.status === s).length
    return [
      { label: 'รายการทั้งหมด', value: num(loans.value.length) },
      { label: 'รออนุมัติ', value: num(countStatus('Pending')) },
      { label: 'กำลังยืม', value: num(countStatus('Borrowed')) },
      { label: 'คืนแล้ว', value: num(countStatus('Returned')) },
      { label: 'เกินกำหนด', value: num(countStatus('Overdue')) },
      { label: 'ถูกปฏิเสธ', value: num(countStatus('Rejected')) },
    ]
  }
  if (reportType.value === 'maintenance') {
    const active = maintenance.value.filter((x) => !['Completed', 'Cancelled'].includes(x.status)).length
    const completed = maintenance.value.filter((x) => x.status === 'Completed').length
    const cancelled = maintenance.value.filter((x) => x.status === 'Cancelled').length
    return [
      { label: 'งานซ่อมทั้งหมด', value: num(maintenance.value.length) },
      { label: 'กำลังดำเนินการ', value: num(active) },
      { label: 'ซ่อมเสร็จสิ้น', value: num(completed) },
      { label: 'ยกเลิก', value: num(cancelled) },
      { label: 'ค่าซ่อมรวม', value: `฿${money(totalMaintenanceCost.value)}` },
    ]
  }
  if (reportType.value === 'equipment') {
    const countStatus = (s) => equipmentList.value.filter((x) => x.status === s).length
    const issueCount = equipmentList.value.filter((x) => ['Damaged', 'Lost', 'Retired'].includes(x.status)).length
    return [
      { label: 'อุปกรณ์ทั้งหมด', value: num(equipmentList.value.length) },
      { label: 'พร้อมใช้งาน', value: num(countStatus('Available')) },
      { label: 'กำลังถูกยืม', value: num(countStatus('Borrowed')) },
      { label: 'กำลังซ่อม', value: num(countStatus('Maintenance')) },
      { label: 'ชำรุด / สูญหาย / จำหน่าย', value: num(issueCount) },
    ]
  }
  return [
    { label: 'อุปกรณ์ทั้งหมด', value: num(summary.value.equipment?.totalEquipment) },
    { label: 'พร้อมใช้งาน', value: num(summary.value.equipment?.available) },
    { label: 'กำลังถูกยืม', value: num(summary.value.equipment?.borrowed) },
    { label: 'กำลังซ่อม', value: num(summary.value.equipment?.maintenance) },
    { label: 'รายการยืมสะสม', value: num(summary.value.loans?.totalLoans) },
    { label: 'ค่าซ่อมรวม', value: `฿${money(summary.value.maintenance?.repairCost)}` },
  ]
})

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const loanParams = {
      from: filterFrom.value,
      to: filterTo.value,
      status: reportType.value === 'loans' ? filterStatus.value : '',
    }
    const maintParams = {
      from: filterFrom.value,
      to: filterTo.value,
      status: reportType.value === 'maintenance' ? filterStatus.value : '',
    }
    const equipParams = {
      category_id: filterCategoryId.value,
      status: reportType.value === 'equipment' ? filterStatus.value : '',
    }

    const [sumRes, catRes, loanRes, maintRes, equipRes] = await Promise.all([
      api.get('/reports/summary'),
      api.get('/categories').catch(() => ({ data: { data: [] } })),
      api.get('/reports/loans', { params: loanParams }),
      api.get('/reports/maintenance', { params: maintParams }),
      api.get('/reports/equipment', { params: equipParams }),
    ])

    summary.value = sumRes.data?.data || summary.value
    categories.value = catRes.data?.data || []
    loans.value = loanRes.data?.data || []
    maintenance.value = maintRes.data?.data || []
    equipmentList.value = equipRes.data?.data || []
    printedAt.value = new Date().toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
  } catch (e) {
    error.value = e.response?.data?.message || 'ไม่สามารถโหลดข้อมูลสำหรับพิมพ์รายงานได้'
  } finally {
    loading.value = false
  }
}

function onReportTypeChange() {
  if (reportType.value !== initialTab) {
    filterStatus.value = ''
  }
  loadData()
}

function triggerPrint() {
  printedAt.value = new Date().toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
  window.print()
}

function goBack() {
  router.push('/reports')
}

onMounted(loadData)
</script>

<style scoped>
.print-page-root {
  min-height: 100vh;
  background: #e2e8f0;
  color: #0f172a;
}

.print-toolbar {
  position: sticky;
  top: 0;
  z-index: 30;
  background: #0f172a;
  color: #f8fafc;
  padding: 12px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.25);
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.toolbar-title strong {
  display: block;
  font-size: 14px;
}

.toolbar-title small {
  display: block;
  color: #94a3b8;
  font-size: 11px;
}

.btn-back {
  border: 1px solid #334155;
  background: #1e293b;
  color: #e2e8f0;
  border-radius: 8px;
  padding: 8px 13px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.btn-back:hover {
  background: #334155;
}

.toolbar-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.ctrl-field {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #cbd5e1;
}

.ctrl-field select {
  border: 1px solid #475569;
  background: #1e293b;
  color: #f8fafc;
  border-radius: 7px;
  padding: 7px 10px;
  font-size: 12px;
}

.ctrl-check {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #e2e8f0;
  cursor: pointer;
}

.btn-print {
  border: 0;
  background: #2563eb;
  color: #ffffff;
  border-radius: 8px;
  padding: 9px 16px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.btn-print:hover {
  background: #1d4ed8;
}

.btn-print:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.print-canvas {
  padding: 24px 16px 40px;
}

.print-sheet {
  background: #ffffff;
  margin: 0 auto;
  padding: 14mm 16mm;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.14);
  border-radius: 6px;
}

.print-sheet.landscape {
  max-width: 297mm;
}

.print-sheet.portrait {
  max-width: 210mm;
}

.doc-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  padding-bottom: 12px;
  border-bottom: 2px solid #1e293b;
  margin-bottom: 10px;
}

.doc-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.doc-logo {
  width: 48px;
  height: 48px;
  object-fit: contain;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  padding: 2px;
  background: #fff;
}

.doc-org {
  font-size: 11px;
  color: #475569;
  font-weight: 600;
  margin-bottom: 3px;
}

.doc-brand h1 {
  margin: 0;
  font-size: 20px;
  color: #0f172a;
}

.doc-meta {
  text-align: right;
  font-size: 11.5px;
  color: #334155;
  line-height: 1.6;
  flex-shrink: 0;
}

.doc-meta span {
  color: #64748b;
}

.filter-summary {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 7px 12px;
  font-size: 11.5px;
  color: #1e293b;
  margin-bottom: 14px;
}

.filter-label {
  font-weight: 700;
  margin-right: 6px;
}

.kpi-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 8px;
  margin-bottom: 16px;
}

.kpi-box {
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  border-radius: 6px;
  padding: 8px 10px;
  break-inside: avoid;
}

.kpi-box span {
  display: block;
  font-size: 10.5px;
  color: #475569;
}

.kpi-box strong {
  display: block;
  margin-top: 3px;
  font-size: 16px;
  color: #0f172a;
}

.report-section {
  margin-bottom: 18px;
}

.section-title-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin: 14px 0 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid #cbd5e1;
}

.section-title-row h2 {
  margin: 0;
  font-size: 14.5px;
  color: #0f172a;
}

.section-title-row span {
  font-size: 11.5px;
  color: #475569;
  font-weight: 600;
}

.print-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
  line-height: 1.4;
}

.print-table thead {
  display: table-header-group;
}

.print-table tr {
  break-inside: avoid;
  page-break-inside: avoid;
}

.print-table th,
.print-table td {
  border: 1px solid #cbd5e1;
  padding: 6px 7px;
  text-align: left;
  vertical-align: top;
  white-space: normal;
  word-break: break-word;
}

.print-table th {
  background: #f1f5f9;
  color: #0f172a;
  font-weight: 700;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.print-table tbody tr:nth-child(even) {
  background: #fafcff;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.col-no {
  width: 36px;
  text-align: center !important;
}

.col-num {
  text-align: right !important;
}

.nowrap {
  white-space: nowrap !important;
}

.sub-text {
  margin-top: 2px;
  font-size: 10px;
  color: #475569;
}

.status-pill {
  display: inline-block;
  padding: 2px 7px;
  border-radius: 999px;
  border: 1px solid #94a3b8;
  font-size: 10px;
  font-weight: 700;
  color: #0f172a;
  background: #f8fafc;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.status-pill.available,
.status-pill.returned,
.status-pill.completed {
  background: #dcfce7;
  border-color: #86efac;
  color: #14532d;
}

.status-pill.borrowed,
.status-pill.repairing,
.status-pill.approved {
  background: #dbeafe;
  border-color: #93c5fd;
  color: #1e3a8a;
}

.status-pill.pending,
.status-pill.reported,
.status-pill.received,
.status-pill.diagnosing {
  background: #fef3c7;
  border-color: #fcd34d;
  color: #78350f;
}

.status-pill.overdue,
.status-pill.damaged,
.status-pill.lost,
.status-pill.rejected,
.status-pill.cancelled {
  background: #fee2e2;
  border-color: #fca5a5;
  color: #7f1d1d;
}

.tfoot-label {
  text-align: right !important;
  font-weight: 700;
  background: #f8fafc;
}

.tfoot-total {
  font-weight: 800;
  background: #f8fafc;
  color: #0f172a;
}

.signature-grid {
  margin-top: 28px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 32px;
  break-inside: avoid;
  page-break-inside: avoid;
}

.sig-box {
  text-align: center;
  font-size: 11.5px;
  color: #1e293b;
  line-height: 1.8;
}

.sig-line {
  margin-bottom: 4px;
}

.sig-name {
  font-weight: 700;
}

.sig-role {
  color: #475569;
  font-size: 11px;
}

.loading-box,
.empty-box {
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  padding: 28px;
  text-align: center;
  color: #64748b;
  font-size: 13px;
}

.alert-error {
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #fca5a5;
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 14px;
  font-size: 12.5px;
}

@media (max-width: 768px) {
  .print-toolbar {
    padding: 12px 14px;
  }
  .print-canvas {
    padding: 12px 8px;
  }
  .print-sheet {
    padding: 14px;
  }
  .doc-header {
    flex-direction: column;
  }
  .doc-meta {
    text-align: left;
  }
  .signature-grid {
    grid-template-columns: 1fr;
    gap: 20px;
  }
}

@media print {
  .no-print {
    display: none !important;
  }
  .print-page-root {
    background: #ffffff !important;
    min-height: auto;
  }
  .print-canvas {
    padding: 0 !important;
    margin: 0 !important;
  }
  .print-sheet,
  .print-sheet.landscape,
  .print-sheet.portrait {
    max-width: none !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    box-shadow: none !important;
    border-radius: 0 !important;
  }
}
</style>
