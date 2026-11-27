import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import './styles.css'

// Route-level code splitting (Lazy Loading) for lightning-fast initial load
const LoginView = () => import('./views/LoginView.vue')
const DashboardView = () => import('./views/DashboardView.vue')
const EquipmentView = () => import('./views/EquipmentView.vue')
const CategoriesView = () => import('./views/CategoriesView.vue')
const LoanView = () => import('./views/LoanView.vue')
const MaintenanceView = () => import('./views/MaintenanceView.vue')
const ReportsView = () => import('./views/ReportsView.vue')
const ReportPrintView = () => import('./views/ReportPrintView.vue')
const UsersView = () => import('./views/UsersView.vue')
const AuditView = () => import('./views/AuditView.vue')

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
    { path: '/reports/print', component: ReportPrintView, meta: { roles: ['Administrator', 'Staff'], standalone: true } },
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
