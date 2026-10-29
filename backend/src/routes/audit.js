const express=require('express');
const db=require('../db');
const {authenticateToken,requirePermission}=require('../middleware/auth');
const {PERMISSIONS}=require('../config/permissions');
const router=express.Router();
router.use(authenticateToken,requirePermission(PERMISSIONS.AUDIT_READ));
router.get('/',async(req,res)=>{try{const [rows]=await db.execute(`SELECT a.log_id,a.user_id,u.name,a.action,a.table_name,a.record_id,a.created_at FROM audit_logs a LEFT JOIN users u ON u.user_id=a.user_id ORDER BY a.created_at DESC LIMIT 200`);res.json({success:true,data:rows})}catch(e){console.error('AUDIT_LIST_ERROR:',e.message);res.status(500).json({success:false,message:'ไม่สามารถโหลดประวัติการทำรายการได้'})}});
module.exports=router;

