<template>
  <main class="page">
    <div class="head">
      <div>
        <h1>แจ้งซ่อมและบำรุงรักษา</h1>
        <p>แจ้งปัญหา ติดตามงานซ่อม บันทึกค่าใช้จ่าย และจัดการสถานะการบำรุงรักษา</p>
      </div>
      <button class="primary" @click="openCreate">+ แจ้งซ่อมอุปกรณ์</button>
    </div>

    <div v-if="error" class="alert error">{{ error }}</div>
    <div v-if="success" class="alert success">{{ success }}</div>

    <section class="filters">
      <input v-model="search" @keyup.enter="load" placeholder="ค้นหารหัสอุปกรณ์ ชื่ออุปกรณ์ อาการเสีย หรือผู้แจ้ง..." />
      <select v-model="status" @change="load">
        <option value="">ทุกสถานะ</option>
        <option v-for="s in statuses" :key="s" :value="s">{{ label(s) }}</option>
      </select>
      <select v-model="priority" @change="load">
        <option value="">ทุกความเร่งด่วน</option>
        <option v-for="p in priorities" :key="p" :value="p">{{ p }}</option>
      </select>
      <button class="btn" @click="load">ค้นหา</button>
    </section>

    <section class="card">
      <div v-if="loading" class="empty">กำลังโหลด...</div>
      <div v-else-if="!items.length" class="empty">ยังไม่มีรายการแจ้งซ่อม</div>
      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>อุปกรณ์</th>
              <th>ปัญหา / อาการเสีย</th>
              <th>ผู้แจ้ง</th>
              <th>ช่างผู้รับผิดชอบ</th>
              <th>ความเร่งด่วน</th>
              <th>สถานะ</th>
              <th>ค่าใช้จ่าย</th>
              <th>วันที่แจ้ง</th>
              <th>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="x in items" :key="x.maintenance_id">
              <td>
                <b>{{ x.asset_code }}</b>
                <small>{{ x.equipment_name }}</small>
              </td>
              <td>
                <b>{{ x.problem_type }}</b>
                <small>{{ x.problem_description }}</small>
              </td>
              <td>{{ x.reporter_name }}</td>
              <td>
                <span v-if="x.technician_name" class="tech-tag">👨‍🔧 {{ x.technician_name }}</span>
                <span v-else class="text-muted">-</span>
              </td>
              <td>
                <span :class="['priority', x.priority.toLowerCase()]">{{ x.priority }}</span>
              </td>
              <td>
                <span :class="['badge', x.status.toLowerCase()]">{{ label(x.status) }}</span>
              </td>
              <td>
                <b>{{ x.repair_cost > 0 ? '฿' + Number(x.repair_cost).toLocaleString() : '-' }}</b>
              </td>
              <td>{{ fmt(x.reported_at || x.created_at) }}</td>
              <td class="actions">
                <button class="btn-log" @click="openLogs(x)">ดูประวัติ</button>
                <button v-if="canManage" class="btn-update" @click="openUpdate(x)">อัปเดต</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Modal Create Maintenance -->
    <div v-if="modal === 'create'" class="overlay" @click.self="modal = ''">
      <div class="modal">
        <button class="close" @click="modal = ''">×</button>
        <h2>แจ้งซ่อมอุปกรณ์</h2>
        <form @submit.prevent="create">
          <label>
            เลือกอุปกรณ์ที่พบปัญหา*
            <select v-model="form.equipment_id" required>
              <option value="">-- เลือกอุปกรณ์ --</option>
              <option v-for="e in equipment" :key="e.equipment_id" :value="e.equipment_id">
                {{ e.asset_code }} — {{ e.equipment_name }} ({{ e.status }})
              </option>
            </select>
          </label>
          <label>
            ประเภทปัญหา*
            <input v-model.trim="form.problem_type" placeholder="เช่น เปิดเครื่องไม่ติด, ภาพไม่ขึ้น, พอร์ตชำรุด" required />
          </label>
          <label>
            รายละเอียดอาการเสียอย่างละเอียด*
            <textarea v-model.trim="form.problem_description" rows="4" required placeholder="อธิบายอาการที่เกิดขึ้น"></textarea>
          </label>
          <label>
            ระดับความเร่งด่วน
            <select v-model="form.priority">
              <option v-for="p in priorities" :key="p" :value="p">{{ p }}</option>
            </select>
          </label>
          <button class="primary full" :disabled="saving">
            {{ saving ? 'กำลังบันทึก...' : 'ส่งแจ้งซ่อม' }}
          </button>
        </form>
      </div>
    </div>

    <!-- Modal Update Status & Details -->
    <div v-if="modal === 'update'" class="overlay" @click.self="modal = ''">
      <div class="modal">
        <button class="close" @click="modal = ''">×</button>
        <h2>อัปเดตสถานะงานซ่อม #{{ selected?.maintenance_id }}</h2>
        <form @submit.prevent="update">
          <div class="return-info">
            <b>{{ selected?.asset_code }}</b> — {{ selected?.equipment_name }}
            <br />
            <small>ปัญหา: {{ selected?.problem_type }} (ผู้แจ้ง: {{ selected?.reporter_name }})</small>
          </div>

          <label>
            สถานะงานซ่อม*
            <select v-model="updateForm.status" required>
              <option v-for="s in statuses" :key="s" :value="s">{{ label(s) }}</option>
            </select>
          </label>

          <label>
            ช่าง / เจ้าหน้าที่ผู้รับผิดชอบ
            <select v-model="updateForm.technician_id">
              <option :value="null">-- ไม่ระบุ / มอบหมายภายหลัง --</option>
              <option v-for="t in technicians" :key="t.user_id" :value="t.user_id">
                {{ t.name }} ({{ t.role_name }})
              </option>
            </select>
          </label>

          <label>
            ค่าใช้จ่ายในการซ่อม (บาท)
            <input v-model.number="updateForm.repair_cost" type="number" min="0" step="0.01" placeholder="0.00" />
          </label>

          <label>
            วิธีแก้ไข / การดำเนินการ
            <textarea v-model.trim="updateForm.solution" rows="3" placeholder="ระบุชิ้นส่วนที่เปลี่ยน หรือวิธีแก้ไขปัญหา"></textarea>
          </label>

          <label>
            บันทึกความคืบหน้า (Log Remark)
            <input v-model.trim="updateForm.remark" placeholder="เช่น รออะไหล่, ซ่อมเสร็จทดสอบผ่านแล้ว" />
          </label>

          <button class="primary full" :disabled="saving">
            {{ saving ? 'กำลังบันทึก...' : 'บันทึกการอัปเดต' }}
          </button>
        </form>
      </div>
    </div>

    <!-- Modal View Logs & Timeline -->
    <div v-if="modal === 'logs'" class="overlay" @click.self="modal = ''">
      <div class="modal logs-modal">
        <button class="close" @click="modal = ''">×</button>
        <h2>ประวัติการดำเนินงานซ่อม #{{ selected?.maintenance_id }}</h2>
        <div class="return-info">
          <b>{{ selected?.asset_code }}</b> — {{ selected?.equipment_name }}
          <br />
          <small>ปัญหา: {{ selected?.problem_type }} | ปัจจุบัน: {{ label(selected?.status) }}</small>
        </div>

        <div v-if="loadingLogs" class="empty">กำลังโหลดประวัติ...</div>
        <div v-else-if="!logs.length" class="empty">ยังไม่มีบันทึกการดำเนินงาน</div>
        <div v-else class="timeline">
          <div v-for="log in logs" :key="log.log_id" class="timeline-item">
            <div class="timeline-dot"></div>
            <div class="timeline-content">
              <div class="timeline-header">
                <span :class="['badge', log.status.toLowerCase()]">{{ label(log.status) }}</span>
                <small>{{ fmt(log.created_at) }}</small>
              </div>
              <p v-if="log.remark" class="timeline-remark">{{ log.remark }}</p>
              <span class="timeline-user">โดย: {{ log.updated_by_name || 'ระบบ' }}</span>
            </div>
          </div>
        </div>

        <div class="modal-actions">
          <button class="primary" @click="modal = ''">ปิด</button>
        </div>
      </div>
    </div>
  </main>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../services/api'
