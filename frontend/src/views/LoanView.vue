<template>
  <main class="page">
    <div class="head">
      <div>
        <h1>การยืม-คืนอุปกรณ์</h1>
        <p>สร้างคำขอยืม ติดตามสถานะ และดำเนินการอนุมัติ/คืนอุปกรณ์</p>
      </div>
      <button v-if="canRequest" class="primary" @click="openCreate">+ สร้างคำขอยืม</button>
    </div>

    <div v-if="error" class="alert error">{{ error }}</div>
    <div v-if="success" class="alert success">{{ success }}</div>

    <div v-if="overdueCount > 0" class="alert warning">
      ⚠️ มีอุปกรณ์ที่<b>เกินกำหนดส่งคืน {{ overdueCount }} รายการ</b> กรุณาติดต่อผู้ยืมเพื่อส่งคืนอุปกรณ์
    </div>

    <section class="filters">
      <input v-model="search" @keyup.enter="load" placeholder="ค้นหารหัสทรัพย์สิน ชื่ออุปกรณ์ หรือผู้ยืม..." />
      <select v-model="status" @change="load">
        <option value="">ทุกสถานะ</option>
        <option v-for="s in statuses" :key="s" :value="s">{{ label(s) }}</option>
      </select>
      <button class="btn" @click="load">ค้นหา</button>
    </section>

    <section class="card">
      <div v-if="loading" class="empty">กำลังโหลด...</div>
      <div v-else-if="!items.length" class="empty">ยังไม่มีรายการยืม-คืน</div>
      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>อุปกรณ์</th>
              <th>ผู้ยืม</th>
              <th>วันที่ขอยืม / วันที่ยืม</th>
              <th>ครบกำหนดคืน</th>
              <th>วันที่คืนจริง</th>
              <th>ผู้อนุมัติ</th>
              <th>สถานะ</th>
              <th>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="x in items" :key="x.loan_id">
              <td>
                <b>{{ x.asset_code }}</b>
                <small>{{ x.equipment_name }}</small>
              </td>
              <td>
                <b>{{ x.borrower_name }}</b>
                <small>@{{ x.borrower_username }}</small>
              </td>
              <td>{{ fmt(x.borrow_date || x.request_date) }}</td>
              <td>
                <span :class="{ 'text-danger': x.status === 'Overdue' }">{{ fmtDate(x.due_date) }}</span>
              </td>
              <td>{{ x.return_date ? fmt(x.return_date) : '-' }}</td>
              <td>{{ x.approver_name || '-' }}</td>
              <td>
                <span :class="['badge', x.status.toLowerCase()]">{{ label(x.status) }}</span>
              </td>
              <td class="actions">
                <button v-if="x.status === 'Pending' && canApprove" class="btn-approve" @click="approve(x.loan_id)">
                  อนุมัติ
                </button>
                <button v-if="x.status === 'Pending' && canApprove" class="danger" @click="reject(x.loan_id)">
                  ปฏิเสธ
                </button>
                <button v-if="['Borrowed', 'Overdue'].includes(x.status) && (canApprove || isSelf(x))" class="btn-return" @click="openReturn(x)">
                  รับคืน
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Modal Create / Return -->
    <div v-if="modal" class="overlay" @click.self="modal = ''">
      <div class="modal">
        <button class="close" @click="modal = ''">×</button>
        <h2>{{ modal === 'create' ? 'สร้างคำขอยืมอุปกรณ์' : 'รับคืนอุปกรณ์' }}</h2>

        <!-- Create Loan Form -->
        <form v-if="modal === 'create'" @submit.prevent="createLoan">
          <label>
            เลือกอุปกรณ์ที่ต้องการยืม*
            <select v-model="form.equipment_id" required>
              <option value="">-- เลือกอุปกรณ์ (เฉพาะที่พร้อมใช้งาน) --</option>
              <option v-for="e in available" :key="e.equipment_id" :value="e.equipment_id">
                {{ e.asset_code }} — {{ e.equipment_name }} ({{ e.category_name || 'ทั่วไป' }})
              </option>
            </select>
          </label>
          <label>
            วันครบกำหนดคืน*
            <input v-model="form.due_date" type="date" required :min="today" />
          </label>
          <label>
            วัตถุประสงค์ในการยืม*
            <textarea v-model="form.purpose" rows="3" required placeholder="ระบุเหตุผลในการยืมไปใช้งาน"></textarea>
          </label>
          <label>
            หมายเหตุ
            <textarea v-model="form.remark" rows="2" placeholder="เช่น สถานที่ใช้งาน, ข้อมูลติดต่อ"></textarea>
          </label>
          <button class="primary full" :disabled="saving">
            {{ saving ? 'กำลังบันทึก...' : 'ส่งคำขอยืม' }}
          </button>
        </form>

        <!-- Return Loan Form -->
        <form v-else @submit.prevent="returnLoan">
          <div class="return-info">
            <b>{{ selected.asset_code }}</b> — {{ selected.equipment_name }}
            <br />
            <small>ผู้ยืม: {{ selected.borrower_name }} | ครบกำหนด: {{ fmtDate(selected.due_date) }}</small>
          </div>

          <label>
            สภาพอุปกรณ์ขณะรับคืน*
            <select v-model="returnForm.condition_status" @change="onConditionChange">
              <option value="Normal">Normal (ปกติ สมบูรณ์)</option>
              <option value="Minor Damage">Minor Damage (เสียหายเล็กน้อย)</option>
              <option value="Major Damage">Major Damage (เสียหายมาก / ใช้งานไม่ได้)</option>
              <option value="Lost">Lost (สูญหาย)</option>
            </select>
          </label>

          <label>
            หมายเหตุการตรวจสภาพ
            <textarea v-model="returnForm.remark" rows="3" placeholder="ระบุรายละเอียดสภาพของอุปกรณ์"></textarea>
          </label>

          <!-- Maintenance Option when Damaged -->
          <div v-if="['Minor Damage', 'Major Damage'].includes(returnForm.condition_status)" class="maintenance-box">
            <label class="checkbox-label">
              <input type="checkbox" v-model="returnForm.create_maintenance" />
              <span>ส่งเข้าคิวแจ้งซ่อมบำรุงทันที (Auto-create Maintenance Ticket)</span>
            </label>
            <div v-if="returnForm.create_maintenance" class="maint-fields">
              <label>
                ประเภทปัญหา
                <input v-model="returnForm.problem_type" placeholder="เช่น อุปกรณ์ชำรุด, แตกหัก, ตกน้ำ" />
              </label>
              <label>
                รายละเอียดอาการเสีย
                <textarea v-model="returnForm.problem_description" rows="2" placeholder="อธิบายอาการเสียที่ต้องแก้ไข"></textarea>
              </label>
            </div>
          </div>

          <button class="primary full" :disabled="saving">
            {{ saving ? 'กำลังบันทึก...' : 'ยืนยันการรับคืน' }}
          </button>
        </form>
      </div>
    </div>
  </main>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../services/api'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const items = ref([])
