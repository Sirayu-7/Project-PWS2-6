CREATE DATABASE IF NOT EXISTS it_equipment_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE it_equipment_db;

CREATE TABLE IF NOT EXISTS roles (
  role_id INT AUTO_INCREMENT PRIMARY KEY,
  role_name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  role_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  status ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(role_id)
);

CREATE TABLE IF NOT EXISTS categories (
  category_id INT AUTO_INCREMENT PRIMARY KEY,
  category_name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  status ENUM('Active','Inactive') NOT NULL DEFAULT 'Active'
);

CREATE TABLE IF NOT EXISTS equipment (
  equipment_id INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT NOT NULL,
  asset_code VARCHAR(50) NOT NULL UNIQUE,
  equipment_name VARCHAR(150) NOT NULL,
  brand VARCHAR(100),
  model VARCHAR(100),
  serial_number VARCHAR(150),
  purchase_date DATE,
  status ENUM('Available','Borrowed','Reserved','Maintenance','Damaged','Lost','Retired') NOT NULL DEFAULT 'Available',
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_equipment_category FOREIGN KEY (category_id) REFERENCES categories(category_id)
);

CREATE TABLE IF NOT EXISTS loans (
  loan_id INT AUTO_INCREMENT PRIMARY KEY,
  equipment_id INT NOT NULL,
  borrower_id INT NOT NULL,
  request_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  borrow_date DATE,
  due_date DATE NOT NULL,
  return_date DATE,
  purpose TEXT,
  status ENUM('Pending','Approved','Rejected','Borrowed','Returned','Overdue') NOT NULL DEFAULT 'Pending',
  approved_by INT,
  approved_at TIMESTAMP NULL,
  remark TEXT,
  CONSTRAINT fk_loans_equipment FOREIGN KEY (equipment_id) REFERENCES equipment(equipment_id),
  CONSTRAINT fk_loans_borrower FOREIGN KEY (borrower_id) REFERENCES users(user_id),
  CONSTRAINT fk_loans_approver FOREIGN KEY (approved_by) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS returns (
  return_id INT AUTO_INCREMENT PRIMARY KEY,
  loan_id INT NOT NULL UNIQUE,
  condition_status ENUM('Normal','Minor Damage','Major Damage','Lost') NOT NULL,
  return_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  inspected_by INT NOT NULL,
  remark TEXT,
  CONSTRAINT fk_returns_loan FOREIGN KEY (loan_id) REFERENCES loans(loan_id),
  CONSTRAINT fk_returns_inspector FOREIGN KEY (inspected_by) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS maintenance (
  maintenance_id INT AUTO_INCREMENT PRIMARY KEY,
  equipment_id INT NOT NULL,
  reporter_id INT NOT NULL,
  technician_id INT,
  problem_type VARCHAR(100),
  problem_description TEXT NOT NULL,
  priority ENUM('Low','Normal','High','Urgent') NOT NULL DEFAULT 'Normal',
  status ENUM('Reported','Received','Diagnosing','Repairing','Completed','Cancelled') NOT NULL DEFAULT 'Reported',
  reported_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  repair_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  solution TEXT,
  remark TEXT,
  CONSTRAINT fk_maintenance_equipment FOREIGN KEY (equipment_id) REFERENCES equipment(equipment_id),
  CONSTRAINT fk_maintenance_reporter FOREIGN KEY (reporter_id) REFERENCES users(user_id),
  CONSTRAINT fk_maintenance_technician FOREIGN KEY (technician_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS maintenance_logs (
  log_id INT AUTO_INCREMENT PRIMARY KEY,
  maintenance_id INT NOT NULL,
  status VARCHAR(50) NOT NULL,
  remark TEXT,
  updated_by INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_maintenance_logs_ticket FOREIGN KEY (maintenance_id) REFERENCES maintenance(maintenance_id),
  CONSTRAINT fk_maintenance_logs_user FOREIGN KEY (updated_by) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  notification_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(150) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  log_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  action VARCHAR(100) NOT NULL,
  table_name VARCHAR(100),
  record_id VARCHAR(50),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(user_id)
);

INSERT IGNORE INTO roles (role_name) VALUES ('Administrator'), ('Staff'), ('Borrower');
INSERT IGNORE INTO categories (category_name, description) VALUES
('Notebook','คอมพิวเตอร์โน้ตบุ๊ก'),
('Desktop','คอมพิวเตอร์ตั้งโต๊ะ'),
('Projector','เครื่องฉายภาพ'),
('Network','อุปกรณ์เครือข่าย'),
('Peripheral','อุปกรณ์ต่อพ่วง');
