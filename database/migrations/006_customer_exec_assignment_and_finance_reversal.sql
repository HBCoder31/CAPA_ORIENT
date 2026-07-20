-- Migration: Swap Finance stages (Exec first, then Head) & Create Customer_Executive_Assignment table
-- Date: 2026-07-15

-- 1. Create Customer_Executive_Assignment Table
CREATE TABLE IF NOT EXISTS Customer_Executive_Assignment (
    Assignment_ID BIGINT PRIMARY KEY AUTO_INCREMENT,
    Customer_ID VARCHAR(20) NOT NULL,
    Department_ID BIGINT NOT NULL,
    Employee_ID BIGINT NOT NULL,
    Business_Unit_ID BIGINT NOT NULL,
    Assigned_By BIGINT NULL,
    Is_Active BOOLEAN NOT NULL DEFAULT TRUE,
    Created_On DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Updated_On DATETIME NULL,
    FOREIGN KEY (Customer_ID) REFERENCES Customer_Master(Customer_ID),
    FOREIGN KEY (Department_ID) REFERENCES Department_Master(Department_ID),
    FOREIGN KEY (Employee_ID) REFERENCES Employee_Master(Employee_ID),
    FOREIGN KEY (Business_Unit_ID) REFERENCES Business_Unit_Master(Business_Unit_ID),
    UNIQUE KEY uq_cust_dept_bu (Customer_ID, Department_ID, Business_Unit_ID)
);

-- 2. Swap Default_Role_ID, Stage_Name, and SLA_Days for Stages 10 & 11 in Workflow_Configuration
-- Stage 10 should be Finance Executive (Default_Role_ID = 12), named 'Finance Credit Note Preparing' or similar
-- Stage 11 should be Finance Head (Default_Role_ID = 14), named 'Finance Head Approval'

-- Update for BU 1 (Paper)
UPDATE Workflow_Configuration 
SET Default_Role_ID = 12, Stage_Name = 'Finance Credit Note Preparing'
WHERE Business_Unit_ID = 1 AND Stage_Number = 10;

UPDATE Workflow_Configuration 
SET Default_Role_ID = 14, Stage_Name = 'Finance Head Approval', Can_Reject = 1, Can_Request_Clarification = 1
WHERE Business_Unit_ID = 1 AND Stage_Number = 11;

-- Update for BU 2 (Chemical)
UPDATE Workflow_Configuration 
SET Default_Role_ID = 12, Stage_Name = 'Finance Credit Note Preparing'
WHERE Business_Unit_ID = 2 AND Stage_Number = 10;

UPDATE Workflow_Configuration 
SET Default_Role_ID = 14, Stage_Name = 'Finance Head Approval', Can_Reject = 1, Can_Request_Clarification = 1
WHERE Business_Unit_ID = 2 AND Stage_Number = 11;

-- 3. Seed initial round-robin counters in System_Configuration for existing active department + role combinations
-- Combinations to support:
-- Dept 1 (TS Paper) + Role 5 (TS Engineer)
-- Dept 2 (QC Paper) + Role 7 (QC Engineer)
-- Dept 3 (Ops Paper) + Role 9 (Ops Engineer)
-- Dept 4 (Mktg Paper) + Role 11 (Mktg Executive)
-- Dept 5 (Fin Paper) + Role 12 (Fin Executive)
-- Dept 7 (TS Chem) + Role 5 (TS Engineer)
-- Dept 8 (QC Chem) + Role 7 (QC Engineer)
-- Dept 9 (Ops Chem) + Role 9 (Ops Engineer)
-- Dept 10 (Mktg Chem) + Role 11 (Mktg Executive)
-- Dept 11 (Fin Chem) + Role 12 (Fin Executive)

INSERT INTO System_Configuration (Configuration_Key, Configuration_Value, Data_Type, Remarks)
VALUES
('ASSIGN_CTR_D1_R5', '0', 'Integer', 'TS Paper Engineer Counter'),
('ASSIGN_CTR_D2_R7', '0', 'Integer', 'QC Paper Engineer Counter'),
('ASSIGN_CTR_D3_R9', '0', 'Integer', 'Ops Paper Engineer Counter'),
('ASSIGN_CTR_D4_R11', '0', 'Integer', 'Marketing Paper Executive Counter'),
('ASSIGN_CTR_D5_R12', '0', 'Integer', 'Finance Paper Executive Counter'),
('ASSIGN_CTR_D7_R5', '0', 'Integer', 'TS Chemical Engineer Counter'),
('ASSIGN_CTR_D8_R7', '0', 'Integer', 'QC Chemical Engineer Counter'),
('ASSIGN_CTR_D9_R9', '0', 'Integer', 'Ops Chemical Engineer Counter'),
('ASSIGN_CTR_D10_R11', '0', 'Integer', 'Marketing Chemical Executive Counter'),
('ASSIGN_CTR_D11_R12', '0', 'Integer', 'Finance Chemical Executive Counter')
ON DUPLICATE KEY UPDATE Configuration_Value = VALUES(Configuration_Value);
