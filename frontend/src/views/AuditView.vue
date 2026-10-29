<template>
  <div class="page-card">
    <div class="page-header"><div><h3>ประวัติการทำรายการ</h3><p>ตรวจสอบกิจกรรมสำคัญของผู้ใช้งานระบบ</p></div><button class="btn" @click="load">↻ รีเฟรช</button></div>
    <div v-if="error" class="alert error">{{ error }}</div>
    <div class="table-wrap"><table><thead><tr><th>วันเวลา</th><th>ผู้ใช้งาน</th><th>การทำรายการ</th><th>ตาราง</th><th>Record ID</th></tr></thead><tbody>
      <tr v-for="row in rows" :key="row.log_id"><td>{{ formatDate(row.created_at) }}</td><td>{{ row.name || row.user_id || '-' }}</td><td><span class="badge">{{ row.action }}</span></td><td>{{ row.table_name || '-' }}</td><td>{{ row.record_id || '-' }}</td></tr>
      <tr v-if="!rows.length"><td colspan="5" class="empty">ไม่พบประวัติการทำรายการ</td></tr>
    </tbody></table></div>
  </div>
</template>
<script setup>
import { ref, onMounted } from 'vue'
import api from '../services/api'
const rows=ref([]),error=ref('')
const load=async()=>{error.value='';try{const r=await api.get('/audit');rows.value=r.data.data||[]}catch(e){error.value=e.response?.data?.message||'ไม่สามารถโหลดประวัติการทำรายการได้'}}
const formatDate=v=>v?new Date(v).toLocaleString('th-TH'):'-'
onMounted(load)
</script>