const available = ref([])
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const success = ref('')
const search = ref('')
const status = ref('')
const modal = ref('')
const selected = ref(null)

const today = new Date().toISOString().slice(0, 10)
const form = ref({ equipment_id: '', due_date: '', purpose: '', remark: '' })
const returnForm = ref({
  condition_status: 'Normal',
  remark: '',
  create_maintenance: false,
  problem_type: '',
  problem_description: '',
})

const statuses = ['Pending', 'Approved', 'Borrowed', 'Returned', 'Overdue', 'Rejected']
const canApprove = computed(() => ['Administrator', 'Staff'].includes(auth.role))
const canRequest = computed(() => !!auth.user)

const overdueCount = computed(() => items.value.filter((i) => i.status === 'Overdue').length)

const labels = {
  Pending: 'รออนุมัติ',
  Approved: 'อนุมัติแล้ว',
  Rejected: 'ปฏิเสธ',
  Borrowed: 'กำลังยืม',
  Returned: 'คืนแล้ว',
  Overdue: 'เกินกำหนด',
}
const label = (s) => labels[s] || s

const fmt = (v) => (v ? new Date(v).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '-')
const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('th-TH') : '-')

const isSelf = (x) => x.borrower_id === auth.user?.id

function onConditionChange() {
  if (['Minor Damage', 'Major Damage'].includes(returnForm.value.condition_status)) {
    returnForm.value.create_maintenance = true
    returnForm.value.problem_type = `ชำรุดจากการยืม-คืน (${returnForm.value.condition_status})`
  } else {
    returnForm.value.create_maintenance = false
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const { data } = await api.get('/loan', {
      params: { search: search.value, status: status.value },
    })
    items.value = data.data || []
  } catch (e) {
    error.value = e.response?.data?.message || 'ไม่สามารถโหลดรายการยืม-คืนได้'
  } finally {
    loading.value = false
  }
}

async function loadAvailable() {
  try {
    const { data } = await api.get('/loan/available-equipment')
    available.value = data.data || []
  } catch (e) {
    error.value = e.response?.data?.message || 'ไม่สามารถโหลดอุปกรณ์ที่พร้อมยืมได้'
  }
}

function openCreate() {
  form.value = { equipment_id: '', due_date: '', purpose: '', remark: '' }
  modal.value = 'create'
  loadAvailable()
}

function openReturn(x) {
  selected.value = x
  returnForm.value = {
    condition_status: 'Normal',
    remark: '',
    create_maintenance: false,
    problem_type: '',
    problem_description: '',
  }
  modal.value = 'return'
}

async function createLoan() {
  saving.value = true
  error.value = ''
  success.value = ''
  try {
    await api.post('/loan', form.value)
    success.value = 'ส่งคำขอยืมสำเร็จ รอการตรวจสอบและอนุมัติจากเจ้าหน้าที่'
    modal.value = ''
    await load()
  } catch (e) {
    error.value = e.response?.data?.message || 'ไม่สามารถสร้างคำขอยืมได้'
  } finally {
    saving.value = false
  }
}

