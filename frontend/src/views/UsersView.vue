<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h3>จัดการผู้ใช้งาน</h3>
        <p>เพิ่ม แก้ไข ระงับ และจัดการสิทธิ์ผู้ใช้งานระบบ</p>
      </div>
      <button class="primary" @click="openCreate">+ เพิ่มผู้ใช้งาน</button>
    </div>

    <div v-if="error" class="alert error">{{ error }}</div>
    <div v-if="success" class="alert success">{{ success }}</div>

    <div class="toolbar">
      <input v-model="search" placeholder="ค้นหาชื่อหรือ Username..." />
      <select v-model="roleFilter">
        <option value="">ทุกสิทธิ์</option>
        <option v-for="r in roles" :key="r.role_id" :value="r.role_name">{{ r.role_name }}</option>
      </select>
      <select v-model="statusFilter">
        <option value="">ทุกสถานะ</option>
        <option>Active</option>
        <option>Inactive</option>
      </select>
    </div>

    <div class="card">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ชื่อ</th>
              <th>Username</th>
              <th>สิทธิ์</th>
              <th>สถานะ</th>
              <th>วันที่สร้าง</th>
              <th>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in filteredUsers" :key="u.user_id">
              <td>{{ u.name }}</td>
              <td>{{ u.username }}</td>
              <td>{{ u.role_name }}</td>
              <td>{{ u.status }}</td>
              <td>{{ formatDate(u.created_at) }}</td>
              <td class="actions">
                <button @click="openEdit(u)">แก้ไข</button>
                <button class="danger" @click="removeUser(u)">ลบ</button>
              </td>
            </tr>
            <tr v-if="!filteredUsers.length">
              <td colspan="6" class="empty">ไม่พบผู้ใช้งาน</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="showModal" class="modal-backdrop" @click.self="closeModal">
      <div class="modal">
        <div class="modal-head">
          <h3>{{ editing ? 'แก้ไขผู้ใช้งาน' : 'เพิ่มผู้ใช้งาน' }}</h3>
          <button @click="closeModal">×</button>
        </div>
        <form @submit.prevent="save">
          <label>
            ชื่อ
            <input v-model="form.name" required />
          </label>
          <label>
            Username
            <input v-model="form.username" required />
          </label>
          <label>
            รหัสผ่าน
            <input v-model="form.password" type="password" :required="!editing" :placeholder="editing ? 'เว้นว่างเพื่อไม่เปลี่ยน' : ''" />
          </label>
          <label>
            สิทธิ์
            <select v-model="form.role_id" required>
              <option v-for="r in roles" :key="r.role_id" :value="r.role_id">{{ r.role_name }}</option>
            </select>
          </label>
          <label>
            สถานะ
            <select v-model="form.status">
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </label>
          <div class="modal-actions">
            <button type="button" @click="closeModal">ยกเลิก</button>
            <button class="primary" type="submit">บันทึก</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import api from '../services/api'
import { useAutoRefresh } from '../composables/useAutoRefresh'

const users = ref([])
const roles = ref([])
const search = ref('')
const roleFilter = ref('')
const statusFilter = ref('')
const error = ref('')
const success = ref('')
const showModal = ref(false)
const editing = ref(null)

const form = reactive({
  name: '',
  username: '',
  password: '',
  role_id: '',
  status: 'Active',
})

const filteredUsers = computed(() =>
  users.value.filter(
    (u) =>
      (!search.value || `${u.name} ${u.username}`.toLowerCase().includes(search.value.toLowerCase())) &&
      (!roleFilter.value || u.role_name === roleFilter.value) &&
      (!statusFilter.value || u.status === statusFilter.value)
  )
)

const load = async () => {
  try {
    const [a, b] = await Promise.all([api.get('/users'), api.get('/users/roles')])
    users.value = a.data.data
    roles.value = b.data.data
  } catch (e) {
    error.value = e.response?.data?.message || 'โหลดข้อมูลไม่สำเร็จ'
  }
}

const openCreate = () => {
  editing.value = null
  Object.assign(form, {
    name: '',
    username: '',
    password: '',
    role_id: roles.value[0]?.role_id || '',
    status: 'Active',
  })
  showModal.value = true
}

