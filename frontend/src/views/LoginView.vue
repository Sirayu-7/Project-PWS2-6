<template>
  <main class="login-page">
    <section class="login-card">
      <div class="login-brand">
        <img src="/logo.png" alt="Logo" class="brand-logo" />
        <h1>IT Equipment</h1>
        <p>Loan & Maintenance Tracking System</p>
      </div>
      <form @submit.prevent="submit">
        <label>Username<input v-model.trim="username" autocomplete="username" placeholder="กรอก Username" required /></label>
        <label>Password<input v-model="password" type="password" autocomplete="current-password" placeholder="กรอก Password" required /></label>
        <div v-if="auth.error" class="error">{{ auth.error }}</div>
        <button class="login-btn" :disabled="auth.loading">{{ auth.loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ' }}</button>
      </form>
      <p class="login-note">ระบบสำหรับสาขาเทคโนโลยีสารสนเทศ</p>
    </section>
  </main>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const username = ref('')
const password = ref('')
const auth = useAuthStore()
const router = useRouter()

async function submit() {
  if (await auth.login(username.value, password.value)) router.push('/dashboard')
}
</script>

<style scoped>
.login-page{min-height:100vh;display:grid;place-items:center;background:linear-gradient(135deg,#eff6ff,#f8fafc);padding:20px}
.login-card{width:min(420px,100%);background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:34px;box-shadow:0 20px 50px rgba(15,23,42,.08)}
.login-brand{text-align:center;margin-bottom:28px}
.login-brand .brand-logo{margin:0 auto 12px;width:72px;height:72px;object-fit:contain;display:block;border-radius:14px}
.login-brand h1{font-size:21px;margin:12px 0 2px}
.login-brand p,.login-note{font-size:11px;color:#94a3b8}
.login-card form{display:grid;gap:16px}
.login-card label{font-size:12px;font-weight:600}
.login-card input{width:100%;margin-top:7px;border:1px solid #cbd5e1;border-radius:8px;padding:11px 12px;outline:none}
.login-card input:focus{border-color:#2563eb;box-shadow:0 0 0 3px #dbeafe}
.login-btn{border:0;border-radius:8px;padding:12px;background:#2563eb;color:#fff;font-weight:600;cursor:pointer}
.login-btn:disabled{opacity:.6;cursor:not-allowed}
.error{background:#fef2f2;color:#b91c1c;border-radius:8px;padding:10px;font-size:12px}
.login-note{text-align:center;margin:22px 0 0}
</style>
