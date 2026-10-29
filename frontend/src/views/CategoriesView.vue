<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>หมวดหมู่อุปกรณ์</h1>
        <p>จัดการประเภทและหมวดหมู่ครุภัณฑ์ในระบบ</p>
      </div>
      <button v-if="canManage" class="primary" @click="openCreate">+ เพิ่มหมวดหมู่</button>
    </div>

    <div v-if="error" class="alert error">{{ error }}</div>
    <div v-if="success" class="alert success">{{ success }}</div>

    <div class="toolbar">
      <input v-model="search" placeholder="ค้นหาชื่อหมวดหมู่หรือรายละเอียด..." />
      <select v-model="statusFilter">
        <option value="">ทุกสถานะ</option>
        <option value="Active">Active (เปิดใช้งาน)</option>
        <option value="Inactive">Inactive (ปิดใช้งาน)</option>
      </select>
    </div>

    <div class="table-card">
      <div class="table-info">พบ {{ filteredCategories.length }} หมวดหมู่</div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ชื่อหมวดหมู่</th>
              <th>รายละเอียด</th>
              <th>จำนวนอุปกรณ์ในระบบ</th>
              <th>สถานะ</th>
              <th v-if="canManage">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="cat in filteredCategories" :key="cat.category_id">
              <td><b>{{ cat.category_name }}</b></td>
              <td>{{ cat.description || '-' }}</td>
              <td>
                <span class="count-pill">{{ cat.equipment_count || 0 }} รายการ</span>
              </td>
              <td>
                <span class="badge" :class="cat.status === 'Active' ? 'badge-active' : 'badge-inactive'">
                  {{ cat.status === 'Active' ? 'เปิดใช้งาน' : 'ปิดใช้งาน' }}
                </span>
              </td>
              <td v-if="canManage" class="actions">
                <button @click="openEdit(cat)">แก้ไข</button>
                <button class="danger-text" @click="removeCategory(cat)">ลบ</button>
              </td>
            </tr>
            <tr v-if="!loading && !filteredCategories.length">
              <td :colspan="canManage ? 5 : 4" class="empty">ไม่พบข้อมูลหมวดหมู่</td>
            </tr>
            <tr v-if="loading">
              <td :colspan="canManage ? 5 : 4" class="empty">กำลังโหลดข้อมูล...</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Add/Edit -->
    <div v-if="showModal" class="modal-backdrop" @click.self="closeModal">
      <div class="modal">
        <div class="modal-head">
          <h2>{{ editing ? 'แก้ไขหมวดหมู่' : 'เพิ่มหมวดหมู่อุปกรณ์' }}</h2>
          <button @click="closeModal">×</button>
        </div>
        <form @submit.prevent="save">
          <div class="form-grid">
            <label class="full">
              ชื่อหมวดหมู่*
              <input v-model.trim="form.category_name" required placeholder="เช่น แท็บเล็ต, กล้องถ่ายทอดสด..." />
            </label>
            <label class="full">
              รายละเอียด
              <textarea v-model.trim="form.description" rows="3" placeholder="ระบุคำอธิบายของหมวดหมู่นี้"></textarea>
            </label>
            <label class="full">
              สถานะ
              <select v-model="form.status">
                <option value="Active">Active (เปิดใช้งาน)</option>
                <option value="Inactive">Inactive (ปิดใช้งาน)</option>
              </select>
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
import { ref, computed, onMounted } from 'vue'
import api from '../services/api'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const categories = ref([])
const loading = ref(false)
const saving = ref(false)
const search = ref('')
const statusFilter = ref('')
const error = ref('')
const success = ref('')
const formError = ref('')
const showModal = ref(false)
const editing = ref(null)

const canManage = computed(() => ['Administrator', 'Staff'].includes(auth.role))

const form = ref({
  category_name: '',
  description: '',
  status: 'Active'
})

const filteredCategories = computed(() => {
  return categories.value.filter(c => {
    const matchSearch = !search.value ||
      c.category_name.toLowerCase().includes(search.value.toLowerCase()) ||
      (c.description && c.description.toLowerCase().includes(search.value.toLowerCase()))
    const matchStatus = !statusFilter.value || c.status === statusFilter.value
    return matchSearch && matchStatus
  })
})