const openEdit = (u) => {
  editing.value = u
  Object.assign(form, {
    name: u.name,
    username: u.username,
    password: '',
    role_id: u.role_id,
    status: u.status,
  })
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
}

const save = async () => {
  try {
    const p = {
      name: form.name,
      username: form.username,
      role_id: Number(form.role_id),
      status: form.status,
    }
    if (form.password) p.password = form.password
    if (editing.value) await api.put(`/users/${editing.value.user_id}`, p)
    else await api.post('/users', { ...p, password: form.password })
    success.value = 'บันทึกผู้ใช้งานสำเร็จ'
    closeModal()
    await load()
  } catch (e) {
    error.value = e.response?.data?.message || 'บันทึกไม่สำเร็จ'
  }
}

const removeUser = async (u) => {
  if (!confirm(`ต้องการลบ ${u.username} หรือไม่?`)) return
  try {
    await api.delete(`/users/${u.user_id}`)
    success.value = 'ลบผู้ใช้งานสำเร็จ'
    await load()
  } catch (e) {
    error.value = e.response?.data?.message || 'ลบไม่สำเร็จ'
  }
}

const formatDate = (v) => (v ? new Date(v).toLocaleDateString('th-TH') : '-')

onMounted(load)
useAutoRefresh(load)
</script>

<style scoped>
.page-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 18px;
}
.page-head h3 {
  margin: 0 0 4px;
}
.page-head p {
  margin: 0;
  color: #64748b;
}
.primary {
  background: #2563eb;
  color: white;
  border: 0;
  border-radius: 8px;
  padding: 10px 16px;
  cursor: pointer;
}
.toolbar {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}
.toolbar input,
.toolbar select {
  padding: 10px;
  border: 1px solid #dbe2ea;
  border-radius: 8px;
  background: white;
}
.toolbar input {
  flex: 1;
}
.card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
}
.table-wrap {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
table {
  width: 100%;
  border-collapse: collapse;
}
th,
td {
  padding: 13px 15px;
  border-bottom: 1px solid #eef2f7;
  text-align: left;
  white-space: nowrap;
}
th {
  background: #f8fafc;
}
td button {
  border: 0;
  background: none;
  cursor: pointer;
  margin-right: 10px;
}
.danger {
  color: #dc2626;
}
.empty {
  text-align: center;
  color: #94a3b8;
  padding: 35px;
}
.alert {
  padding: 10px 14px;
  border-radius: 8px;
  margin-bottom: 14px;
}
.error {
  background: #fee2e2;
  color: #991b1b;
}
.success {
  background: #dcfce7;
  color: #166534;
}
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: #0006;
  display: grid;
  place-items: center;
  padding: 16px;
  z-index: 50;
}
.modal {
  width: min(520px, calc(100vw - 24px));
  max-height: calc(100dvh - 32px);
  overflow-y: auto;
  background: white;
  border-radius: 14px;
  padding: 20px;
}
.modal-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.modal-head h3 {
  margin: 0;
}
.modal-head button {
  border: 0;
  background: none;
  font-size: 24px;
  cursor: pointer;
}
.modal label {
  display: block;
  margin: 12px 0;
  font-weight: 600;
}
.modal input,
.modal select {
  display: block;
  width: 100%;
  box-sizing: border-box;
  margin-top: 6px;
  padding: 10px;
  border: 1px solid #dbe2ea;
  border-radius: 8px;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}
.modal-actions button {
  padding: 10px 16px;
  border: 1px solid #dbe2ea;
  border-radius: 8px;
  background: white;
  cursor: pointer;
}
.modal-actions .primary {
  border: 0;
}
@media (max-width: 640px) {
  .page-head {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  .page-head .primary {
    width: 100%;
  }
  .toolbar {
    flex-direction: column;
  }
  .modal-backdrop {
    padding: 12px;
  }
  .modal {
    padding: 18px 16px;
    max-height: calc(100dvh - 24px);
  }
  .modal-actions {
    flex-wrap: wrap;
  }
  .modal-actions button {
    flex: 1 1 100%;
  }
}
</style>
