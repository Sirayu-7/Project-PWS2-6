<template>
  <RouterView v-if="isAuthPage" />
  <div v-else class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <img src="/logo.png" alt="Logo" class="sidebar-logo" />
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
          <button :class="{ active: profileTab === 'line' }" @click="openLineTab">การเชื่อมต่อ LINE</button>
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

        <!-- Tab 3: LINE Integration -->
        <div v-if="profileTab === 'line'" class="line-tab-content">
          <div v-if="lineStatus.loading" class="line-loading">กำลังตรวจสอบสถานะการเชื่อมต่อ...</div>

          <div v-else-if="lineStatus.linked" class="line-status-box linked">
            <div class="line-badge-icon">✅</div>
            <div class="line-info">
              <h4>เชื่อมต่อกับ LINE เรียบร้อยแล้ว</h4>
              <p>คุณจะได้รับข้อความแจ้งเตือนผลการยืม-คืน แจ้งซ่อม และทำรายการผ่าน LINE Bot ได้ทันที</p>
              <div class="line-id-tag">LINE User ID: <code>{{ lineStatus.line_user_id }}</code></div>
            </div>
            <div class="modal-actions">
              <button type="button" @click="showProfileModal = false">ปิด</button>
              <button type="button" class="btn-danger-outline" @click="unlinkLine" :disabled="lineStatus.unlinking">
                {{ lineStatus.unlinking ? 'กำลังยกเลิก...' : 'ยกเลิกการเชื่อมต่อ LINE' }}
              </button>
            </div>
          </div>

          <div v-else class="line-status-box unlinked">
            <div class="line-badge-icon">💬</div>
            <h4>ยังไม่ได้เชื่อมต่อบัญชี LINE</h4>
            <p>ผูกบัญชีเพื่อรับแจ้งเตือนสถานะการยืม แจ้งซ่อม เตือนก่อนครบกำหนดคืน และกดอนุมัติคำขอผ่าน LINE</p>

            <div v-if="linePin" class="pin-card">
              <span class="pin-label">รหัสสำหรับเชื่อมต่อ LINE (PIN 6 หลัก)</span>
              <div class="pin-number">{{ linePin }}</div>
              <small class="pin-expiry">⏱ รหัสนี้มีอายุใช้งาน 10 นาที (คงเหลือ {{ pinTimerSeconds }} วินาที)</small>
              <div class="pin-steps">
                <strong>วิธีเปิดใช้งาน:</strong>
                <ol>
                  <li>เพิ่มเพื่อน LINE Official Account ของระบบไอที</li>
                  <li>ส่งข้อความรหัสตัวเลข <b>{{ linePin }}</b> เข้าไปในห้องแชท</li>
                  <li>ระบบจะทำการยืนยันและผูกบัญชีให้อัตโนมัติทันที</li>
                </ol>
              </div>
            </div>

            <div v-else class="modal-actions" style="justify-content: center; margin-top: 18px;">
              <button type="button" class="primary" @click="requestLinePin" :disabled="lineStatus.requestingPin">
                {{ lineStatus.requestingPin ? 'กำลังสร้างรหัส...' : 'ขอรหัสเชื่อมต่อ LINE (PIN)' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from './services/api'
import { useAuthStore } from './stores/auth'

const route = useRoute(), router = useRouter()
const auth = useAuthStore()
const isAuthPage = computed(() => route.path === '/login' || !!route.meta?.public)
const user = computed(() => {
  if (auth.user && auth.user.name) return auth.user
  try {
    const raw = localStorage.getItem('it_user')
    if (raw) return JSON.parse(raw)
  } catch {}
  return auth.user || {}
})
const userName = computed(() => user.value?.name || auth.userName || 'ผู้ใช้งาน')
const userRole = computed(() => user.value?.role || auth.role || 'ผู้ใช้งานระบบ')
const isAdmin = computed(() => userRole.value === 'Administrator')
const isBorrower = computed(() => userRole.value === 'Borrower')
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

// LINE Integration
const lineStatus = ref({ loading: false, linked: false, line_user_id: null, unlinking: false, requestingPin: false })
const linePin = ref(null)
const pinTimerSeconds = ref(600)
let pinInterval = null

async function checkLineStatus() {
  lineStatus.value.loading = true
  try {
    const { data } = await api.get('/line/status')
    lineStatus.value.linked = data.linked
    lineStatus.value.line_user_id = data.line_user_id
  } catch (e) {
    console.error('LINE_STATUS_ERROR:', e)
  } finally {
    lineStatus.value.loading = false
  }
}

function openLineTab() {
  profileTab.value = 'line'
  profileSuccess.value = ''
  profileError.value = ''
  checkLineStatus()
}

async function requestLinePin() {
  lineStatus.value.requestingPin = true
  profileError.value = ''
  try {
    const { data } = await api.post('/line/link-token')
    linePin.value = data.pin_code
    pinTimerSeconds.value = data.expires_in || 600
    if (pinInterval) clearInterval(pinInterval)
    pinInterval = setInterval(() => {
      pinTimerSeconds.value--
      if (pinTimerSeconds.value <= 0) {
        clearInterval(pinInterval)
        linePin.value = null
      }
    }, 1000)
  } catch (e) {
    profileError.value = e.response?.data?.message || 'ไม่สามารถขอรหัสเชื่อมต่อได้'
  } finally {
    lineStatus.value.requestingPin = false
  }
}

async function unlinkLine() {
  if (!confirm('คุณต้องการยกเลิกการเชื่อมต่อบัญชี LINE ใช่หรือไม่?')) return
  lineStatus.value.unlinking = true
  try {
    await api.post('/line/unlink')
    lineStatus.value.linked = false
    lineStatus.value.line_user_id = null
    linePin.value = null
    profileSuccess.value = 'ยกเลิกการเชื่อมต่อ LINE เรียบร้อยแล้ว'
  } catch (e) {
    profileError.value = e.response?.data?.message || 'ไม่สามารถยกเลิกการเชื่อมต่อได้'
  } finally {
    lineStatus.value.unlinking = false
  }
}

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
    if (data.user) auth.setUser(data.user)
    if (data.token) {
      auth.token = data.token
      localStorage.setItem('it_token', data.token)
    }
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
  source.addEventListener('line:linked', (event) => {
    const payload = JSON.parse(event.data || '{}')
    lineStatus.value.linked = true
    lineStatus.value.line_user_id = payload.line_user_id
    linePin.value = null
    if (pinInterval) clearInterval(pinInterval)
    profileSuccess.value = 'ผูกบัญชี LINE สำเร็จเรียบร้อยแล้ว!'
    playNotificationSound()
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
  auth.logout()
  window.location.href = '/login'
}

const onWindowFocus = () => {
  if (!isAuthPage.value && auth.isAuthenticated) {
    auth.checkSession()
  }
}

onMounted(() => {
  if (!isAuthPage.value) {
    auth.checkSession()
    loadNotifications()
    connectRealtime()
  }
  window.addEventListener('focus', onWindowFocus)
})

watch(() => route.path, (newPath) => {
  if (newPath !== '/login' && !isAuthPage.value) {
    auth.checkSession()
    loadNotifications()
    connectRealtime()
  } else {
    closeRealtime()
  }
})

onUnmounted(() => {
  closeRealtime()
  if (pinInterval) clearInterval(pinInterval)
  window.removeEventListener('focus', onWindowFocus)
})
</script>

<style scoped>
.sidebar-logo {
  width: 40px;
  height: 40px;
  object-fit: contain;
  border-radius: 10px;
  background: #ffffff;
  padding: 2px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  flex-shrink: 0;
}
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
.line-status-box {
  padding: 20px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  text-align: center;
}
.line-status-box.linked {
  background: #f0fdf4;
  border-color: #bbf7d0;
}
.line-badge-icon {
  font-size: 32px;
  margin-bottom: 8px;
}
.line-status-box h4 {
  margin: 0 0 6px;
  font-size: 16px;
}
.line-status-box p {
  color: #64748b;
  font-size: 13px;
  margin: 0 0 14px;
}
.line-id-tag {
  display: inline-block;
  background: #e2e8f0;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  color: #334155;
  margin-bottom: 12px;
}
.btn-danger-outline {
  border: 1px solid #ef4444;
  background: #fff;
  color: #ef4444;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-danger-outline:hover {
  background: #fef2f2;
}
.pin-card {
  background: #fff;
  border: 2px dashed #3b82f6;
  border-radius: 12px;
  padding: 20px;
  margin: 16px 0;
}
.pin-label {
  font-size: 13px;
  font-weight: 600;
  color: #1e40af;
}
.pin-number {
  font-size: 36px;
  font-weight: 800;
  letter-spacing: 8px;
  color: #2563eb;
  margin: 8px 0;
  font-family: monospace;
}
.pin-expiry {
  display: block;
  color: #d97706;
  font-size: 12px;
  margin-bottom: 14px;
}
.pin-steps {
  text-align: left;
  background: #eff6ff;
  border-radius: 8px;
  padding: 12px 16px;
  font-size: 12px;
  color: #1e3a8a;
}
.pin-steps ol {
  margin: 6px 0 0;
  padding-left: 20px;
}
.pin-steps li {
  margin-bottom: 4px;
}
</style>
