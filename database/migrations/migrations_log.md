# Schema Evolution Migration Log

This log tracks all changes applied to the database schema of the Customer Complaint Management System (CCMS) for Orient Paper Mills.

| Migration ID | File Name | Date | Type | Description / Reason |
|---|---|---|---|---|
| `001` | [001_add_customer_password_hash.sql](file:///c:/Users/Lenovo/OneDrive/Desktop/CCMS/ccms/ccms/database/migrations/001_add_customer_password_hash.sql) | 2026-07-08 | Additive | Added `Password_Hash` column to `Customer_Master` table to support customer portal authentication. |
| `002` | [002_add_complaint_escalation_column.sql](file:///c:/Users/Lenovo/OneDrive/Desktop/CCMS/ccms/ccms/database/migrations/002_add_complaint_escalation_column.sql) | 2026-07-12 | Additive | Added `Is_Escalated` column to `Complaint_Header` table to track visual escalation state. |
| `003` | [003_customer_kam_segment_assignment.sql](file:///c:/Users/Lenovo/OneDrive/Desktop/CCMS/ccms/ccms/database/migrations/003_customer_kam_segment_assignment.sql) | 2026-07-13 | Additive | Added `Customer_KAM_Segment_Assignment` table to support segment-specific KAM assignments. |
| `004` | [004_workflow_stages_finance_split.sql](file:///c:/Users/Lenovo/OneDrive/Desktop/CCMS/ccms/ccms/database/migrations/004_workflow_stages_finance_split.sql) | 2026-07-13 | Overhaul | Overhauled workflow configurations to 11 stages and split Finance approval. |
| `005` | [005_create_login_tables.sql](file:///c:/Users/Lenovo/OneDrive/Desktop/CCMS/ccms/ccms/database/migrations/005_create_login_tables.sql) | 2026-07-13 | Centralization | Centralized login credentials in `Login_Master` table and introduced `Login_Type_Master`. |
