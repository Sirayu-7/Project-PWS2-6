import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import LoginView from './views/LoginView.vue'
import DashboardView from './views/DashboardView.vue'
import EquipmentView from './views/EquipmentView.vue'
import LoanView from './views/LoanView.vue'
import MaintenanceView from './views/MaintenanceView.vue'
import CategoriesView from './views/CategoriesView.vue'
import ReportsView from './views/ReportsView.vue'
import UsersView from './views/UsersView.vue'
import AuditView from './views/AuditView.vue'
import './styles.css'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: LoginView, meta: { public: true } },
    { path: '/', redirect: () => {
      const user = JSON.parse(localStorage.getItem('it_user') || '{}')
      return user.role === 'Borrower' ? '/loan' : '/dashboard'
    }},
    { path: '/dashboard', component: DashboardView, meta: { roles: ['Administrator', 'Staff', 'Borrower'] } },
    { path: '/equipment', component: EquipmentView, meta: { roles: ['Administrator', 'Staff', 'Borrower'] } },
    { path: '/categories', component: CategoriesView, meta: { roles: ['Administrator', 'Staff'] } },
    { path: '/loan', component: LoanView, meta: { roles: ['Administrator', 'Staff', 'Borrower'] } },
    { path: '/maintenance', component: MaintenanceView, meta: { roles: ['Administrator', 'Staff', 'Borrower'] } },
    { path: '/reports', component: ReportsView, meta: { roles: ['Administrator', 'Staff'] } },
    { path: '/users', component: UsersView, meta: { roles: ['Administrator'] } },
    { path: '/audit', component: AuditView, meta: { roles: ['Administrator'] } },
  ],
})

router.beforeEach((to) => {
  const token = localStorage.getItem('it_token')
  if (!to.meta.public && !token) return '/login'
  const user = JSON.parse(localStorage.getItem('it_user') || '{}')
  const defaultHome = user.role === 'Borrower' ? '/loan' : '/dashboard'
  if (to.path === '/login' && token) return defaultHome
  if (to.meta.roles && !to.meta.roles.includes(user.role)) return defaultHome
})

createApp(App).use(createPinia()).use(router).mount('#app')
