# User Flow

## 1. Authentication
```text
Start -> Login -> Validate Account -> [Success] Dashboard -> [Fail] Show Error -> Login
```

## 2. Borrower: ยืมอุปกรณ์
```text
Dashboard
  -> Equipment
  -> Search/Filter
  -> Equipment Detail
  -> Borrow
  -> Fill Borrow Form
  -> Submit Request
  -> Pending
  -> Staff/Admin Approval
       -> Approved -> Borrowed
       -> Rejected -> Rejected
```

## 3. Staff/Admin: อนุมัติการยืม
```text
Loan Approval
  -> Open Request
  -> Check Equipment + Borrower + Due Date
  -> Approve / Reject
  -> System updates Loan Status
  -> System updates Equipment Status
```

## 4. คืนอุปกรณ์
```text
My Loans / Loan Management
  -> Select Active Loan
  -> Return
  -> Staff checks condition
      -> Normal -> Returned + Equipment Available
      -> Damaged -> Returned + Create Maintenance
      -> Lost -> Returned/Lost process + Equipment Lost
```

## 5. แจ้งซ่อม
```text
Equipment / Maintenance
  -> Report Issue
  -> Fill Problem + Priority
  -> Submit
  -> Reported
  -> Staff receives
  -> Diagnosing
  -> Repairing
  -> Completed
  -> Equipment Available (when repaired)
```

## 6. Equipment Lifecycle
```text
Registered -> Available -> Borrowed -> Returned -> Available
                          |
                          v
                    Maintenance
                          |
                +---------+---------+
                |                   |
            Completed            Damaged
                |                   |
                v                   v
            Available             Damaged
```
