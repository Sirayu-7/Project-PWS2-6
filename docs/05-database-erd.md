# Database / ERD

## Core Tables

### roles
- role_id PK
- role_name

### users
- user_id PK
- role_id FK -> roles.role_id
- name
- username UNIQUE
- password_hash
- status
- created_at

### categories
- category_id PK
- category_name
- description
- status

### equipment
- equipment_id PK
- category_id FK -> categories.category_id
- asset_code UNIQUE
- equipment_name
- brand
- model
- serial_number
- purchase_date
- status
- description
- created_at
- updated_at

### loans
- loan_id PK
- equipment_id FK -> equipment.equipment_id
- borrower_id FK -> users.user_id
- request_date
- borrow_date
- due_date
- return_date
- purpose
- status
- approved_by FK -> users.user_id
- approved_at
- remark

### returns
- return_id PK
- loan_id FK -> loans.loan_id
- condition
- return_date
- inspected_by FK -> users.user_id
- remark

### maintenance
- maintenance_id PK
- equipment_id FK -> equipment.equipment_id
- reporter_id FK -> users.user_id
- technician_id FK -> users.user_id
- problem_type
- problem_description
- priority
- status
- reported_at
- started_at
- completed_at
- repair_cost
- solution
- remark

### maintenance_logs
- log_id PK
- maintenance_id FK -> maintenance.maintenance_id
- status
- remark
- updated_by FK -> users.user_id
- created_at

### notifications
- notification_id PK
- user_id FK -> users.user_id
- title
- message
- is_read
- created_at

### audit_logs
- log_id PK
- user_id FK -> users.user_id
- action
- table_name
- record_id
- created_at

## Relationships
```text
roles 1 --- N users
categories 1 --- N equipment
users 1 --- N loans (borrower)
users 1 --- N loans (approver)
equipment 1 --- N loans
loans 1 --- 0..1 returns
equipment 1 --- N maintenance
users 1 --- N maintenance (reporter)
users 1 --- N maintenance (technician)
maintenance 1 --- N maintenance_logs
users 1 --- N notifications
users 1 --- N audit_logs
```

## Important Rules
1. `asset_code` must be unique.
2. An equipment item cannot have two active loans at the same time.
3. Equipment in Maintenance/Damaged/Lost/Retired cannot be borrowed.
4. Passwords are stored as secure hashes.
5. Foreign keys must preserve referential integrity.
