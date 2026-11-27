# ระบบยืม-คืนและแจ้งซ่อมอุปกรณ์ไอทีสาขาเทคโนโลยีสารสนเทศ

ระบบเว็บสำหรับบริหารจัดการอุปกรณ์เทคโนโลยีสารสนเทศ ครอบคลุมทะเบียนอุปกรณ์ หมวดหมู่ การยืม-คืน การแจ้งและติดตามงานซ่อม บัญชีผู้ใช้ สิทธิ์การใช้งาน รายงาน และ Dashboard

เว็บไซต์ตัวอย่าง: https://project-pws2-6.vercel.app

## ความสามารถหลัก

- **Authentication & Authorization**: ล็อกอินด้วย JWT แยกสิทธิ์ตามบทบาท และจัดการโปรไฟล์
- **จัดการอุปกรณ์**: เพิ่ม แก้ไข ลบ ค้นหา ดูรายละเอียด และติดตามประวัติอุปกรณ์
- **จัดการหมวดหมู่**: จัดการหมวดหมู่พร้อมนับจำนวนอุปกรณ์ในแต่ละหมวด
- **การยืม-คืน**: ส่งคำขอยืม อนุมัติ/ปฏิเสธ บันทึกการคืน ตรวจสภาพ และตรวจรายการค้างคืน
- **งานซ่อมบำรุง**: แจ้งปัญหา มอบหมายช่าง บันทึกค่าใช้จ่ายและวิธีแก้ไข และติดตามสถานะงาน
- **Dashboard & Reports**: แสดง KPI รายงานการยืม-คืน งานซ่อม และอุปกรณ์ พร้อมส่งออก CSV และหน้าสำหรับพิมพ์
- **แจ้งเตือนผ่าน LINE**: เชื่อมบัญชีกับ LINE และส่งข้อความแจ้งเตือน/ตอบคำสั่งผ่าน LINE Messaging API
- **Audit Log**: บันทึกการเข้าสู่ระบบและกิจกรรมสำคัญของผู้ใช้งาน

## เทคโนโลยีที่ใช้

| ส่วน | เทคโนโลยี |
| :--- | :--- |
| Frontend | Vue 3, Vite, Pinia, Vue Router, Axios |
| Backend | Node.js, Express 5 |
| Database | MySQL / MariaDB |
| Authentication | JWT, bcryptjs |
| Notification | LINE Messaging API |

## บทบาทผู้ใช้งาน

| บทบาท | สิทธิ์และหน้าที่หลัก |
| :--- | :--- |
| **Administrator** | ดูแลผู้ใช้ สิทธิ์ หมวดหมู่ อุปกรณ์ การยืม-คืน งานซ่อม รายงาน และการตั้งค่าระบบ |
| **Staff** | ดูแลอุปกรณ์ อนุมัติการยืม รับคืน และดำเนินงานซ่อมบำรุง |
| **Borrower** | ดูอุปกรณ์ ส่งคำขอยืม ติดตามสถานะการยืม-คืน และแจ้งปัญหาซ่อม |

## บัญชีทดสอบ

| Role | Username | Password |
| :--- | :--- | :--- |
| Administrator | `admin` | `Admin@1234` |
| Staff | `staff` | `Staff@1234` |
| Borrower | `borrower` | `Borrower@1234` |

> ใช้เฉพาะในสภาพแวดล้อมพัฒนา ไม่ควรใช้รหัสผ่านเริ่มต้นนี้ในระบบจริง

## สิ่งที่ต้องติดตั้ง

- **Node.js 18 หรือใหม่กว่า**
- **MySQL หรือ MariaDB** แนะนำ XAMPP สำหรับใช้งานบน Windows
- **npm** ที่ติดตั้งมาพร้อม Node.js

## เริ่มใช้งานอย่างรวดเร็วบน Windows

1. เปิด XAMPP Control Panel แล้วกด **Start** ที่ MySQL
2. ดับเบิลคลิก `start.bat` หรือคลิกขวาที่ `start.ps1` แล้วเลือก **Run with PowerShell**
3. สคริปต์จะติดตั้ง dependencies สร้างไฟล์ `.env` เริ่มต้น และเตรียมฐานข้อมูลอัตโนมัติ
4. ระบบจะเปิด Backend ที่ `http://localhost:3000` และ Frontend ที่ `http://localhost:5173`

## เริ่มใช้งานด้วย Terminal

จากโฟลเดอร์หลักของโปรเจกต์:

```bash
npm run setup
```

คำสั่งนี้จะ:

1. ติดตั้ง dependencies ของทั้ง Backend และ Frontend
2. สร้างหรืออัปเดตฐานข้อมูล `it_equipment_db`
3. เพิ่มข้อมูลเริ่มต้นและบัญชีทดสอบ

จากนั้นรันระบบแยกเทอร์มินัล:

```bash
npm run dev:backend
npm run dev:frontend
```

