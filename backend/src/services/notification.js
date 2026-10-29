const db=require('../db');
const { emitToUser } = require('./realtime');

async function createNotification({userId,title,message}){
  if(!userId)return;
  const [result]=await db.execute('INSERT INTO notifications (user_id,title,message,is_read) VALUES (?,?,?,0)',[userId,title,message]);
  emitToUser(userId,'notification',{notification_id:result.insertId,title,message,is_read:0});
}

async function notifyRoles({roles,title,message}){
  if(!roles?.length)return;
  const placeholders=roles.map(()=>'?').join(',');
  const [rows]=await db.execute(`SELECT u.user_id FROM users u JOIN roles r ON r.role_id=u.role_id WHERE u.status='Active' AND r.role_name IN (${placeholders})`,roles);
  if(!rows.length)return;
  await Promise.all(rows.map(u=>createNotification({userId:u.user_id,title,message})));
}

module.exports={createNotification,notifyRoles};