import { useAuthStore } from '../stores/auth'
import { useAutoRefresh } from '../composables/useAutoRefresh'

const auth = useAuthStore()
const items = ref([])
const equipment = ref([])
const technicians = ref([])
const logs = ref([])
const loading = ref(false)
const loadingLogs = ref(false)
const saving = ref(false)
const error = ref('')
const success = ref('')
const search = ref('')
const status = ref('')
const priority = ref('')
const modal = ref('')
const selected = ref(null)

const form = ref({
  equipment_id: '',
  problem_type: '',
  problem_description: '',
  priority: 'Normal',
})

const updateForm = ref({
  status: 'Received',
  technician_id: null,
  repair_cost: 0,
  solution: '',
  remark: '',
})

const statuses = ['Reported', 'Received', 'Diagnosing', 'Repairing', 'Completed', 'Cancelled']
const priorities = ['Low', 'Normal', 'High', 'Urgent']

const canManage = computed(() => ['Administrator', 'Staff'].includes(auth.role))

const labels = {
  Reported: 'แจ้งแล้ว',
  Received: 'รับเรื่อง',
  Diagnosing: 'กำลังตรวจสอบ',
  Repairing: 'กำลังซ่อม',
  Completed: 'เสร็จสิ้น',
  Cancelled: 'ยกเลิก',
}
const label = (s) => labels[s] || s

const fmt = (v) => (v ? new Date(v).toLocaleString('th-TH') : '-')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const { data } = await api.get('/maintenance', {
      params: { search: search.value, status: status.value, priority: priority.value },
    })
    items.value = data.data || []
  } catch (e) {
    error.value = e.response?.data?.message || 'ไม่สามารถโหลดรายการแจ้งซ่อมได้'
  } finally {
    loading.value = false
  }
}