หรือรันด้วยคำสั่งย่อยในแต่ละโฟลเดอร์:

```bash
cd backend
npm run dev

cd frontend
npm run dev
```

## ปิดระบบ

บน Windows:

```bat
stop.bat
```

หรือรันผ่าน PowerShell:

```powershell
.\stop.ps1
```

## การตั้งค่า Environment

คัดลอกไฟล์ตัวอย่างและแก้ไขค่าตามสภาพแวดล้อม:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### Backend — `backend/.env`

```dotenv
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=it_equipment_db
DB_USER=root
DB_PASSWORD=
JWT_SECRET=เปลี่ยนเป็นคีย์ลับที่สุ่มและเก็บเป็นความลับ

LINE_CHANNEL_ID=your_channel_id
LINE_CHANNEL_SECRET=your_channel_secret
LINE_CHANNEL_ACCESS_TOKEN=your_channel_access_token_here
LINE_BOT_BASIC_ID=@yourbotid
LINE_STAFF_GROUP_ID=
```

### Frontend — `frontend/.env`

```dotenv
VITE_API_URL=http://localhost:3000/api
```

## การตั้งค่า LINE Messaging API

1. สร้าง LINE Official Account และ Messaging API channel ใน LINE Developers Console
2. ตั้งค่า `LINE_CHANNEL_ID`, `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_BOT_BASIC_ID` และ `LINE_STAFF_GROUP_ID` ใน `backend/.env`
3. ตั้งค่า Webhook URL เป็น:

```text
https://<โดเมนหรือ-tunnel>/api/line/webhook
```

4. เปิด **Use webhook** ใน Messaging API และกด **Verify** เพื่อทดสอบ
5. ผู้ใช้ล็อกอินเว็บ เข้าสู่หน้าโปรไฟล์ เลือกเชื่อมต่อ LINE และขอ PIN 6 หลัก
6. ส่ง PIN 6 หลักไปที่ LINE Official Account เพื่อผูกบัญชี

สำหรับทดสอบบนเครื่องสามารถเปิด public tunnel ด้วย:

```bat
run-tunnel.bat
```

## คำสั่งที่มีอยู่

จากโฟลเดอร์หลัก:

| คำสั่ง | การทำงาน |
| :--- | :--- |
| `npm run setup` | ติดตั้ง dependencies และเตรียมฐานข้อมูล |
| `npm run install:all` | ติดตั้ง dependencies ทั้ง Backend และ Frontend |
| `npm run init:db` | สร้าง/อัปเดตฐานข้อมูลและข้อมูลเริ่มต้น |
| `npm run dev:backend` | รัน Backend โหมด watch |
| `npm run dev:frontend` | รัน Frontend ด้วย Vite |
| `npm run build` | สร้างไฟล์ Frontend สำหรับ Production |
| `npm start` | เปิดระบบผ่านสคริปต์ Windows |
| `npm run stop` | ปิดระบบผ่านสคริปต์ Windows |

## โครงสร้างโปรเจกต์

```text
.
├── backend/
│   ├── scripts/          # สคริปต์สร้างและ seed ฐานข้อมูล
│   ├── src/
│   │   ├── config/       # การตั้งค่าและข้อมูลระบบ
│   │   ├── middleware/   # Authentication และ authorization
│   │   ├── routes/       # REST API routes
│   │   ├── services/     # LINE และ business services
│   │   ├── db.js         # การเชื่อมต่อ MySQL
│   │   └── server.js     # จุดเริ่มต้น Express server
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── composables/
│   │   ├── services/     # API และ service ฝั่ง Frontend
│   │   ├── stores/       # Pinia stores
│   │   ├── views/        # หน้าและฟอร์มของระบบ
│   │   ├── App.vue
│   │   └── main.js
│   ├── .env.example
│   └── package.json
├── database/
│   └── schema.sql        # โครงสร้างฐานข้อมูล
├── docs/                 # เอกสารความต้องการ สถาปัตยกรรม และสถานะระบบ
├── backups/              # บันทึกและข้อมูลสำรอง UI
├── it_equipment_db.sql   # SQL dump สำหรับ import ด้วย phpMyAdmin
├── start.bat / start.ps1 # สคริปต์เริ่มระบบบน Windows
├── stop.bat / stop.ps1   # สคริปต์หยุดระบบบน Windows
├── run-tunnel.bat        # สคริปต์เปิด public tunnel
├── vercel.json           # การตั้งค่า Frontend บน Vercel
└── package.json          # Root scripts และข้อมูลโปรเจกต์
```

## เอกสารประกอบ

- [ความต้องการและขอบเขตระบบ](docs/01-requirements.md)
- [User Flow](docs/02-user-flow.md)
- [Sitemap](docs/03-sitemap.md)
- [Use Case](docs/04-use-case.md)
- [Database ERD](docs/05-database-erd.md)
- [Wireframe](docs/06-wireframe.md)
- [สถานะระบบและรายการตรวจสอบ](docs/step10-status.md)
