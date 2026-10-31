# IT Equipment Management System (ระบบจัดการอุปกรณ์ IT)

ระบบบริหารจัดการอุปกรณ์ IT ครบวงจร ทั้งการบันทึกข้อมูลอุปกรณ์ เบิก-ยืม-คืน ตรวจเช็ค ซ่อมบำรุง การแจ้งเตือน และระบบ Audit Log รองรับการแบ่งสิทธิ์ผู้ใช้งาน (Administrator, Staff, Borrower)

---

## 🛠 สิ่งที่ต้องมีในเครื่องใหม่ (Prerequisites)

1. **Node.js** (เวอร์ชัน 18.0 ขึ้นไป) -> ดาวน์โหลดได้ที่ [nodejs.org](https://nodejs.org/)
2. **MySQL / MariaDB** (แนะนำให้ติดตั้ง **XAMPP**) -> ดาวน์โหลดได้ที่ [apachefriends.org](https://www.apachefriends.org/)

---

## 🚀 วิธีเปิดใช้งานในเครื่องใหม่ (Quick Start)

### วิธีที่ง่ายที่สุด (คลิกเดียวจบสำหรับ Windows)
1. เปิดโปรแกรม **XAMPP Control Panel** แล้วกดปุ่ม **[Start]** ที่ **MySQL**
2. ดับเบิ้ลคลิกไฟล์ **`start.bat`** (หรือคลิกขวา `start.ps1` -> Run with PowerShell)
3. ระบบจะจัดการทุกอย่างให้อัตโนมัติ:
   - ตรวจหาโปรแกรม Node.js ในเครื่อง
   - สร้างไฟล์คอนฟิก `.env` ให้ทั้ง Backend และ Frontend อัตโนมัติ (หากยังไม่มี)
   - ติดตั้ง dependencies (`npm install`) ให้อัตโนมัติ (หากยังไม่มี `node_modules`)
   - ตรวจสอบ MySQL และสร้างฐานข้อมูล `it_equipment_db` พร้อมสร้างตารางและข้อมูลเริ่มต้นให้ทันที (ไม่ต้อง Import เอง!)
   - สตาร์ท Backend และ Frontend พร้อมเปิดเบราว์เซอร์เข้าสู่ระบบให้ทันที

---

## 💻 วิธีเปิดใช้งานผ่าน Terminal / Command Line

หากต้องการรันด้วยคำสั่งผ่าน VS Code หรือ Terminal:

1. **ติดตั้ง dependencies และตั้งค่าฐานข้อมูลอัตโนมัติ:**
   ```bash
   npm run setup
   ```
   *(คำสั่งนี้จะรัน npm install ทั้งโปรเจกต์ และสร้าง Database พร้อม seed ข้อมูลให้อัตโนมัติ)*

2. **เปิดระบบแยกตามโฟลเดอร์:**
   - **Backend:**
     ```bash
     cd backend
     npm run dev
     ```
     *(ทำงานที่ http://localhost:3000)*
   
   - **Frontend:**
     ```bash
     cd frontend
     npm run dev
     ```
     *(ทำงานที่ http://localhost:5173)*

---

## 🛑 วิธีปิดการทำงานของระบบ

- ดับเบิ้ลคลิกไฟล์ **`stop.bat`** หรือรัน **`.\stop.ps1`** ระบบจะเคลียร์และปิดเซิร์ฟเวอร์ทั้ง Port 3000 และ 5173 ให้อัตโนมัติ

---

## 🔑 บัญชีทดสอบระบบ (Default Demo Accounts)

| สิทธิ์ (Role) | Username | Password | รายละเอียดการใช้งาน |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin` | `Admin@1234` | สิทธิ์สูงสุด ดูแลผู้ใช้งาน หมวดหมู่ อุปกรณ์ และระบบทั้งหมด |
| **Staff** | `staff` | `Staff@1234` | เจ้าหน้าที่ดูแลอุปกรณ์ จัดการยืม-คืน บันทึกซ่อมบำรุง |
| **Borrower** | `borrower` | `Borrower@1234` | ผู้ใช้ทั่วไป (เช่น พนักงาน) ทำเรื่องขอยืมและดูประวัติของตนเอง |

---

## ⚙️ การตั้งค่าระบบ (Configuration)

หากต้องการเปลี่ยนพอร์ตหรือการเชื่อมต่อ MySQL สามารถแก้ไขได้ที่ไฟล์:
- **`backend/.env`**
  ```env
  PORT=3000
  DB_HOST=127.0.0.1
  DB_PORT=3306
  DB_NAME=it_equipment_db
  DB_USER=root
  DB_PASSWORD=
  JWT_SECRET=it-equipment-project-change-this-secret

  # LINE Messaging API Configuration
  LINE_CHANNEL_ID=2012304828
  LINE_CHANNEL_SECRET=90bf72df009f082ce57967292356e0f2
  LINE_CHANNEL_ACCESS_TOKEN=your_channel_access_token_here
  LINE_BOT_BASIC_ID=@yourbotid
  LINE_STAFF_GROUP_ID=
  ```
- **`frontend/.env`**
  ```env
  VITE_API_URL=http://localhost:3000/api
  ```

---

## 📱 การตั้งค่า LINE Messaging API & Webhook

ระบบรองรับการเชื่อมต่อกับ **LINE Official Account (LINE Bot)** แบบ 2 ทาง (แจ้งเตือน + โต้ตอบ + อนุมัติ/ปฏิเสธคำขอ):

1. **ตั้งค่า Webhook URL ใน LINE Developers Console:**
   - ไปที่แท็บ **Messaging API**
   - ในหัวข้อ **Webhook settings** ใส่ URL:
     `https://<โดเมนของคุณ>/api/line/webhook`
     *(สำหรับการทดสอบในเครื่อง Dev สามารถใช้โปรแกรมจำลอง เช่น ngrok / Cloudflare Tunnel เช่น `https://xxxx.ngrok-free.app/api/line/webhook`)*
   - กดปุ่ม **Verify** และเปิดสวิตช์ **Use webhook** เป็น **ON**
2. **การออก Channel Access Token:**
   - ในแท็บ **Messaging API** เลื่อนลงมาที่หัวข้อ **Channel access token (long-lived)**
   - กดปุ่ม **Issue** แล้วนำค่า Token มาใส่ใน `backend/.env` ที่ตัวแปร `LINE_CHANNEL_ACCESS_TOKEN`
3. **การผูกบัญชีผู้ใช้ (Account Linking):**
   - ผู้ใช้งานล็อกอินเข้าสู่ระบบผ่านเว็บ -> กดที่โปรไฟล์ที่มุมขวาบน หรือที่แถบเมนูด้านล่างซ้าย
   - เลือกแท็บ **"การเชื่อมต่อ LINE"** แล้วกดปุ่ม **"ขอรหัสเชื่อมต่อ LINE (PIN)"**
   - นำรหัส PIN 6 หลักที่ได้ไปส่งในแชทของ LINE Official Account ระบบจะทำการเชื่อมโยงบัญชีและเริ่มส่งการแจ้งเตือนทันที!

---

## 📁 โครงสร้างโปรเจกต์ (Project Structure)

```text
├── backend/            # Express.js REST API + WebSocket/Realtime + MySQL connection
│   ├── scripts/        # สคริปต์ init-db.js และ Seed ข้อมูล
│   ├── src/            # Controllers, Routes, Middleware, Services
│   ├── .env.example    # ไฟล์ตัวอย่าง Environment variables
│   └── package.json
├── frontend/           # Vue 3 Single Page Application (Vite + Pinia + Tailwind/CSS)
│   ├── src/            # Pages, Components, Stores, Router, Services
│   ├── .env.example
│   └── package.json
├── database/
│   └── schema.sql      # โครงสร้างตารางฐานข้อมูลและข้อมูลตั้งต้น
├── it_equipment_db.sql # ไฟล์ Full SQL Dump สำรอง (กรณีต้องการ import ผ่าน phpMyAdmin)
├── start.bat           # ตัวรันระบบอัตโนมัติ (Batch file)
├── start.ps1           # ตัวรันระบบอัตโนมัติ (PowerShell)
├── stop.bat            # สคริปต์หยุดระบบ (Batch file)
├── stop.ps1            # สคริปต์หยุดระบบ (PowerShell)
└── package.json        # Root script runner
```

