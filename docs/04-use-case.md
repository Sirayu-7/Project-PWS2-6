# Use Case Specification

## Actors
- Borrower/Student
- Staff
- Administrator

## Use Cases

| ID | Use Case | Borrower | Staff | Admin |
|---|---|---:|---:|---:|
| UC01 | Login/Logout | ✓ | ✓ | ✓ |
| UC02 | View Equipment | ✓ | ✓ | ✓ |
| UC03 | Manage Equipment | - | ✓ | ✓ |
| UC04 | Request Loan | ✓ | ✓ | ✓ |
| UC05 | Approve/Reject Loan | - | ✓ | ✓ |
| UC06 | Record Return | - | ✓ | ✓ |
| UC07 | View My Loan History | ✓ | - | - |
| UC08 | Report Maintenance | ✓ | ✓ | ✓ |
| UC09 | Manage Maintenance | - | ✓ | ✓ |
| UC10 | View Reports | - | ✓ | ✓ |
| UC11 | Manage Users | - | - | ✓ |
| UC12 | Manage Categories | - | ✓ | ✓ |
| UC13 | View Equipment History | ✓ | ✓ | ✓ |

## Main Relationships
- Request Loan -> Validate Equipment Availability -> Create Loan Request
- Approve Loan -> Update Loan Status -> Update Equipment Status
- Record Return -> Inspect Condition -> Update Equipment Status
- Report Maintenance -> Create Maintenance Ticket -> Track Status
- Complete Maintenance -> Update Equipment Status to Available when applicable