async function loadCategories() {
  loading.value = true
  error.value = ''
  try {
    const { data } = await api.get('/categories')
    categories.value = data.data || []
  } catch (e) {
    error.value = e.response?.data?.message || 'ไม่สามารถโหลดหมวดหมู่อุปกรณ์ได้'
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editing.value = null
  form.value = { category_name: '', description: '', status: 'Active' }
  formError.value = ''
  showModal.value = true
}

function openEdit(cat) {
  editing.value = cat
  form.value = {
    category_name: cat.category_name,
    description: cat.description || '',
    status: cat.status || 'Active'
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
    if (editing.value) {
      await api.put(`/categories/${editing.value.category_id}`, form.value)
      success.value = 'แก้ไขหมวดหมู่สำเร็จ'
    } else {
      await api.post('/categories', form.value)
      success.value = 'เพิ่มหมวดหมู่สำเร็จ'
    }
    closeModal()
    await loadCategories()
  } catch (e) {
    formError.value = e.response?.data?.message || 'ไม่สามารถบันทึกข้อมูลได้'
  } finally {
    saving.value = false
  }
}

async function removeCategory(cat) {
  if (!confirm(`ต้องการลบหมวดหมู่ "${cat.category_name}" ใช่หรือไม่?`)) return
  error.value = ''
  success.value = ''
  try {
    await api.delete(`/categories/${cat.category_id}`)
    success.value = `ลบหมวดหมู่ "${cat.category_name}" สำเร็จ`
    await loadCategories()
  } catch (e) {
    error.value = e.response?.data?.message || 'ไม่สามารถลบหมวดหมู่ได้'
  }
}

onMounted(loadCategories)
</script>

<style scoped>
.page {
  padding: 28px;
  max-width: 1400px;
  margin: auto;
}
.page-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
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
  border-radius: 9px;
  padding: 10px 18px;
  font-weight: 600;
  cursor: pointer;
}
.primary:disabled {
  opacity: 0.6;
}
.toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}
.toolbar input {
  flex: 1;
}
.toolbar input, .toolbar select, .form-grid input, .form-grid select, .form-grid textarea {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 10px 12px;
  background: #fff;
}
.table-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 18px;
}
.table-info {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 12px;
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
  padding: 12px 14px;
  white-space: nowrap;
}
td {
  padding: 12px 14px;
  border-top: 1px solid #eef2f7;
  white-space: nowrap;
}
.count-pill {
  display: inline-block;
  background: #f1f5f9;
  color: #334155;
  padding: 4px 10px;
  border-radius: 99px;
  font-size: 11px;
  font-weight: 600;
}
.badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 99px;
  font-size: 11px;
  font-weight: 600;
}
.badge-active {
  background: #dcfce7;
  color: #166534;
}
.badge-inactive {
  background: #fee2e2;
  color: #b91c1c;
}
.actions {
  display: flex;
  gap: 8px;
}
.actions button {
  border: 0;
  background: #eff6ff;
  color: #2563eb;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
}
.actions .danger-text {
  background: #fef2f2;
  color: #dc2626;
}
.empty {
  text-align: center;
  color: #94a3b8;
  padding: 35px;
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
  width: min(500px, 100%);
  background: #fff;
  border-radius: 14px;
  padding: 24px;
  box-shadow: 0 20px 40px rgba(0,0,0,0.15);
}
.modal-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18px;
}
.modal-head h2 {
  margin: 0;
  font-size: 18px;
}
.modal-head button {
  border: 0;
  background: transparent;
  font-size: 24px;
  cursor: pointer;
}
.form-grid {
  display: grid;
  gap: 14px;
}
.form-grid label {
  font-size: 12px;
  font-weight: 600;
  color: #334155;
}
.form-grid input, .form-grid select, .form-grid textarea {
  display: block;
  width: 100%;
  margin-top: 6px;
  box-sizing: border-box;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}
.modal-actions > button:first-child {
  border: 1px solid #cbd5e1;
  background: #fff;
  border-radius: 8px;
  padding: 10px 16px;
  cursor: pointer;
}
</style>
