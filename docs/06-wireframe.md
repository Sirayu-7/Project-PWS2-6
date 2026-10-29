# UX/UI Wireframe

Low-fidelity wireframe สำหรับนำเสนออาจารย์ก่อนพัฒนา UI จริง

## Global Layout
```text
┌──────────────────────────────────────────────────────────────┐
│ Logo / IT Equipment System        Notification   User ▼     │
├───────────────┬──────────────────────────────────────────────┤
│ Dashboard     │                                              │
│ Equipment     │                 PAGE CONTENT                 │
│ Loan          │                                              │
│ Return        │                                              │
│ Maintenance   │                                              │
│ Reports       │                                              │
│ Users         │                                              │
│ Settings      │                                              │
└───────────────┴──────────────────────────────────────────────┘
```

## WF01 Login
```text
┌──────────────────────────────┐
│      IT EQUIPMENT SYSTEM     │
│                              │
│ Username                     │
│ [________________________]   │
│ Password                     │
│ [________________________]   │
│                              │
│        [ LOGIN ]             │
└──────────────────────────────┘
```

## WF02 Dashboard
```text
Dashboard

┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ Total    │ │Available │ │ Borrowed │ │ Repair   │
│   120    │ │    77    │ │    35    │ │     8    │
└──────────┘ └──────────┘ └──────────┘ └──────────┘

┌─────────────────────────┐ ┌───────────────────────────────┐
│ Loan Statistics         │ │ Maintenance Status            │
│        [ Chart ]        │ │          [ Chart ]             │
└─────────────────────────┘ └───────────────────────────────┘

Recent Activities
┌────────────────────────────────────────────────────────────┐
│ Time       User       Action              Equipment        │
└────────────────────────────────────────────────────────────┘
```

## WF03 Equipment List
```text
Equipment
[ + Add Equipment ]

Search [_____________] Category [All ▼] Status [All ▼]

┌──────┬──────────────┬───────────┬────────────┬───────────┐
│ Code │ Name         │ Category  │ Status     │ Action    │
├──────┼──────────────┼───────────┼────────────┼───────────┤
│IT001 │ ThinkPad T14 │ Notebook  │ Available  │ View Edit │
│IT002 │ Epson X1     │ Projector │ Borrowed   │ View Edit │
└──────┴──────────────┴───────────┴────────────┴───────────┘
```

## WF04 Equipment Detail
```text
Equipment Detail

┌──────────────────────────────────────────────────────┐
│ IT001 | Lenovo ThinkPad T14                          │
│ Status: Available                                    │
│ Brand / Model / Serial / Purchase Date               │
│ Description                                          │
│                                      [ Borrow ]       │
└──────────────────────────────────────────────────────┘

[ Loan History ] [ Maintenance History ]

Timeline
● 09/09 Returned
● 25/08 Borrowed
● 10/07 Maintenance Completed
```

## WF05 Borrow Request
```text
Borrow Equipment

Equipment [ ThinkPad T14 ▼ ]
Borrow Date [ 09/09/2026 ]
Due Date    [ 16/09/2026 ]
Purpose
┌────────────────────────────────────────────┐
│                                            │
└────────────────────────────────────────────┘

[ Cancel ]                         [ Submit ]
```

## WF06 Loan Approval
```text
Loan Approval

┌────┬──────────┬──────────────┬──────────┬───────────┐
│ ID │ Borrower │ Equipment    │ Due Date │ Status    │
├────┼──────────┼──────────────┼──────────┼───────────┤
│001 │ Somchai  │ ThinkPad T14 │ 16/09    │ Pending   │
└────┴──────────┴──────────────┴──────────┴───────────┘

[ View ] [ Approve ] [ Reject ]
```

## WF07 Return
```text
Return Equipment

Loan ID: LN0001
Borrower: Somchai
Equipment: ThinkPad T14

Condition
( ) Normal
( ) Minor Damage
( ) Major Damage
( ) Lost

Remark [_______________________________]

[ Confirm Return ]
```

## WF08 Maintenance List
```text
Maintenance
[ + Report Issue ]

Search [____________] Status [All ▼] Priority [All ▼]

┌────┬────────────┬──────────────┬────────────┬───────────┐
│ ID │ Equipment  │ Problem      │ Technician │ Status    │
├────┼────────────┼──────────────┼────────────┼───────────┤
│M01 │ ThinkPad   │ No Boot      │ Staff      │ Repairing │
└────┴────────────┴──────────────┴────────────┴───────────┘
```

## WF09 Maintenance Detail
```text
Maintenance #M01
Equipment: ThinkPad T14
Problem: เปิดเครื่องไม่ติด
Priority: High
Status: Repairing
Technician: Staff

Timeline
Reported -> Received -> Diagnosing -> Repairing -> Completed

Repair Cost [________]
Solution    [_______________________________]

[ Update Status ]
```

## WF10 Reports
```text
Reports

Report Type [ Loan / Return / Maintenance ▼ ]
From [________] To [________]
Status [All ▼]

[ Search ] [ Print ] [ Export Excel ]

                 REPORT TABLE
┌─────────────────────────────────────────────────────┐
│                                                     │
└─────────────────────────────────────────────────────┘
```

## UI Design Direction
- Primary: Blue
- Neutral: Slate/Dark Gray
- Background: Light Gray
- Success: Green
- Warning: Amber
- Danger: Red
- Font: Noto Sans Thai หรือ Prompt
- Layout: Sidebar + Topbar + Content
- Component: Card, Table, Badge, Modal, Form, Toast, Pagination