async function approve(id) {
  if (!confirm('ยืนยันอนุมัติการยืมรายการนี้?')) return
  error.value = ''
  success.value = ''
  try {
    await api.put(`/loan/${id}/approve`)
    success.value = 'อนุมัติการยืมสำเร็จ อุปกรณ์ถูกเปลี่ยนสถานะเป็น "กำลังยืม"'
    await load()
  } catch (e) {
    error.value = e.response?.data?.message || 'ไม่สามารถอนุมัติได้'
  }
}

async function reject(id) {
  const remark = prompt('เหตุผลที่ปฏิเสธ (ถ้ามี):', '')
  if (remark === null) return
  error.value = ''
  success.value = ''
  try {
    await api.put(`/loan/${id}/reject`, { remark })
    success.value = 'ปฏิเสธคำขอยืมเรียบร้อยแล้ว'
    await load()
  } catch (e) {
    error.value = e.response?.data?.message || 'ไม่สามารถปฏิเสธได้'
  }
}

async function returnLoan() {
  saving.value = true
  error.value = ''
  success.value = ''
  try {
    const { data } = await api.put(`/loan/${selected.value.loan_id}/return`, returnForm.value)
    success.value = data.message || 'บันทึกการคืนอุปกรณ์สำเร็จ'
    modal.value = ''
    await load()
  } catch (e) {
    error.value = e.response?.data?.message || 'ไม่สามารถบันทึกการคืนได้'
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.page {
  padding: 28px;
  max-width: 1500px;
  margin: auto;
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
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
.primary {
  border: 0;
  border-radius: 9px;
  padding: 11px 18px;
  background: #2563eb;
  color: #fff;
  font-weight: 700;
  cursor: pointer;
}
.filters {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}
.filters input {
  flex: 1;
}
.filters input,
.filters select,
.modal input,
.modal select,
.modal textarea {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 10px 12px;
  background: #fff;
  box-sizing: border-box;
}
.card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  overflow: hidden;
}
.table-wrap {
  overflow: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  min-width: 1100px;
}
th,
td {
  padding: 13px 14px;
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
}
.empty {
  text-align: center;
  padding: 50px;
  color: #94a3b8;
}
.badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  background: #e2e8f0;
}
.pending {
  background: #fef3c7;
  color: #92400e;
}
.approved {
  background: #e0e7ff;
  color: #4338ca;
}
.borrowed {
  background: #dbeafe;
  color: #1d4ed8;
}
.returned {
  background: #dcfce7;
  color: #166534;
}
.rejected {
  background: #fee2e2;
  color: #b91c1c;
}
.overdue {
  background: #ffedd5;
  color: #c2410c;
}
.text-danger {
  color: #dc2626;
  font-weight: 700;
}
.actions {
  white-space: nowrap;
}
.actions button {
  border: 0;
  border-radius: 6px;
  padding: 6px 10px;
  margin-right: 5px;
  cursor: pointer;
  font-size: 12px;
}
.actions .btn-approve {
  background: #dcfce7;
  color: #166534;
  font-weight: 700;
}
.actions .btn-return {
  background: #e0f2fe;
  color: #0369a1;
  font-weight: 700;
}
.actions .danger {
  background: #fee2e2;
  color: #b91c1c;
}
.alert {
  margin-bottom: 14px;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 13px;
}
.alert.error {
  background: #fef2f2;
  color: #b91c1c;
}
.alert.success {
  background: #dcfce7;
  color: #166534;
}
.alert.warning {
  background: #fff7ed;
  color: #c2410c;
  border: 1px solid #fed7aa;
}
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: grid;
  place-items: center;
  padding: 20px;
  z-index: 50;
}
.modal {
  position: relative;
  width: min(560px, 100%);
  max-height: 90vh;
  overflow: auto;
  background: #fff;
  border-radius: 16px;
  padding: 26px;
  box-shadow: 0 25px 60px rgba(15, 23, 42, 0.2);
}
.modal h2 {
  margin: 0 0 16px;
  font-size: 20px;
}
.modal form {
  display: grid;
  gap: 14px;
}
.modal label {
  font-size: 12px;
  font-weight: 700;
  color: #334155;
  display: block;
}
.modal label > * {
  display: block;
  width: 100%;
  margin-top: 6px;
}
.close {
  position: absolute;
  right: 15px;
  top: 15px;
  border: 0;
  background: none;
  font-size: 26px;
  color: #64748b;
  cursor: pointer;
}
.full {
  width: 100%;
  margin-top: 8px;
}
.return-info {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  padding: 14px;
  border-radius: 10px;
  font-size: 13px;
}
.maintenance-box {
  background: #fff7ed;
  border: 1px solid #fed7aa;
  padding: 14px;
  border-radius: 10px;
}
.checkbox-label {
  display: flex !important;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-weight: 600 !important;
  color: #9a3412 !important;
}
.checkbox-label input {
  width: auto !important;
  margin: 0 !important;
}
.maint-fields {
  margin-top: 12px;
  display: grid;
  gap: 10px;
}
@media (max-width: 700px) {
  .page {
    padding: 18px;
  }
  .head {
    align-items: flex-start;
    gap: 12px;
  }
  .filters {
    flex-wrap: wrap;
  }
  .filters input {
    flex-basis: 100%;
  }
}
</style>
