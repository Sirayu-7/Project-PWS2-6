# IT Equipment Loan and Maintenance Tracking System
## เอกสารความต้องการระบบ (System Requirements)

### 1. ชื่อโครงงาน
**ภาษาไทย:** ระบบบริหารจัดการการยืม-คืนและการแจ้งซ่อมอุปกรณ์เทคโนโลยีสารสนเทศ สาขาเทคโนโลยีสารสนเทศ

**ภาษาอังกฤษ:** IT Equipment Loan and Maintenance Tracking System

### 2. วัตถุประสงค์
1. พัฒนาระบบเว็บสำหรับจัดเก็บทะเบียนอุปกรณ์ไอทีอย่างเป็นระบบ
2. จัดการกระบวนการยืมและคืนอุปกรณ์ให้ตรวจสอบสถานะและผู้ครอบครองได้
3. รองรับการแจ้งปัญหาและติดตามสถานะการซ่อม
4. จัดเก็บประวัติการยืม-คืนและประวัติการซ่อมของอุปกรณ์
5. จัดทำ Dashboard และรายงานเพื่อช่วยเจ้าหน้าที่บริหารจัดการอุปกรณ์

### 3. กลุ่มผู้ใช้งาน
- **Administrator:** จัดการผู้ใช้ ข้อมูลหลัก อุปกรณ์ การยืม-คืน การซ่อม และรายงาน
- **Staff:** ดูแลอุปกรณ์ อนุมัติการยืม รับคืน และดำเนินงานซ่อม
- **Borrower/Student:** ดูอุปกรณ์ ส่งคำขอยืม ติดตามการยืม คืนอุปกรณ์ และแจ้งปัญหา

### 4. Functional Requirements
#### Authentication & Authorization
- Login / Logout
- แยกสิทธิ์ตาม Role
- เปลี่ยนรหัสผ่าน

#### Equipment Management
- เพิ่ม แก้ไข ลบ และค้นหาอุปกรณ์
- กำหนดรหัสครุภัณฑ์/Asset Code
- บันทึกประเภท ยี่ห้อ รุ่น Serial Number วันที่จัดซื้อ และรายละเอียด
- แสดงสถานะ Available, Borrowed, Reserved, Maintenance, Damaged, Lost, Retired
- ดูประวัติการใช้งานและซ่อมรายอุปกรณ์

#### Loan Management
- ค้นหาเฉพาะอุปกรณ์ที่พร้อมใช้งาน
- ส่งคำขอยืมพร้อมวัตถุประสงค์และกำหนดคืน
- Staff/Admin อนุมัติหรือปฏิเสธ
- บันทึกผู้ยืม วันยืม และกำหนดคืน
- ตรวจสอบรายการค้างคืน/เกินกำหนด

#### Return Management
- บันทึกการคืน
- ตรวจสภาพอุปกรณ์
- บันทึก Normal / Minor Damage / Major Damage / Lost
- หากพบปัญหาสามารถสร้างงานซ่อมต่อได้

#### Maintenance Management
- แจ้งซ่อมโดยผู้ยืมหรือเจ้าหน้าที่
- ระบุอาการ ปัญหา ประเภทปัญหา และระดับความเร่งด่วน
- ติดตามสถานะ Reported, Received, Diagnosing, Repairing, Completed, Cancelled
- ระบุช่าง/ผู้รับผิดชอบ ค่าใช้จ่าย วิธีแก้ไข และวันที่เสร็จ
- เก็บประวัติการเปลี่ยนสถานะ

#### Dashboard & Reports
- จำนวนอุปกรณ์ทั้งหมด
- จำนวนอุปกรณ์พร้อมใช้งาน/ถูกยืม/ซ่อม/เสีย
- รายการยืมล่าสุด
- งานซ่อมที่กำลังดำเนินการ
- รายงานการยืม-คืน
- รายงานงานซ่อม
- Export/Print ในระยะต่อไป

### 5. Non-Functional Requirements
- Responsive รองรับ Desktop/Tablet/Mobile
- UI ภาษาไทยเป็นหลักและสามารถรองรับภาษาอังกฤษในอนาคต
- ใช้งานง่าย ลดขั้นตอนการทำงานของเจ้าหน้าที่
- ตรวจสอบสิทธิ์ทุก API ที่เกี่ยวข้อง
- Password ต้องจัดเก็บแบบ Hash ไม่เก็บเป็น Plain Text
- มี Validation สำหรับข้อมูลสำคัญ
- มี Audit Log สำหรับกิจกรรมสำคัญ

### 6. ขอบเขต Version 1
**ต้องทำ:** Login/Roles, Equipment, Categories, Loan, Approval, Return, Maintenance, Dashboard, Search/Filter, History

**ทำเพิ่มได้:** QR Code, Notification, PDF/Excel, Audit Log, Statistics ขั้นสูง

### 7. Technology Stack ที่เสนอ
- Frontend: Vue 3 + Vue Router + Axios + Bootstrap 5 หรือ Tailwind CSS
- Backend: Node.js + Express.js
- Database: MySQL
- Development: VS Code, Git

### 8. Success Criteria
ระบบสามารถให้ผู้ใช้เข้าสู่ระบบตามสิทธิ์ ค้นหาอุปกรณ์ ส่งคำขอยืม อนุมัติ รับคืน แจ้งซ่อม ติดตามสถานะ และดูประวัติได้ครบตาม Workflow โดยข้อมูลมีความสัมพันธ์และตรวจสอบย้อนหลังได้
