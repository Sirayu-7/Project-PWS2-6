<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>จัดการอุปกรณ์</h1>
        <p>ทะเบียนและสถานะอุปกรณ์ไอทีทั้งหมดในระบบ</p>
      </div>
      <button v-if="canEdit" class="primary" @click="openCreate">+ เพิ่มอุปกรณ์</button>
    </div>

    <div v-if="error" class="alert error">{{ error }}</div>
    <div v-if="success" class="alert success">{{ success }}</div>

    <div class="toolbar">
      <input v-model="search" @input="loadEquipment" placeholder="ค้นหารหัสทรัพย์สิน ชื่อ รุ่น Serial..." />
      <select v-model="status" @change="loadEquipment">
        <option value="">ทุกสถานะ</option>
        <option v-for="s in statuses" :key="s" :value="s">{{ statusText(s) }}</option>
      </select>
      <select v-model="categoryId" @change="loadEquipment">
        <option value="">ทุกหมวดหมู่</option>
        <option v-for="c in categories" :key="c.category_id" :value="c.category_id">{{ c.category_name }}</option>
      </select>
    </div>

    <div class="table-card">
      <div class="table-info">พบ {{ equipment.length }} รายการ</div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>รหัสทรัพย์สิน</th>
              <th>อุปกรณ์</th>
              <th>หมวดหมู่</th>
              <th>ยี่ห้อ / รุ่น</th>
              <th>Serial Number</th>
              <th>สถานะ</th>
              <th>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in equipment" :key="item.equipment_id">
              <td><b>{{ item.asset_code }}</b></td>
              <td>{{ item.equipment_name }}</td>
              <td>{{ item.category_name || '-' }}</td>
              <td>{{ [item.brand, item.model].filter(Boolean).join(' / ') || '-' }}</td>
              <td>{{ item.serial_number || '-' }}</td>
              <td><span class="badge" :class="item.status.toLowerCase()">{{ statusText(item.status) }}</span></td>
              <td class="actions">
                <button class="btn-info" @click="openDetail(item)">รายละเอียด</button>
                <button v-if="item.status === 'Available'" class="btn-borrow" @click="openBorrow(item)">ขอยืม</button>
                <button v-if="canEdit" @click="openEdit(item)">แก้ไข</button>
                <button v-if="isAdmin" class="danger-text" @click="remove(item)">ลบ</button>
              </td>
            </tr>
            <tr v-if="!loading && !equipment.length">
              <td colspan="7" class="empty">ไม่พบข้อมูลอุปกรณ์</td>
            </tr>
            <tr v-if="loading">
              <td colspan="7" class="empty">กำลังโหลด...</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Detail Modal with History Tabs -->
    <div v-if="detailItem" class="modal-backdrop" @click.self="detailItem = null">
      <div class="modal detail-modal">
        <div class="modal-head">
          <div>
            <h2>รายละเอียดอุปกรณ์: {{ detailItem.asset_code }}</h2>
            <p class="sub">{{ detailItem.equipment_name }}</p>
          </div>
          <button @click="detailItem = null">×</button>
        </div>

        <div class="tabs">
          <button :class="{ active: detailTab === 'info' }" @click="detailTab = 'info'">ข้อมูลทั่วไป</button>
          <button :class="{ active: detailTab === 'loans' }" @click="detailTab = 'loans'">
            ประวัติการยืม-คืน ({{ history.loans.length }})
          </button>
          <button :class="{ active: detailTab === 'repairs' }" @click="detailTab = 'repairs'">
            ประวัติการซ่อม ({{ history.repairs.length }})
          </button>
        </div>

        <!-- Tab 1: General Info -->
        <div v-if="detailTab === 'info'" class="tab-content">
          <div class="detail-grid">
            <div><small>รหัสทรัพย์สิน</small><strong>{{ detailItem.asset_code }}</strong></div>
            <div><small>ชื่ออุปกรณ์</small><strong>{{ detailItem.equipment_name }}</strong></div>
            <div><small>หมวดหมู่</small><strong>{{ detailItem.category_name || '-' }}</strong></div>
            <div><small>ยี่ห้อ / รุ่น</small><strong>{{ [detailItem.brand, detailItem.model].filter(Boolean).join(' / ') || '-' }}</strong></div>
            <div><small>Serial Number</small><strong>{{ detailItem.serial_number || '-' }}</strong></div>
            <div>
              <small>สถานะ</small>
              <span class="badge" :class="detailItem.status.toLowerCase()">{{ statusText(detailItem.status) }}</span>
            </div>
            <div><small>วันที่จัดซื้อ</small><strong>{{ detailItem.purchase_date ? String(detailItem.purchase_date).slice(0, 10) : '-' }}</strong></div>
            <div><small>รายละเอียด</small><strong>{{ detailItem.description || '-' }}</strong></div>
          </div>
        </div>

        <!-- Tab 2: Loans History -->
        <div v-if="detailTab === 'loans'" class="tab-content">
          <div v-if="historyLoading" class="empty">กำลังโหลดประวัติ...</div>
          <div v-else-if="!history.loans.length" class="empty">ยังไม่มีประวัติการยืมอุปกรณ์นี้</div>
          <div v-else class="table-wrap mini-table">
            <table>
              <thead>
                <tr>
                  <th>ผู้ยืม</th>
                  <th>วันที่ยืม</th>
                  <th>กำหนดคืน</th>
                  <th>วันที่คืนจริง</th>
                  <th>สถานะ</th>
                  <th>วัตถุประสงค์</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="l in history.loans" :key="l.loan_id">
                  <td><b>{{ l.borrower_name }}</b></td>
                  <td>{{ formatDate(l.borrow_date || l.request_date) }}</td>
                  <td>{{ formatDate(l.due_date) }}</td>
                  <td>{{ l.return_date ? formatDate(l.return_date) : '-' }}</td>
                  <td><span class="badge" :class="l.status.toLowerCase()">{{ loanLabel(l.status) }}</span></td>
                  <td><small>{{ l.purpose || '-' }}</small></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Tab 3: Repairs History -->
        <div v-if="detailTab === 'repairs'" class="tab-content">
          <div v-if="historyLoading" class="empty">กำลังโหลดประวัติ...</div>
          <div v-else-if="!history.repairs.length" class="empty">ยังไม่มีประวัติการซ่อมบำรุง</div>
          <div v-else class="table-wrap mini-table">
            <table>
              <thead>
                <tr>
                  <th>วันที่แจ้ง</th>
                  <th>ปัญหา</th>
                  <th>ผู้แจ้ง</th>
                  <th>ช่างผู้รับผิดชอบ</th>
                  <th>สถานะ</th>
                  <th>ค่าซ่อม</th>
                  <th>วิธีแก้ไข</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in history.repairs" :key="r.maintenance_id">
                  <td>{{ formatDate(r.reported_at) }}</td>
                  <td><b>{{ r.problem_type }}</b><br/><small>{{ r.problem_description }}</small></td>
                  <td>{{ r.reporter_name }}</td>
                  <td>{{ r.technician_name || '-' }}</td>
                  <td><span class="badge" :class="r.status.toLowerCase()">{{ maintLabel(r.status) }}</span></td>
                  <td>{{ r.repair_cost > 0 ? '฿' + Number(r.repair_cost).toLocaleString() : '-' }}</td>
                  <td><small>{{ r.solution || '-' }}</small></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="modal-footer-actions">
          <button v-if="detailItem.status === 'Available'" class="primary" @click="openBorrow(detailItem)">
            + ขอยืมอุปกรณ์นี้
          </button>
          <button v-if="!['Retired', 'Lost'].includes(detailItem.status)" class="warning-btn" @click="openMaintenance(detailItem)">
            ⚒ แจ้งซ่อมอุปกรณ์นี้
          </button>
          <button class="secondary" @click="detailItem = null">ปิด</button>
        </div>
      </div>
    </div>

    <!-- Quick Borrow Modal -->
    <div v-if="showBorrowModal" class="modal-backdrop" @click.self="showBorrowModal = false">
      <div class="modal">
        <div class="modal-head">
          <div>
            <h2>ส่งคำขอยืมอุปกรณ์</h2>
            <p class="sub">{{ borrowTarget?.asset_code }} — {{ borrowTarget?.equipment_name }}</p>
          </div>
          <button @click="showBorrowModal = false">×</button>
        </div>
        <form @submit.prevent="submitBorrow">
          <div class="form-grid">
            <label class="full">
              วันครบกำหนดคืน*
              <input v-model="borrowForm.due_date" type="date" required :min="today" />
            </label>
            <label class="full">
              วัตถุประสงค์ในการยืม*
              <textarea v-model.trim="borrowForm.purpose" rows="3" required placeholder="ระบุเหตุผลในการยืมไปใช้งาน"></textarea>
            </label>
            <label class="full">
              หมายเหตุเพิ่มเติม
              <textarea v-model.trim="borrowForm.remark" rows="2" placeholder="เช่น สถานที่ใช้งาน, เบอร์ติดต่อ"></textarea>
            </label>
          </div>
          <div v-if="borrowError" class="alert error">{{ borrowError }}</div>
          <div class="modal-actions">
            <button type="button" @click="showBorrowModal = false">ยกเลิก</button>
            <button class="primary" :disabled="submittingBorrow">
              {{ submittingBorrow ? 'กำลังส่งคำขอ...' : 'ยืนยันส่งคำขอยืม' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Quick Maintenance Modal -->
    <div v-if="showMaintModal" class="modal-backdrop" @click.self="showMaintModal = false">
      <div class="modal">
        <div class="modal-head">
          <div>
            <h2>แจ้งซ่อมอุปกรณ์</h2>
            <p class="sub">{{ maintTarget?.asset_code }} — {{ maintTarget?.equipment_name }}</p>
          </div>
          <button @click="showMaintModal = false">×</button>
        </div>
        <form @submit.prevent="submitMaintenance">
          <div class="form-grid">
            <label class="full">
              ประเภทปัญหา*
              <input v-model.trim="maintForm.problem_type" required placeholder="เช่น จอฟ้า, เปิดไม่ติด, สายชาร์จขาด..." />
            </label>
            <label class="full">
              ระดับความเร่งด่วน
              <select v-model="maintForm.priority">
                <option value="Low">Low (ต่ำ)</option>
                <option value="Normal">Normal (ปกติ)</option>
                <option value="High">High (สูง)</option>
                <option value="Urgent">Urgent (เร่งด่วนมาก)</option>
              </select>
            </label>
            <label class="full">
              รายละเอียดอาการเสีย*
              <textarea v-model.trim="maintForm.problem_description" rows="4" required placeholder="อธิบายอาการที่เกิดขึ้นอย่างละเอียด"></textarea>
            </label>
          </div>
          <div v-if="maintError" class="alert error">{{ maintError }}</div>
          <div class="modal-actions">
            <button type="button" @click="showMaintModal = false">ยกเลิก</button>
            <button class="primary" :disabled="submittingMaint">
              {{ submittingMaint ? 'กำลังส่งเรื่อง...' : 'ยืนยันแจ้งซ่อม' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Create / Edit Equipment Modal -->
    <div v-if="showModal" class="modal-backdrop" @click.self="closeModal">
      <div class="modal">
        <div class="modal-head">
          <h2>{{ editing ? 'แก้ไขอุปกรณ์' : 'เพิ่มอุปกรณ์' }}</h2>
          <button @click="closeModal">×</button>
        </div>
        <form @submit.prevent="save">
          <div class="form-grid">
            <label>
              หมวดหมู่*
              <select v-model="form.category_id" required>
                <option value="">เลือกหมวดหมู่</option>
                <option v-for="c in categories" :key="c.category_id" :value="c.category_id">{{ c.category_name }}</option>
              </select>
            </label>
            <label>
              รหัสทรัพย์สิน*
              <input v-model.trim="form.asset_code" required />
            </label>
            <label>
              ชื่ออุปกรณ์*
              <input v-model.trim="form.equipment_name" required />
            </label>
            <label>
              ยี่ห้อ
              <input v-model.trim="form.brand" />
            </label>
            <label>
              รุ่น
              <input v-model.trim="form.model" />
            </label>
            <label>
              Serial Number
              <input v-model.trim="form.serial_number" />
            </label>
            <label>
              วันที่จัดซื้อ
              <input v-model="form.purchase_date" type="date" />
            </label>
            <label>
              สถานะ
              <select v-model="form.status" required>
                <option v-for="s in statuses" :key="s" :value="s">{{ statusText(s) }}</option>
              </select>
            </label>
            <label class="full">
              รายละเอียด
              <textarea v-model.trim="form.description" rows="3"></textarea>
            </label>
          </div>
          <div v-if="formError" class="alert error">{{ formError }}</div>
          <div class="modal-actions">
            <button type="button" @click="closeModal">ยกเลิก</button>
            <button class="primary" :disabled="saving">{{ saving ? 'กำลังบันทึก...' : 'บันทึก' }}</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import api from '../services/api'
import { useAuthStore } from '../stores/auth'
import { useAutoRefresh } from '../composables/useAutoRefresh'

const auth = useAuthStore()
const equipment = ref([])
const categories = ref([])
const search = ref('')
const status = ref('')
const categoryId = ref('')
const loading = ref(false)
const error = ref('')
const success = ref('')
const showModal = ref(false)
const editing = ref(null)
const detailItem = ref(null)
const detailTab = ref('info')
const saving = ref(false)
const formError = ref('')

// History in detail
const history = ref({ loans: [], repairs: [] })
const historyLoading = ref(false)

// Quick Borrow Modal
const showBorrowModal = ref(false)
const borrowTarget = ref(null)
const borrowForm = ref({ due_date: '', purpose: '', remark: '' })
const borrowError = ref('')
const submittingBorrow = ref(false)

// Quick Maintenance Modal
const showMaintModal = ref(false)
const maintTarget = ref(null)
const maintForm = ref({ problem_type: '', problem_description: '', priority: 'Normal' })
const maintError = ref('')
const submittingMaint = ref(false)

const today = new Date().toISOString().slice(0, 10)
const statuses = ['Available', 'Borrowed', 'Reserved', 'Maintenance', 'Damaged', 'Lost', 'Retired']
const form = ref(blank())
const isAdmin = computed(() => auth.role === 'Administrator')
const canEdit = computed(() => isAdmin.value || auth.role === 'Staff')

function blank() {
  return {
    category_id: '',
    asset_code: '',
    equipment_name: '',
    brand: '',
    model: '',
    serial_number: '',
    purchase_date: '',
    status: 'Available',
    description: '',
  }
}

function statusText(s) {
  return (
    {
      Available: 'พร้อมใช้งาน',
      Borrowed: 'กำลังถูกยืม',
      Reserved: 'จอง',
      Maintenance: 'กำลังซ่อม',
      Damaged: 'ชำรุด',
      Lost: 'สูญหาย',
      Retired: 'จำหน่ายแล้ว',
    }[s] || s
  )
}

const loanLabel = (s) =>
  ({
    Pending: 'รออนุมัติ',
    Approved: 'อนุมัติแล้ว',
    Borrowed: 'กำลังยืม',
    Returned: 'คืนแล้ว',
    Overdue: 'เกินกำหนด',
    Rejected: 'ปฏิเสธ',
  }[s] || s)

const maintLabel = (s) =>
  ({
    Reported: 'แจ้งแล้ว',
    Received: 'รับเรื่อง',
    Diagnosing: 'กำลังตรวจสอบ',
    Repairing: 'กำลังซ่อม',
    Completed: 'เสร็จสิ้น',
    Cancelled: 'ยกเลิก',
  }[s] || s)

const formatDate = (v) => (v ? new Date(v).toLocaleDateString('th-TH') : '-')

async function loadCategories() {
  const { data } = await api.get('/equipment/categories')
  categories.value = data.data || []
}

async function loadEquipment() {
  loading.value = true
  error.value = ''
  try {
    const { data } = await api.get('/equipment', {
      params: { search: search.value, status: status.value, category_id: categoryId.value },
    })
    equipment.value = data.data || []
  } catch (e) {
    error.value = e.response?.data?.message || 'ไม่สามารถโหลดรายการอุปกรณ์ได้'
  } finally {
    loading.value = false
  }
}

async function openDetail(item) {
  detailItem.value = item
  detailTab.value = 'info'
  history.value = { loans: [], repairs: [] }
  historyLoading.value = true
  try {
    const { data } = await api.get(`/equipment/${item.equipment_id}/history`)
    history.value = data.data || { loans: [], repairs: [] }
  } catch (e) {
    console.error('History load error:', e)
  } finally {
    historyLoading.value = false
  }
}

function openCreate() {
  editing.value = null
  form.value = blank()
  formError.value = ''
  showModal.value = true
}

function openEdit(item) {
  editing.value = item
  form.value = {
    category_id: String(item.category_id || ''),
    asset_code: item.asset_code,
    equipment_name: item.equipment_name,
    brand: item.brand || '',
    model: item.model || '',
    serial_number: item.serial_number || '',
    purchase_date: item.purchase_date ? String(item.purchase_date).slice(0, 10) : '',
    status: item.status,
    description: item.description || '',
  }
  formError.value = ''
  showModal.value = true
}

function closeModal() {
  showModal.value = false
}

async function save() {
  saving.value = true
  formError.value = ''
  success.value = ''
  try {
    if (editing.value) await api.put(`/equipment/${editing.value.equipment_id}`, form.value)
    else await api.post('/equipment', form.value)
    success.value = 'บันทึกข้อมูลอุปกรณ์สำเร็จ'
    closeModal()
    await loadEquipment()
  } catch (e) {
    formError.value = e.response?.data?.message || 'ไม่สามารถบันทึกข้อมูลได้'
  } finally {
    saving.value = false
  }
}

async function remove(item) {
  if (!confirm(`ต้องการลบ ${item.asset_code} (${item.equipment_name}) ใช่หรือไม่?`)) return
  error.value = ''
  success.value = ''
  try {
    await api.delete(`/equipment/${item.equipment_id}`)
    success.value = `ลบ ${item.asset_code} สำเร็จ`
    await loadEquipment()
  } catch (e) {
    error.value = e.response?.data?.message || 'ไม่สามารถลบอุปกรณ์ได้'
  }
}

// Quick Borrow Actions
function openBorrow(item) {
  borrowTarget.value = item
  borrowForm.value = { due_date: '', purpose: '', remark: '' }
  borrowError.value = ''
  showBorrowModal.value = true
}

async function submitBorrow() {
  submittingBorrow.value = true
  borrowError.value = ''
  try {
    await api.post('/loan', {
      equipment_id: borrowTarget.value.equipment_id,
      due_date: borrowForm.value.due_date,
      purpose: borrowForm.value.purpose,
      remark: borrowForm.value.remark,
    })
    success.value = `ส่งคำขอยืม ${borrowTarget.value.asset_code} สำเร็จ (รออนุมัติ)`
    showBorrowModal.value = false
    if (detailItem.value) detailItem.value = null
    await loadEquipment()
  } catch (e) {
    borrowError.value = e.response?.data?.message || 'ไม่สามารถส่งคำขอยืมได้'
  } finally {
    submittingBorrow.value = false
  }
}

// Quick Maintenance Actions
function openMaintenance(item) {
  maintTarget.value = item
  maintForm.value = { problem_type: '', problem_description: '', priority: 'Normal' }
  maintError.value = ''
  showMaintModal.value = true
}

async function submitMaintenance() {
  submittingMaint.value = true
  maintError.value = ''
  try {
    await api.post('/maintenance', {
      equipment_id: maintTarget.value.equipment_id,
      problem_type: maintForm.value.problem_type,
      problem_description: maintForm.value.problem_description,
      priority: maintForm.value.priority,
    })
    success.value = `แจ้งซ่อม ${maintTarget.value.asset_code} สำเร็จ`
    showMaintModal.value = false
    if (detailItem.value) detailItem.value = null
    await loadEquipment()
  } catch (e) {
    maintError.value = e.response?.data?.message || 'ไม่สามารถแจ้งซ่อมได้'
  } finally {
    submittingMaint.value = false
  }
}

onMounted(async () => {
  try {
    await loadCategories()
    await loadEquipment()
  } catch (e) {
    error.value = 'ไม่สามารถเชื่อมต่อข้อมูลได้'
  }
})

useAutoRefresh(loadEquipment)
</script>

<style scoped>
.page {
  padding: 0;
  max-width: 1500px;
  margin: auto;
}
.page-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}
.page-head h1 {
  margin: 0;
  font-size: 24px;
}
.page-head p {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 13px;
}
.primary {
  border: 0;
  background: #2563eb;
  color: #fff;
  border-radius: 8px;
  padding: 10px 16px;
  font-weight: 600;
  cursor: pointer;
}
.primary:disabled {
  opacity: 0.6;
}
.toolbar {
  display: grid;
  grid-template-columns: 1fr 200px 200px;
  gap: 10px;
  margin-bottom: 16px;
}
.toolbar input,
.toolbar select,
.form-grid input,
.form-grid select,
.form-grid textarea {
  width: 100%;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 10px;
  background: #fff;
  box-sizing: border-box;
}
.table-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
}
.table-info {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 10px;
}
.table-wrap {
  overflow: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
th {
  text-align: left;
  background: #f8fafc;
  color: #475569;
  padding: 12px;
  white-space: nowrap;
}
td {
  padding: 12px;
  border-top: 1px solid #eef2f7;
  white-space: nowrap;
}
.badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 99px;
  font-size: 11px;
  font-weight: 600;
  background: #e2e8f0;
  color: #475569;
}
.badge.available {
  background: #dcfce7;
  color: #166534;
}
.badge.borrowed {
  background: #dbeafe;
  color: #1d4ed8;
}
.badge.maintenance {
  background: #fef3c7;
  color: #92400e;
}
.badge.damaged,
.badge.lost {
  background: #fee2e2;
  color: #b91c1c;
}
.badge.reserved {
  background: #ede9fe;
  color: #6d28d9;
}
.badge.retired {
  background: #e5e7eb;
  color: #374151;
}
.actions {
  display: flex;
  gap: 6px;
}
.actions button {
  border: 0;
  background: #eff6ff;
  color: #2563eb;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
}
.actions .btn-info {
  background: #f1f5f9;
  color: #334155;
  font-weight: 600;
}
.actions .btn-borrow {
  background: #ecfdf5;
  color: #059669;
  font-weight: 700;
}
.actions .danger-text {
  background: #fef2f2;
  color: #dc2626;
}
.empty {
  text-align: center;
  color: #94a3b8;
  padding: 30px;
}
.alert {
  padding: 11px 14px;
  border-radius: 8px;
  margin-bottom: 14px;
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
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: grid;
  place-items: center;
  padding: 20px;
  z-index: 40;
}
.modal {
  width: min(650px, 100%);
  max-height: calc(100dvh - 32px);
  overflow: auto;
  background: #fff;
  border-radius: 14px;
  padding: 20px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
}
.detail-modal {
  width: min(850px, 100%);
}
.modal-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
}
.modal-head h2 {
  margin: 0;
  font-size: 19px;
}
.modal-head .sub {
  margin: 3px 0 0;
  color: #64748b;
  font-size: 13px;
}
.modal-head button {
  border: 0;
  background: transparent;
  font-size: 26px;
  cursor: pointer;
  line-height: 1;
}
.tabs {
  display: flex;
  gap: 8px;
  border-bottom: 1px solid #e2e8f0;
  margin-bottom: 16px;
  overflow-x: auto;
  white-space: nowrap;
  -webkit-overflow-scrolling: touch;
}
.tabs button {
  border: 0;
  background: transparent;
  padding: 9px 14px;
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  flex-shrink: 0;
}
.tabs button.active {
  color: #2563eb;
  border-bottom-color: #2563eb;
}
.tab-content {
  min-height: 180px;
}
.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.detail-grid div {
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 9px;
  background: #f8fafc;
}
.detail-grid small,
.detail-grid strong {
  display: block;
}
.detail-grid small {
  font-size: 11px;
  color: #64748b;
}
.detail-grid strong {
  margin-top: 4px;
  font-size: 13px;
}
.mini-table table {
  font-size: 12px;
}
.mini-table th,
.mini-table td {
  padding: 9px 10px;
}
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.form-grid label {
  font-size: 12px;
  font-weight: 600;
  color: #334155;
}
.full {
  grid-column: 1 / -1;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;
}
.modal-actions > button:first-child {
  border: 1px solid #cbd5e1;
  background: #fff;
  border-radius: 8px;
  padding: 10px 16px;
  cursor: pointer;
}
.modal-footer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 22px;
  padding-top: 16px;
  border-top: 1px solid #e2e8f0;
}
.warning-btn {
  border: 0;
  background: #f59e0b;
  color: #fff;
  border-radius: 8px;
  padding: 10px 16px;
  font-weight: 600;
  cursor: pointer;
}
.secondary {
  border: 1px solid #cbd5e1;
  background: #fff;
  border-radius: 8px;
  padding: 10px 16px;
  cursor: pointer;
}
@media (max-width: 860px) {
  .toolbar {
    grid-template-columns: 1fr 1fr;
  }
  .toolbar input {
    grid-column: 1 / -1;
  }
}
@media (max-width: 700px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
  .full {
    grid-column: auto;
  }
  .detail-grid {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 640px) {
  .page-head {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  .page-head .primary {
    width: 100%;
    text-align: center;
  }
  .table-card {
    padding: 14px;
  }
}
@media (max-width: 540px) {
  .toolbar {
    grid-template-columns: 1fr;
  }
  .toolbar input {
    grid-column: auto;
  }
  .modal-footer-actions,
  .modal-actions {
    flex-wrap: wrap;
  }
  .modal-footer-actions > button,
  .modal-actions > button {
    flex: 1 1 100%;
    text-align: center;
  }
}
@media (max-width: 480px) {
  .modal-backdrop {
    padding: 12px;
  }
  .modal {
    padding: 16px;
    max-height: calc(100dvh - 24px);
  }
}
</style>
