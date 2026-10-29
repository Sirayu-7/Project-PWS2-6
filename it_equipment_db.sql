-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Oct 03, 2026 at 06:09 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.0.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `it_equipment_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `audit_logs`
--

CREATE TABLE `audit_logs` (
  `log_id` bigint(20) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `action` varchar(100) NOT NULL,
  `table_name` varchar(100) DEFAULT NULL,
  `record_id` varchar(50) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `audit_logs`
--

INSERT INTO `audit_logs` (`log_id`, `user_id`, `action`, `table_name`, `record_id`, `created_at`) VALUES
(1, 1, 'LOGIN', 'users', '1', '2026-10-03 14:13:42'),
(2, 2, 'LOGIN', 'users', '2', '2026-10-03 14:13:42'),
(3, 3, 'LOGIN', 'users', '3', '2026-10-03 14:13:42'),
(4, 1, 'LOGIN', 'users', '1', '2026-10-03 14:13:47'),
(5, 1, 'LOGIN', 'users', '1', '2026-10-03 14:13:48'),
(6, 1, 'LOGIN', 'users', '1', '2026-10-03 14:14:56'),
(7, 1, 'LOGIN', 'users', '1', '2026-10-03 14:14:59'),
(8, 1, 'LOGIN', 'users', '1', '2026-10-03 14:15:07'),
(9, 1, 'LOGIN', 'users', '1', '2026-10-03 14:15:14'),
(10, 1, 'LOGIN', 'users', '1', '2026-10-03 14:16:31'),
(11, 1, 'LOGIN', 'users', '1', '2026-10-03 14:22:11'),
(12, 1, 'LOGIN', 'users', '1', '2026-10-03 14:27:59'),
(13, 1, 'LOGIN', 'users', '1', '2026-10-03 14:28:25'),
(14, 3, 'LOGIN', 'users', '3', '2026-10-03 14:28:32'),
(15, 3, 'CHANGE_PASSWORD', 'users', '3', '2026-10-03 14:28:32'),
(16, 3, 'CHANGE_PASSWORD', 'users', '3', '2026-10-03 14:28:32'),
(17, 1, 'LOGIN', 'users', '1', '2026-10-03 14:31:25'),
(18, 2, 'LOGIN', 'users', '2', '2026-10-03 14:31:26'),
(19, 3, 'LOGIN', 'users', '3', '2026-10-03 14:31:26'),
(20, 1, 'LOGIN', 'users', '1', '2026-10-03 14:31:26'),
(21, 1, 'LOGIN', 'users', '1', '2026-10-03 14:31:27'),
(22, 1, 'LOGIN', 'users', '1', '2026-10-03 14:31:40'),
(23, 1, 'CREATE_CATEGORY', 'categories', '6', '2026-10-03 14:31:40'),
(24, 1, 'DELETE_CATEGORY', 'categories', '6', '2026-10-03 14:31:40'),
(25, 1, 'LOGIN', 'users', '1', '2026-10-03 15:42:16'),
(26, 1, 'CREATE_LOAN', 'loans', '1', '2026-10-03 15:48:47'),
(27, 1, 'CREATE_MAINTENANCE', 'maintenance', '1', '2026-10-03 15:52:31');

-- --------------------------------------------------------

--
-- Table structure for table `categories`
--

CREATE TABLE `categories` (
  `category_id` int(11) NOT NULL,
  `category_name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `status` enum('Active','Inactive') NOT NULL DEFAULT 'Active'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `categories`
--

INSERT INTO `categories` (`category_id`, `category_name`, `description`, `status`) VALUES
(1, 'Notebook', 'คอมพิวเตอร์โน้ตบุ๊ก', 'Active'),
(2, 'Desktop', 'คอมพิวเตอร์ตั้งโต๊ะ', 'Active'),
(3, 'Projector', 'เครื่องฉายภาพ', 'Active'),
(4, 'Network', 'อุปกรณ์เครือข่าย', 'Active'),
(5, 'Peripheral', 'อุปกรณ์ต่อพ่วง', 'Active');

-- --------------------------------------------------------

--
-- Table structure for table `equipment`
--

