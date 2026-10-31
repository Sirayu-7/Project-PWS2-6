<template>
  <RouterView v-if="isAuthPage" />
  <div v-else class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-icon">IT</div>
        <div class="brand-copy">
          <strong>IT Equipment</strong>
          <span>Management System</span>
        </div>
      </div>
      <div class="nav-label">MAIN MENU</div>
      <nav class="nav">
        <RouterLink to="/dashboard" class="nav-item">
          <span class="nav-icon">⌂</span><span>Dashboard</span>
        </RouterLink>
        <RouterLink to="/equipment" class="nav-item">
          <span class="nav-icon">▣</span><span>อุปกรณ์</span>
        </RouterLink>
        <RouterLink v-if="isAdmin || userRole === 'Staff'" to="/categories" class="nav-item">
          <span class="nav-icon">📁</span><span>หมวดหมู่อุปกรณ์</span>
        </RouterLink>
        <RouterLink to="/loan" class="nav-item">
          <span class="nav-icon">⇄</span><span>การยืม-คืน</span>
        </RouterLink>
        <RouterLink to="/maintenance" class="nav-item">
          <span class="nav-icon">⚒</span><span>แจ้งซ่อม</span>
        </RouterLink>
        <RouterLink v-if="isAdmin || userRole === 'Staff'" to="/reports" class="nav-item">
          <span class="nav-icon">▤</span><span>รายงาน</span>
        </RouterLink>

        <template v-if="isAdmin">
          <div class="nav-label admin-label">ADMINISTRATION</div>
          <RouterLink to="/users" class="nav-item">
            <span class="nav-icon">♙</span><span>จัดการผู้ใช้งาน</span>
          </RouterLink>
          <RouterLink to="/audit" class="nav-item">
            <span class="nav-icon">◷</span><span>ประวัติการทำรายการ</span>
          </RouterLink>
        </template>
      </nav>

      <div class="sidebar-bottom">
        <div class="user-mini" @click="openProfileModal" role="button" title="คลิกเพื่อจัดการโปรไฟล์ / เปลี่ยนรหัสผ่าน">
          <div class="avatar">{{ initials }}</div>
          <div>
            <strong>{{ userName }}</strong>
            <span>{{ userRole }}</span>
          </div>
        </div>
        <button class="logout" @click="logout">
          <span>↪</span> ออกจากระบบ
        </button>
      </div>
    </aside>

    <main class="main">
      <header class="topbar">
        <div class="top-title">
          <div class="breadcrumb">IT EQUIPMENT / {{ pageTitle.toUpperCase() }}</div>
          <h2>{{ pageTitle }}</h2>
        </div>

        <div class="top-actions">
          <div class="notification-wrap">
            <button class="icon-button notification-button" :class="{ pulse: hasNewNotification }" @click="toggleNotifications" aria-label="Notifications">
              🔔<span v-if="unread > 0" class="notification-count">{{ unread > 99 ? '99+' : unread }}</span>
            </button>
            <div v-if="showNotifications" class="notification-panel">
              <div class="notification-head">
                <div>
                  <strong>การแจ้งเตือน</strong>
                  <small>{{ unread }} รายการที่ยังไม่อ่าน</small>
                </div>
                <button @click="readAll" :disabled="unread === 0">อ่านทั้งหมด</button>
              </div>
              <div v-if="!notifications.length" class="notification-empty">ไม่มีการแจ้งเตือน</div>
              <button v-for="n in notifications" :key="n.notification_id" class="notification-item" :class="{ unread: !n.is_read }" @click="readOne(n)">
                <span class="notification-dot"></span>
                <strong>{{ n.title }}</strong>
                <span>{{ n.message }}</span>
                <small>{{ formatDate(n.created_at) }}</small>
              </button>
            </div>
          </div>

          <div class="profile clickable-profile" @click="openProfileModal" role="button" title="ดูข้อมูลผู้ใช้ / เปลี่ยนรหัสผ่าน">
            <div class="avatar profile-avatar">{{ initials }}</div>
            <div>
              <strong>{{ userName }}</strong>
              <span>{{ userRole }}</span>
            </div>
            <span class="chevron">⚙</span>
          </div>
        </div>
      </header>

      <div v-if="realtimeStatus === 'reconnecting'" class="realtime-status">กำลังเชื่อมต่อ Realtime...</div>
      <section class="content">
        <RouterView />
      </section>
    </main>

    <!-- Profile & Change Password Modal -->
    <div v-if="showProfileModal" class="modal-backdrop" @click.self="showProfileModal = false">
      <div class="modal profile-dialog">
        <div class="modal-head">
          <h2>โปรไฟล์และบัญชีผู้ใช้งาน</h2>
          <button @click="showProfileModal = false">×</button>
        </div>

        <div class="profile-header-card">
          <div class="avatar profile-modal-avatar">{{ initials }}</div>
          <div>
            <h3>{{ userName }}</h3>
            <span class="role-badge">{{ userRole }}</span>
            <small>Username: <b>{{ user.username }}</b></small>
          </div>
        </div>

        <div v-if="profileSuccess" class="alert success">{{ profileSuccess }}</div>
        <div v-if="profileError" class="alert error">{{ profileError }}</div>

        <div class="profile-tabs">
          <button :class="{ active: profileTab === 'name' }" @click="profileTab = 'name'">ข้อมูลส่วนตัว</button>
          <button :class="{ active: profileTab === 'password' }" @click="profileTab = 'password'">เปลี่ยนรหัสผ่าน</button>
        </div>

        <!-- Tab 1: Edit Name -->
        <form v-if="profileTab === 'name'" @submit.prevent="updateProfileName" class="profile-form">
          <label>
            ชื่อ-นามสกุล ที่แสดงในระบบ
            <input v-model.trim="profileName" required placeholder="กรอกชื่อ-นามสกุล" />
          </label>
          <div class="modal-actions">
            <button type="button" @click="showProfileModal = false">ปิด</button>
            <button class="primary" :disabled="savingProfile">
              {{ savingProfile ? 'กำลังบันทึก...' : 'บันทึกชื่อ' }}
            </button>
          </div>
        </form>

        <!-- Tab 2: Change Password -->
        <form v-if="profileTab === 'password'" @submit.prevent="changePassword" class="profile-form">
          <label>
            รหัสผ่านเดิม*
            <input v-model="passwords.old_password" type="password" required placeholder="กรอกรหัสผ่านปัจจุบัน" />
          </label>
          <label>
            รหัสผ่านใหม่* (อย่างน้อย 6 ตัวอักษร)
            <input v-model="passwords.new_password" type="password" required minlength="6" placeholder="กรอกรหัสผ่านใหม่" />
          </label>
          <label>
            ยืนยันรหัสผ่านใหม่*
            <input v-model="passwords.confirm_password" type="password" required minlength="6" placeholder="กรอกรหัสผ่านใหม่อีกครั้ง" />
          </label>
          <div class="modal-actions">
            <button type="button" @click="showProfileModal = false">ยกเลิก</button>
            <button class="primary" :disabled="savingProfile">
              {{ savingProfile ? 'กำลังเปลี่ยนรหัส...' : 'ยืนยันเปลี่ยนรหัสผ่าน' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from './services/api'

const route = useRoute(), router = useRouter()
const isAuthPage = computed(() => route.path === '/login' || !!route.meta?.public)
const user = computed(() => JSON.parse(localStorage.getItem('it_user') || '{}'))
const userName = computed(() => user.value.name || 'ผู้ใช้งาน')
const userRole = computed(() => user.value.role || 'ผู้ใช้งานระบบ')
const isAdmin = computed(() => user.value.role === 'Administrator')
const initials = computed(() => (userName.value || 'IT').slice(0, 2).toUpperCase())

const titles = {
  '/dashboard': 'Dashboard',
  '/equipment': 'จัดการอุปกรณ์',
  '/categories': 'หมวดหมู่อุปกรณ์',
  '/loan': 'การยืม-คืนอุปกรณ์',
  '/maintenance': 'แจ้งซ่อมและบำรุงรักษา',
  '/reports': 'รายงาน',
  '/users': 'จัดการผู้ใช้งาน',
  '/audit': 'ประวัติการทำรายการ',
}
const pageTitle = computed(() => titles[route.path] || 'IT Equipment')

const notifications = ref([]), unread = ref(0), showNotifications = ref(false)
const realtime = ref(null), reconnectTimer = ref(null), realtimeStatus = ref('offline')
const hasNewNotification = ref(false)

// Profile & Change Password
const showProfileModal = ref(false)
const profileTab = ref('name')
const profileName = ref('')
const passwords = ref({ old_password: '', new_password: '', confirm_password: '' })
const savingProfile = ref(false)
const profileSuccess = ref('')
const profileError = ref('')

function openProfileModal() {
  profileName.value = user.value.name || ''
  passwords.value = { old_password: '', new_password: '', confirm_password: '' }
  profileSuccess.value = ''
  profileError.value = ''
  profileTab.value = 'name'
  showProfileModal.value = true
}

async function updateProfileName() {
  if (!profileName.value) return
  savingProfile.value = true
  profileError.value = ''
  profileSuccess.value = ''
  try {
    const { data } = await api.put('/auth/profile', { name: profileName.value })
    localStorage.setItem('it_user', JSON.stringify(data.user))
    if (data.token) localStorage.setItem('it_token', data.token)
    profileSuccess.value = 'อัปเดตชื่อสำเร็จเรียบร้อย'
  } catch (e) {
    profileError.value = e.response?.data?.message || 'ไม่สามารถอัปเดตชื่อได้'
  } finally {
    savingProfile.value = false
  }
}

async function changePassword() {
  if (passwords.value.new_password !== passwords.value.confirm_password) {
    profileError.value = 'รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน'
    return
  }
  savingProfile.value = true
  profileError.value = ''
  profileSuccess.value = ''
  try {
    const { data } = await api.post('/auth/change-password', {
      old_password: passwords.value.old_password,
      new_password: passwords.value.new_password,
    })
    profileSuccess.value = data.message || 'เปลี่ยนรหัสผ่านสำเร็จ'
    passwords.value = { old_password: '', new_password: '', confirm_password: '' }
  } catch (e) {
    profileError.value = e.response?.data?.message || 'ไม่สามารถเปลี่ยนรหัสผ่านได้'
  } finally {
    savingProfile.value = false
  }
}

const loadNotifications = async () => {
  if (!localStorage.getItem('it_token')) return
  try {
    const [a, b] = await Promise.all([
      api.get('/notifications'),
      api.get('/notifications/unread-count'),
    ])
    notifications.value = a.data.data || []
    unread.value = Number(b.data.count || 0)
  } catch {}
}

const toggleNotifications = async () => {
  showNotifications.value = !showNotifications.value
  if (showNotifications.value) {
    hasNewNotification.value = false
    await loadNotifications()
  }
}

const readOne = async (n) => {
  if (!n.is_read) {
    try {
      await api.put(`/notifications/${n.notification_id}/read`)
      n.is_read = 1
      unread.value = Math.max(0, unread.value - 1)
    } catch {}
  }
}

const readAll = async () => {
  try {
    await api.put('/notifications/read-all')
    notifications.value.forEach((n) => (n.is_read = 1))
    unread.value = 0
  } catch {}
}

const formatDate = (v) => (v ? new Date(v).toLocaleString('th-TH') : '-')

const playNotificationSound = () => {
  try {
    const C = window.AudioContext || window.webkitAudioContext
    if (!C) return
    const c = new C(), o = c.createOscillator(), g = c.createGain()
    o.frequency.value = 880
    g.gain.setValueAtTime(0.0001, c.currentTime)
    g.gain.exponentialRampToValueAtTime(0.08, c.currentTime + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.16)
    o.connect(g)
    g.connect(c.destination)
    o.start()
    o.stop(c.currentTime + 0.17)
  } catch {}
}

const closeRealtime = () => {
  if (realtime.value) {
    realtime.value.close()
    realtime.value = null
  }
  if (reconnectTimer.value) {
    clearTimeout(reconnectTimer.value)
    reconnectTimer.value = null
  }
  realtimeStatus.value = 'offline'
}

const scheduleReconnect = () => {
  if (reconnectTimer.value || !localStorage.getItem('it_token')) return
  realtimeStatus.value = 'reconnecting'
  reconnectTimer.value = setTimeout(() => {
    reconnectTimer.value = null
    connectRealtime()
  }, 3000)
}

const connectRealtime = () => {
  closeRealtime()
  const token = localStorage.getItem('it_token')
  if (!token) return
  const base = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/$/, '')
  const source = new EventSource(`${base}/realtime/events?token=${encodeURIComponent(token)}`)
  realtime.value = source
  source.addEventListener('connected', () => {
    realtimeStatus.value = 'connected'
  })
  source.addEventListener('notification', (event) => {
    const payload = JSON.parse(event.data || '{}')
    hasNewNotification.value = true
    unread.value++
    if (payload.notification_id && !notifications.value.some((n) => n.notification_id === payload.notification_id)) {
      notifications.value.unshift({ ...payload, created_at: new Date().toISOString() })
    }
    playNotificationSound()
  })
  source.addEventListener('data:refresh', (event) => {
    window.dispatchEvent(new CustomEvent('it-equipment:data-refresh', { detail: JSON.parse(event.data || '{}') }))
  })
  source.onerror = () => {
    if (realtime.value === source) {
      source.close()
      realtime.value = null
      scheduleReconnect()
    }
  }
}

const logout = () => {
  closeRealtime()
  localStorage.removeItem('it_token')
  localStorage.removeItem('it_user')
  router.push('/login')
}

onMounted(() => {
  if (!isAuthPage.value) {
    loadNotifications()
    connectRealtime()
  }
})

watch(() => route.path, (newPath) => {
  if (newPath !== '/login' && !isAuthPage.value) {
    loadNotifications()
    connectRealtime()
  } else {
    closeRealtime()
  }
})

onUnmounted(closeRealtime)
</script>

<style scoped>
.clickable-profile {
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 9px;
  transition: background 0.15s;
}
.clickable-profile:hover {
  background: #f1f5f9;
}
.user-mini {
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.15s;
}
.user-mini:hover {
  background: #1e293b;
}
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: grid;
  place-items: center;
  padding: 20px;
  z-index: 50;
}
.profile-dialog {
  width: min(500px, 100%);
  background: #fff;
  border-radius: 14px;
  padding: 24px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
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
.profile-header-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  margin-bottom: 16px;
}
.profile-modal-avatar {
  width: 52px;
  height: 52px;
  font-size: 18px;
  background: #2563eb;
  color: #fff;
  border-radius: 14px;
}
.profile-header-card h3 {
  margin: 0 0 4px;
  font-size: 16px;
}
.role-badge {
  display: inline-block;
  background: #dbeafe;
  color: #1e40af;
  padding: 2px 8px;
  border-radius: 99px;
  font-size: 11px;
  font-weight: 600;
  margin-right: 8px;
}
.profile-header-card small {
  color: #64748b;
  font-size: 12px;
}
.profile-tabs {
  display: flex;
  gap: 8px;
  border-bottom: 1px solid #e2e8f0;
  margin-bottom: 16px;
}
.profile-tabs button {
  border: 0;
  background: transparent;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  border-bottom: 2px solid transparent;
}
.profile-tabs button.active {
  color: #2563eb;
  border-bottom-color: #2563eb;
}
.profile-form {
  display: grid;
  gap: 14px;
}
.profile-form label {
  font-size: 12px;
  font-weight: 600;
  color: #334155;
  display: block;
}
.profile-form input {
  display: block;
  width: 100%;
  margin-top: 6px;
  padding: 10px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  box-sizing: border-box;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 14px;
}
.modal-actions > button:first-child {
  border: 1px solid #cbd5e1;
  background: #fff;
  border-radius: 8px;
  padding: 10px 16px;
  cursor: pointer;
}
.primary {
  border: 0;
  background: #2563eb;
  color: #fff;
  border-radius: 8px;
  padding: 10px 18px;
  font-weight: 600;
  cursor: pointer;
}
.primary:disabled {
  opacity: 0.6;
}
.alert {
  padding: 10px 14px;
  border-radius: 8px;
  margin-bottom: 14px;
  font-size: 12px;
}
.alert.error {
  background: #fef2f2;
  color: #b91c1c;
}
.alert.success {
  background: #dcfce7;
  color: #166534;
}
</style>
