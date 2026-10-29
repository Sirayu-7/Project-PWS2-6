import { defineStore } from 'pinia'
import api from '../services/api'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: JSON.parse(localStorage.getItem('it_user') || 'null'),
    token: localStorage.getItem('it_token') || null,
    permissions: JSON.parse(localStorage.getItem('it_permissions') || '[]'),
    loading: false,
    error: '',
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.token),
    role: (state) => state.user?.role || null,
    can: (state) => (permission) => state.permissions.includes(permission),
  },
  actions: {
    async login(username, password) {
      this.loading = true
      this.error = ''
      try {
        const { data } = await api.post('/auth/login', { username, password })
        this.token = data.token
        this.user = data.user
        this.permissions = Array.isArray(data.permissions) ? data.permissions : []
        localStorage.setItem('it_token', data.token)
        localStorage.setItem('it_user', JSON.stringify(data.user))
        localStorage.setItem('it_permissions', JSON.stringify(this.permissions))
        return true
      } catch (error) {
        console.error('LOGIN_ERROR:', error)
        if (error.response?.data?.message) this.error = error.response.data.message
        else if (error.request) this.error = 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบ Backend ที่ http://localhost:3000'
        else this.error = error.message || 'ไม่สามารถเข้าสู่ระบบได้'
        return false
      } finally { this.loading = false }
    },
    logout() {
      this.token = null; this.user = null; this.permissions = []
      localStorage.removeItem('it_token'); localStorage.removeItem('it_user'); localStorage.removeItem('it_permissions')
    },
  },
})