CREATE TABLE `equipment` (
  `equipment_id` int(11) NOT NULL,
  `category_id` int(11) NOT NULL,
  `asset_code` varchar(50) NOT NULL,
  `equipment_name` varchar(150) NOT NULL,
  `brand` varchar(100) DEFAULT NULL,
  `model` varchar(100) DEFAULT NULL,
  `serial_number` varchar(150) DEFAULT NULL,
  `purchase_date` date DEFAULT NULL,
  `status` enum('Available','Borrowed','Reserved','Maintenance','Damaged','Lost','Retired') NOT NULL DEFAULT 'Available',
  `description` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `equipment`
--

INSERT INTO `equipment` (`equipment_id`, `category_id`, `asset_code`, `equipment_name`, `brand`, `model`, `serial_number`, `purchase_date`, `status`, `description`, `created_at`, `updated_at`) VALUES
(1, 1, 'EQ-NB-001', 'Dell Latitude 5440', 'Dell', 'Latitude 5440', 'SN-DL-8821', '2025-01-15', 'Maintenance', 'โน้ตบุ๊กสำหรับทำงาน Core i5 RAM 16GB SSD 512GB', '2026-10-03 14:16:25', '2026-10-03 15:52:31'),
(2, 1, 'EQ-NB-002', 'Lenovo ThinkPad E14 Gen 5', 'Lenovo', 'ThinkPad E14', 'SN-LN-9912', '2025-02-10', 'Borrowed', 'โน้ตบุ๊กสำหรับยืมออกนอกสถานที่', '2026-10-03 14:16:25', '2026-10-03 14:16:25'),
(3, 1, 'EQ-NB-003', 'MacBook Air M2 13\"', 'Apple', 'MacBook Air', 'SN-AP-4410', '2025-03-01', 'Available', 'สำหรับงานกราฟิกและสื่อ', '2026-10-03 14:16:25', '2026-10-03 14:16:25'),
(4, 2, 'EQ-DT-001', 'HP ProDesk 400 G7', 'HP', 'ProDesk 400', 'SN-HP-3321', '2024-11-20', 'Available', 'เครื่องคอมพิวเตอร์ตั้งโต๊ะสำนักงาน', '2026-10-03 14:16:25', '2026-10-03 14:16:25'),
(5, 3, 'EQ-PJ-001', 'Epson EB-X06 Projector', 'Epson', 'EB-X06', 'SN-EP-1002', '2024-10-05', 'Available', 'โปรเจกเตอร์ความสว่าง 3,600 Lumens สำหรับห้องประชุม', '2026-10-03 14:16:25', '2026-10-03 14:16:25'),
(6, 4, 'EQ-NW-001', 'Cisco Catalyst 2960-X Switch', 'Cisco', 'Catalyst 2960-X', 'SN-CS-7711', '2024-08-12', 'Maintenance', 'สวิตช์เครือข่าย 24 พอร์ต ส่งตรวจเช็คพอร์ตเสีย', '2026-10-03 14:16:25', '2026-10-03 14:16:25'),
(7, 5, 'EQ-PR-001', 'Logitech MX Master 3S', 'Logitech', 'MX Master 3S', 'SN-LG-5520', '2025-01-20', 'Available', 'เมาส์ไร้สายบลูทูธความแม่นยำสูง', '2026-10-03 14:16:25', '2026-10-03 14:16:25');

-- --------------------------------------------------------

--
-- Table structure for table `loans`
--

CREATE TABLE `loans` (
  `loan_id` int(11) NOT NULL,
  `equipment_id` int(11) NOT NULL,
  `borrower_id` int(11) NOT NULL,
  `request_date` timestamp NOT NULL DEFAULT current_timestamp(),
  `borrow_date` date DEFAULT NULL,
  `due_date` date NOT NULL,
  `return_date` date DEFAULT NULL,
  `purpose` text DEFAULT NULL,
  `status` enum('Pending','Approved','Rejected','Borrowed','Returned','Overdue') NOT NULL DEFAULT 'Pending',
  `approved_by` int(11) DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `remark` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `loans`
--

INSERT INTO `loans` (`loan_id`, `equipment_id`, `borrower_id`, `request_date`, `borrow_date`, `due_date`, `return_date`, `purpose`, `status`, `approved_by`, `approved_at`, `remark`) VALUES
(1, 1, 1, '2026-10-03 15:48:47', NULL, '2026-10-03', NULL, 'ทำการเรียนการสอน', 'Pending', NULL, NULL, 'ใช้ที่ห้องเรียน ป.1 - ป6');

-- --------------------------------------------------------

--
-- Table structure for table `maintenance`
--

CREATE TABLE `maintenance` (
  `maintenance_id` int(11) NOT NULL,
  `equipment_id` int(11) NOT NULL,
  `reporter_id` int(11) NOT NULL,
  `technician_id` int(11) DEFAULT NULL,
  `problem_type` varchar(100) DEFAULT NULL,
  `problem_description` text NOT NULL,
  `priority` enum('Low','Normal','High','Urgent') NOT NULL DEFAULT 'Normal',
  `status` enum('Reported','Received','Diagnosing','Repairing','Completed','Cancelled') NOT NULL DEFAULT 'Reported',
  `reported_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `started_at` timestamp NULL DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `repair_cost` decimal(10,2) NOT NULL DEFAULT 0.00,
  `solution` text DEFAULT NULL,
  `remark` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `maintenance`
--

INSERT INTO `maintenance` (`maintenance_id`, `equipment_id`, `reporter_id`, `technician_id`, `problem_type`, `problem_description`, `priority`, `status`, `reported_at`, `started_at`, `completed_at`, `repair_cost`, `solution`, `remark`) VALUES
(1, 1, 1, NULL, 'พอร์ตชำรุด', 'พอร์ต usd ขวามือช่องแรกใช้ไม่ได้', 'Normal', 'Reported', '2026-10-03 15:52:31', NULL, NULL, 0.00, NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `maintenance_logs`
--

CREATE TABLE `maintenance_logs` (
  `log_id` int(11) NOT NULL,
  `maintenance_id` int(11) NOT NULL,
  `status` varchar(50) NOT NULL,
  `remark` text DEFAULT NULL,
  `updated_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `maintenance_logs`
--

INSERT INTO `maintenance_logs` (`log_id`, `maintenance_id`, `status`, `remark`, `updated_by`, `created_at`) VALUES
(1, 1, 'Reported', 'ส่งเรื่องแจ้งซ่อมเข้าระบบ', 1, '2026-10-03 15:52:31');

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `notification_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `title` varchar(150) NOT NULL,
  `message` text NOT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `notifications`
--

INSERT INTO `notifications` (`notification_id`, `user_id`, `title`, `message`, `is_read`, `created_at`) VALUES
(1, 1, 'มีคำขอยืมอุปกรณ์ใหม่', 'มีคำขอยืมรายการ #1 รอการอนุมัติ', 0, '2026-10-03 15:48:47'),
(2, 2, 'มีคำขอยืมอุปกรณ์ใหม่', 'มีคำขอยืมรายการ #1 รอการอนุมัติ', 0, '2026-10-03 15:48:47'),
(3, 2, 'มีรายการแจ้งซ่อมใหม่', 'มีรายการแจ้งซ่อม #1 (พอร์ตชำรุด) รอตรวจสอบ', 0, '2026-10-03 15:52:31'),
(4, 1, 'มีรายการแจ้งซ่อมใหม่', 'มีรายการแจ้งซ่อม #1 (พอร์ตชำรุด) รอตรวจสอบ', 0, '2026-10-03 15:52:31');

-- --------------------------------------------------------

--
-- Table structure for table `returns`
--

CREATE TABLE `returns` (
  `return_id` int(11) NOT NULL,
  `loan_id` int(11) NOT NULL,
  `condition_status` enum('Normal','Minor Damage','Major Damage','Lost') NOT NULL,
  `return_date` timestamp NOT NULL DEFAULT current_timestamp(),
  `inspected_by` int(11) NOT NULL,
  `remark` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `roles`
--

CREATE TABLE `roles` (
  `role_id` int(11) NOT NULL,
  `role_name` varchar(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `roles`
--

INSERT INTO `roles` (`role_id`, `role_name`) VALUES
(1, 'Administrator'),
(3, 'Borrower'),
(2, 'Staff');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `user_id` int(11) NOT NULL,
  `role_id` int(11) NOT NULL,
  `name` varchar(150) NOT NULL,
  `username` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `status` enum('Active','Inactive') NOT NULL DEFAULT 'Active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`user_id`, `role_id`, `name`, `username`, `password_hash`, `status`, `created_at`) VALUES
(1, 1, 'ผู้ดูแลระบบ', 'admin', '$2b$12$S3fbpOghIwz4Kx9XWvjR7.tHr3NZtWBovFBk/jZjd.uzEDGf.PVv2', 'Active', '2026-10-03 14:13:31'),
(2, 2, 'Test Staff', 'staff', '$2b$12$X4pPUl..ynirXuYvn0IKU..u/nY7pACBMSSwndh0WUvDVhCdocZ6a', 'Active', '2026-10-03 14:13:32'),
(3, 3, 'Test Borrower', 'borrower', '$2b$12$TkTI6FIVw9YnaoSAteQfWOhFWRx6TckV4JUcz1yJkVSbzk02zFKmO', 'Active', '2026-10-03 14:13:32');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `audit_logs`
--
ALTER TABLE `audit_logs`
  ADD PRIMARY KEY (`log_id`),
  ADD KEY `fk_audit_user` (`user_id`);

--
-- Indexes for table `categories`
--
ALTER TABLE `categories`
  ADD PRIMARY KEY (`category_id`),
  ADD UNIQUE KEY `category_name` (`category_name`);

--
-- Indexes for table `equipment`
--
ALTER TABLE `equipment`
  ADD PRIMARY KEY (`equipment_id`),
  ADD UNIQUE KEY `asset_code` (`asset_code`),
  ADD KEY `fk_equipment_category` (`category_id`);

--
-- Indexes for table `loans`
--
ALTER TABLE `loans`
  ADD PRIMARY KEY (`loan_id`),
  ADD KEY `fk_loans_equipment` (`equipment_id`),
  ADD KEY `fk_loans_borrower` (`borrower_id`),
  ADD KEY `fk_loans_approver` (`approved_by`);

--
-- Indexes for table `maintenance`
--
ALTER TABLE `maintenance`
  ADD PRIMARY KEY (`maintenance_id`),
  ADD KEY `fk_maintenance_equipment` (`equipment_id`),
  ADD KEY `fk_maintenance_reporter` (`reporter_id`),
  ADD KEY `fk_maintenance_technician` (`technician_id`);

--
-- Indexes for table `maintenance_logs`
--
ALTER TABLE `maintenance_logs`
  ADD PRIMARY KEY (`log_id`),
  ADD KEY `fk_maintenance_logs_ticket` (`maintenance_id`),
  ADD KEY `fk_maintenance_logs_user` (`updated_by`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`notification_id`),
  ADD KEY `fk_notifications_user` (`user_id`);

--
-- Indexes for table `returns`
--
ALTER TABLE `returns`
  ADD PRIMARY KEY (`return_id`),
  ADD UNIQUE KEY `loan_id` (`loan_id`),
  ADD KEY `fk_returns_inspector` (`inspected_by`);

--
-- Indexes for table `roles`
--
ALTER TABLE `roles`
  ADD PRIMARY KEY (`role_id`),
  ADD UNIQUE KEY `role_name` (`role_name`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`user_id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD KEY `fk_users_role` (`role_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `audit_logs`
--
ALTER TABLE `audit_logs`
  MODIFY `log_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=28;

--
-- AUTO_INCREMENT for table `categories`
--
ALTER TABLE `categories`
  MODIFY `category_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `equipment`
--
ALTER TABLE `equipment`
  MODIFY `equipment_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `loans`
--
ALTER TABLE `loans`
  MODIFY `loan_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `maintenance`
--
ALTER TABLE `maintenance`
  MODIFY `maintenance_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `maintenance_logs`
--
ALTER TABLE `maintenance_logs`
  MODIFY `log_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `notification_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `returns`
--
ALTER TABLE `returns`
  MODIFY `return_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `roles`
--
ALTER TABLE `roles`
  MODIFY `role_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `user_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `audit_logs`
--
ALTER TABLE `audit_logs`
  ADD CONSTRAINT `fk_audit_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `equipment`
--
ALTER TABLE `equipment`
  ADD CONSTRAINT `fk_equipment_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`category_id`);

--
-- Constraints for table `loans`
--
ALTER TABLE `loans`
  ADD CONSTRAINT `fk_loans_approver` FOREIGN KEY (`approved_by`) REFERENCES `users` (`user_id`),
  ADD CONSTRAINT `fk_loans_borrower` FOREIGN KEY (`borrower_id`) REFERENCES `users` (`user_id`),
  ADD CONSTRAINT `fk_loans_equipment` FOREIGN KEY (`equipment_id`) REFERENCES `equipment` (`equipment_id`);

--
-- Constraints for table `maintenance`
--
ALTER TABLE `maintenance`
  ADD CONSTRAINT `fk_maintenance_equipment` FOREIGN KEY (`equipment_id`) REFERENCES `equipment` (`equipment_id`),
  ADD CONSTRAINT `fk_maintenance_reporter` FOREIGN KEY (`reporter_id`) REFERENCES `users` (`user_id`),
  ADD CONSTRAINT `fk_maintenance_technician` FOREIGN KEY (`technician_id`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `maintenance_logs`
--
ALTER TABLE `maintenance_logs`
  ADD CONSTRAINT `fk_maintenance_logs_ticket` FOREIGN KEY (`maintenance_id`) REFERENCES `maintenance` (`maintenance_id`),
  ADD CONSTRAINT `fk_maintenance_logs_user` FOREIGN KEY (`updated_by`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `notifications`
--
ALTER TABLE `notifications`
  ADD CONSTRAINT `fk_notifications_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `returns`
--
ALTER TABLE `returns`
  ADD CONSTRAINT `fk_returns_inspector` FOREIGN KEY (`inspected_by`) REFERENCES `users` (`user_id`),
  ADD CONSTRAINT `fk_returns_loan` FOREIGN KEY (`loan_id`) REFERENCES `loans` (`loan_id`);

--
-- Constraints for table `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `fk_users_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`role_id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
