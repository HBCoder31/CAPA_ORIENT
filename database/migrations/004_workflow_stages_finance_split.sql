-- Migration: Overhaul workflow configurations to 11 stages and split Finance approval
-- Date: 2026-07-13

-- 1. Insert Finance Head Role
INSERT INTO Role_Master (Role_ID, Role_Name, Role_Status_ID, Is_Active)
VALUES (14, 'Finance Head', 11, 1)
ON DUPLICATE KEY UPDATE Role_Name = 'Finance Head';

-- 2. Insert new lookup statuses for splitting steps
INSERT INTO Lookup_Master (Lookup_ID, Lookup_Value, Lookup_Type, Is_Active)
VALUES 
(83, 'Credit Note Pending', 'Complaint_Status', 1),
(84, 'QC Head Pending', 'Complaint_Status', 1)
ON DUPLICATE KEY UPDATE Lookup_Value = VALUES(Lookup_Value);

-- 3. Clear existing workflow stages to rebuild cleanly
SET FOREIGN_KEY_CHECKS = 0;
DELETE FROM Workflow_Configuration;

-- 4. Rebuild Paper BU (BU_ID = 1) - 11 Stages
INSERT INTO Workflow_Configuration (
    Workflow_ID, Business_Unit_ID, Stage_Number, Stage_Name, Department_ID, Default_Role_ID, SLA_Days,
    Can_Approve, Can_Reject, Can_Request_Clarification, Can_Request_Review, Is_Active, Created_By
) VALUES
(1, 1, 1, 'KAM Verification', 6, 3, 2, 1, 1, 1, 0, 1, 100014),
(2, 1, 2, 'Technical Services Review', 1, 5, 2, 0, 1, 1, 0, 1, 100014),
(3, 1, 3, 'Quality Control Review', 2, 7, 2, 0, 1, 1, 0, 1, 100014),
(4, 1, 4, 'QC Head Review', 2, 6, 2, 1, 1, 1, 0, 1, 100014),
(5, 1, 5, 'CAPA & Root Cause Analysis', 3, 9, 3, 0, 1, 1, 0, 1, 100014),
(6, 1, 6, 'Operations Head Approval', 3, 8, 2, 1, 1, 1, 0, 1, 100014),
(7, 1, 7, 'Marketing Review', 4, 11, 2, 0, 1, 1, 0, 1, 100014),
(8, 1, 8, 'Marketing Head Approval', 4, 10, 2, 1, 1, 1, 1, 1, 100014),
(9, 1, 9, 'MD Approval', 6, 13, 2, 1, 1, 0, 0, 1, 100014),
(10, 1, 10, 'Finance Head Approval', 5, 14, 2, 1, 1, 1, 0, 1, 100014),
(11, 1, 11, 'Finance Credit Note Posting', 5, 12, 2, 1, 0, 0, 0, 1, 100014);

-- 5. Rebuild Chemical BU (BU_ID = 2) - 11 Stages
INSERT INTO Workflow_Configuration (
    Workflow_ID, Business_Unit_ID, Stage_Number, Stage_Name, Department_ID, Default_Role_ID, SLA_Days,
    Can_Approve, Can_Reject, Can_Request_Clarification, Can_Request_Review, Is_Active, Created_By
) VALUES
(12, 2, 1, 'KAM Verification', 12, 3, 2, 1, 1, 1, 0, 1, 100014),
(13, 2, 2, 'Technical Services Review', 7, 5, 2, 0, 1, 1, 0, 1, 100014),
(14, 2, 3, 'Quality Control Review', 8, 7, 2, 0, 1, 1, 0, 1, 100014),
(15, 2, 4, 'QC Head Review', 8, 6, 2, 1, 1, 1, 0, 1, 100014),
(16, 2, 5, 'CAPA & Root Cause Analysis', 9, 9, 3, 0, 1, 1, 0, 1, 100014),
(17, 2, 6, 'Operations Head Approval', 9, 8, 2, 1, 1, 1, 0, 1, 100014),
(18, 2, 7, 'Marketing Review', 10, 11, 2, 0, 1, 1, 0, 1, 100014),
(19, 2, 8, 'Marketing Head Approval', 10, 10, 2, 1, 1, 1, 1, 1, 100014),
(20, 2, 9, 'MD Approval', 12, 13, 2, 1, 1, 0, 0, 1, 100014),
(21, 2, 10, 'Finance Head Approval', 11, 14, 2, 1, 1, 1, 0, 1, 100014),
(22, 2, 11, 'Finance Credit Note Posting', 11, 12, 2, 1, 0, 0, 0, 1, 100014);

-- 6. Insert new Finance Head Employee
INSERT INTO Employee_Master (
    Employee_ID, Employee_Code, Employee_Name, Official_Email, Department_ID, Role_ID, Employee_Status_ID, Is_Active
) VALUES (
    100018, 'EMP100018', 'Finance Head (CCMS)', 'finance.head@orientpaper.com', 5, 14, 6, 1
) ON DUPLICATE KEY UPDATE Employee_Name = 'Finance Head (CCMS)';

SET FOREIGN_KEY_CHECKS = 1;