async function loadEquipment() {
  try {
    const { data } = await api.get('/maintenance/equipment')
    equipment.value = data.data || []
  } catch (e) {
    error.value = e.response?.data?.message || 'ไม่สามารถโหลดอุปกรณ์ได้'
  }
}

async function loadTechnicians() {
  try {
    const { data } = await api.get('/maintenance/technicians')
    technicians.value = data.data || []
  } catch (e) {}
}

function openCreate() {
  form.value = { equipment_id: '', problem_type: '', problem_description: '', priority: 'Normal' }
  modal.value = 'create'
  loadEquipment()
}

function openUpdate(x) {
  selected.value = x
  updateForm.value = {
    status: x.status === 'Reported' ? 'Received' : x.status,
    technician_id: x.technician_id || null,
    repair_cost: Number(x.repair_cost || 0),
    solution: x.solution || '',
    remark: '',
  }
  modal.value = 'update'
  loadTechnicians()
}

async function openLogs(x) {
  selected.value = x
  modal.value = 'logs'
  logs.value = []
  loadingLogs.value = true
  try {
    const { data } = await api.get(`/maintenance/${x.maintenance_id}/logs`)
    logs.value = data.data || []
  } catch (e) {
    error.value = e.response?.data?.message || 'ไม่สามารถโหลดประวัติได้'
  } finally {
    loadingLogs.value = false
  }
}

async function create() {
  saving.value = true
  error.value = ''
  success.value = ''
  try {
    await api.post('/maintenance', form.value)
    success.value = 'ส่งเรื่องแจ้งซ่อมสำเร็จ'
    modal.value = ''
    await load()
  } catch (e) {
    error.value = e.response?.data?.message || 'ไม่สามารถแจ้งซ่อมได้'
  } finally {
    saving.value = false
  }
}

async function update() {
  saving.value = true
  error.value = ''
  success.value = ''
  try {
    await api.put(`/maintenance/${selected.value.maintenance_id}/status`, updateForm.value)
    success.value = 'อัปเดตสถานะงานซ่อมสำเร็จ'
    modal.value = ''
    await load()
  } catch (e) {
    error.value = e.response?.data?.message || 'ไม่สามารถอัปเดตงานซ่อมได้'
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  load()
})
useAutoRefresh(load)
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
.filters button,
.modal input,
.modal select,
.modal textarea {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 10px 12px;
  background: #fff;
  box-sizing: border-box;
}
.filters button {
  cursor: pointer;
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
  max-width: 280px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.badge,
.priority {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  background: #e2e8f0;
}
.tech-tag {
  display: inline-block;
  background: #eff6ff;
  color: #1e40af;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
}
.text-muted {
  color: #94a3b8;
}
.reported {
  background: #fef3c7;
  color: #92400e;
}
.received,
.diagnosing {
  background: #e0f2fe;
  color: #0369a1;
}
.repairing {
  background: #dbeafe;
  color: #1d4ed8;
}
.completed {
  background: #dcfce7;
  color: #166534;
}
.cancelled {
  background: #fee2e2;
  color: #b91c1c;
}
.urgent {
  background: #fee2e2;
  color: #b91c1c;
}
.high {
  background: #ffedd5;
  color: #c2410c;
}
.normal {
  background: #e0f2fe;
  color: #0369a1;
}
.low {
  background: #f1f5f9;
  color: #475569;
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
.btn-log {
  background: #f1f5f9;
  color: #334155;
  font-weight: 600;
}
.btn-update {
  background: #e0f2fe;
  color: #0369a1;
  font-weight: 700;
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
  width: min(580px, 100%);
  max-height: 90vh;
  overflow: auto;
  background: #fff;
  border-radius: 16px;
  padding: 26px;
  box-shadow: 0 25px 60px rgba(15, 23, 42, 0.2);
}
.logs-modal {
  width: min(650px, 100%);
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
}
.return-info {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  padding: 14px;
  border-radius: 10px;
  font-size: 13px;
  margin-bottom: 8px;
}
.timeline {
  display: grid;
  gap: 16px;
  padding: 10px 0;
  position: relative;
}
.timeline-item {
  display: flex;
  gap: 14px;
  position: relative;
}
.timeline-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #2563eb;
  margin-top: 4px;
  flex: none;
}
.timeline-content {
  flex: 1;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  padding: 12px 14px;
  border-radius: 10px;
}
.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.timeline-header small {
  color: #64748b;
  font-size: 11px;
}
.timeline-remark {
  margin: 4px 0 6px;
  font-size: 13px;
  color: #1e293b;
}
.timeline-user {
  font-size: 11px;
  color: #94a3b8;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}
@media (max-width: 700px) {
  .page {
    padding: 18px;
  }
  .filters {
    flex-wrap: wrap;
  }
  .filters input {
    flex-basis: 100%;
  }
}
</style>
