CREATE DATABASE CCMS;
USE CCMS;
-- ============================================================
-- CCMS DATABASE — Version 1.0
-- Run on MySQL 8+
-- ============================================================

-- ─── MASTER TABLES ──────────────────────────────────────────

CREATE TABLE Business_Unit_Master (
    Business_Unit_ID        BIGINT PRIMARY KEY AUTO_INCREMENT,
    Business_Unit_Name      VARCHAR(100) NOT NULL,
    Business_Unit_Code      VARCHAR(20)  NOT NULL UNIQUE,
    Business_Unit_Description VARCHAR(500),
    Business_Unit_Status_ID BIGINT       NOT NULL,
    Created_On              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Created_By              BIGINT,
    Updated_On              DATETIME,
    Updated_By              BIGINT,
    Is_Active               BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE TABLE Lookup_Master (
    Lookup_ID    BIGINT      PRIMARY KEY AUTO_INCREMENT,
    Lookup_Type  VARCHAR(50) NOT NULL,
    Lookup_Value VARCHAR(100) NOT NULL,
    Description  VARCHAR(255),
    Is_Active    BOOLEAN     NOT NULL DEFAULT TRUE,
    Created_On   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Created_By   BIGINT,
    Updated_On   DATETIME,
    Updated_By   BIGINT
);
-- Note: Business_Unit_Master.Business_Unit_Status_ID references Lookup_Master
-- but Lookup_Master must exist first. Add FK after both tables are created.

CREATE TABLE Department_Master (
    Department_ID         BIGINT       PRIMARY KEY AUTO_INCREMENT,
    Department_Name       VARCHAR(150) NOT NULL,
    Business_Unit_ID      BIGINT       NOT NULL,
    Department_Head_ID    BIGINT,                    -- FK added later (circular with Employee)
    Department_Status_ID  BIGINT       NOT NULL,
    Created_On            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Created_By            BIGINT,
    Updated_On            DATETIME,
    Updated_By            BIGINT,
    Is_Active             BOOLEAN      NOT NULL DEFAULT TRUE,
    FOREIGN KEY (Business_Unit_ID) REFERENCES Business_Unit_Master(Business_Unit_ID)
);

CREATE TABLE Role_Master (
    Role_ID          BIGINT       PRIMARY KEY AUTO_INCREMENT,
    Role_Name        VARCHAR(100) NOT NULL UNIQUE,
    Role_Description VARCHAR(500),
    Role_Status_ID   BIGINT       NOT NULL,
    Created_On       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Created_By       BIGINT,
    Updated_On       DATETIME,
    Updated_By       BIGINT,
    Is_Active        BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE TABLE Employee_Master (
    Employee_ID            BIGINT       PRIMARY KEY,   -- SAP PERNR, no AUTO_INCREMENT
    Employee_Code          VARCHAR(20)  NOT NULL,
    Employee_Name          VARCHAR(150) NOT NULL,
    Official_Email         VARCHAR(150) NOT NULL UNIQUE,
    Mobile_Number          VARCHAR(20),
    Department_ID          BIGINT       NOT NULL,
    Role_ID                BIGINT       NOT NULL,
    Reporting_Manager_ID   BIGINT,                     -- self-referential
    Employee_Status_ID     BIGINT       NOT NULL,
    Last_Login             DATETIME,
    Created_On             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Created_By             BIGINT,
    Updated_On             DATETIME,
    Updated_By             BIGINT,
    Is_Active              BOOLEAN      NOT NULL DEFAULT TRUE,
    FOREIGN KEY (Department_ID)        REFERENCES Department_Master(Department_ID),
    FOREIGN KEY (Role_ID)              REFERENCES Role_Master(Role_ID),
    FOREIGN KEY (Reporting_Manager_ID) REFERENCES Employee_Master(Employee_ID)
);
ALTER TABLE Employee_Master ADD CONSTRAINT uq_employee_code UNIQUE (Employee_Code);
-- Now add the Department Head FK (circular reference resolved)
ALTER TABLE Department_Master
    ADD CONSTRAINT fk_dept_head
    FOREIGN KEY (Department_Head_ID) REFERENCES Employee_Master(Employee_ID);

CREATE TABLE KAM_Master (
    KAM_ID          BIGINT       PRIMARY KEY AUTO_INCREMENT,
    Employee_ID     BIGINT       NOT NULL UNIQUE,
    Region          VARCHAR(100),
    KAM_Status_ID   BIGINT       NOT NULL,
    Created_On      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Created_By      BIGINT,
    Updated_On      DATETIME,
    Updated_By      BIGINT,
    Is_Active       BOOLEAN      NOT NULL DEFAULT TRUE,
    FOREIGN KEY (Employee_ID) REFERENCES Employee_Master(Employee_ID)
);

CREATE TABLE Customer_Master (
    Customer_ID             VARCHAR(20)  PRIMARY KEY,  -- SAP KUNNR
    Customer_Name           VARCHAR(200) NOT NULL,
    Business_Unit_ID        BIGINT       NOT NULL,
    KAM_ID                  BIGINT       NOT NULL,
    GSTIN                   VARCHAR(20),
    PAN_Number              VARCHAR(20),
    Customer_Email          VARCHAR(150),
    Customer_Phone          VARCHAR(20),
    Billing_Address         VARCHAR(500),
    Shipping_Address        VARCHAR(500),
    City                    VARCHAR(100),
    State                   VARCHAR(100),
    Country                 VARCHAR(100),
    Postal_Code             VARCHAR(15),
    Customer_Portal_Access  BOOLEAN      NOT NULL DEFAULT FALSE,
    Customer_Status_ID      BIGINT       NOT NULL,
    Last_SAP_Sync           DATETIME,
    Created_On              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Created_By              VARCHAR(50),
    Updated_On              DATETIME,
    Updated_By              VARCHAR(50),
    Is_Active               BOOLEAN      NOT NULL DEFAULT TRUE,
    FOREIGN KEY (Business_Unit_ID) REFERENCES Business_Unit_Master(Business_Unit_ID),
    FOREIGN KEY (KAM_ID)           REFERENCES KAM_Master(KAM_ID)
);

CREATE TABLE Product_Master (
    Product_Code        VARCHAR(40)  PRIMARY KEY,  -- SAP MATNR
    Product_Name        VARCHAR(250) NOT NULL,
    Business_Unit_ID    BIGINT       NOT NULL,
    Product_Category    VARCHAR(100),
    Product_Group       VARCHAR(100),
    Unit_Of_Measure     VARCHAR(20),
    Product_Status_ID   BIGINT       NOT NULL,
    Last_SAP_Sync       DATETIME,
    Created_On          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Created_By          VARCHAR(50),
    Updated_On          DATETIME,
    Updated_By          VARCHAR(50),
    Is_Active           BOOLEAN      NOT NULL DEFAULT TRUE,
    FOREIGN KEY (Business_Unit_ID) REFERENCES Business_Unit_Master(Business_Unit_ID)
);

CREATE TABLE Invoice_Master (
    Invoice_No            VARCHAR(20)   NOT NULL,
    Line_Item             INT           NOT NULL,
    Customer_ID           VARCHAR(20)   NOT NULL,
    Product_Code          VARCHAR(40)   NOT NULL,
    Invoice_Date          DATE          NOT NULL,
    Delivery_Date         DATE,
    Quantity              DECIMAL(12,3) NOT NULL,
    Unit_Of_Measure       VARCHAR(20),
    Unit_Price            DECIMAL(15,2) NOT NULL,
    Net_Amount            DECIMAL(15,2) NOT NULL,
    Purchase_Order_No     VARCHAR(50),
    Billing_Type          VARCHAR(20),
    Distribution_Channel  VARCHAR(50),
    Division              VARCHAR(50),
    Transporter_Name      VARCHAR(150),
    Truck_No              VARCHAR(30),
    LR_Number             VARCHAR(30),
    Created_On            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Last_SAP_Sync         DATETIME,
    PRIMARY KEY (Invoice_No, Line_Item),
    FOREIGN KEY (Customer_ID)   REFERENCES Customer_Master(Customer_ID),
    FOREIGN KEY (Product_Code)  REFERENCES Product_Master(Product_Code)
);

CREATE TABLE Workflow_Configuration (
    Workflow_ID               BIGINT       PRIMARY KEY AUTO_INCREMENT,
    Business_Unit_ID          BIGINT       NOT NULL,
    Stage_Number              INT          NOT NULL,
    Stage_Name                VARCHAR(100) NOT NULL,
    Department_ID             BIGINT       NOT NULL,
    Default_Role_ID           BIGINT       NOT NULL,
    SLA_Days                  INT,
    Can_Approve               BOOLEAN      NOT NULL DEFAULT FALSE,
    Can_Reject                BOOLEAN      NOT NULL DEFAULT TRUE,
    Can_Request_Clarification BOOLEAN      NOT NULL DEFAULT TRUE,
    Can_Request_Review        BOOLEAN      NOT NULL DEFAULT FALSE,
    Is_Active                 BOOLEAN      NOT NULL DEFAULT TRUE,
    Created_On                DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Created_By                BIGINT,
    Updated_On                DATETIME,
    Updated_By                BIGINT,
    FOREIGN KEY (Business_Unit_ID) REFERENCES Business_Unit_Master(Business_Unit_ID),
    FOREIGN KEY (Department_ID)    REFERENCES Department_Master(Department_ID),
    FOREIGN KEY (Default_Role_ID)  REFERENCES Role_Master(Role_ID)
);

CREATE TABLE Approval_Matrix (
    Approval_Matrix_ID  BIGINT         PRIMARY KEY AUTO_INCREMENT,
    Business_Unit_ID    BIGINT         NOT NULL,
    Approval_Type       VARCHAR(50)    NOT NULL,
    Minimum_Amount      DECIMAL(15,2)  NOT NULL DEFAULT 0.00,
    Maximum_Amount      DECIMAL(15,2)  NOT NULL,
    Role_ID             BIGINT         NOT NULL,
    Approval_Level      INT            NOT NULL DEFAULT 1,
    Remarks             VARCHAR(255),
    Is_Active           BOOLEAN        NOT NULL DEFAULT TRUE,
    Created_On          DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Created_By          BIGINT,
    Updated_On          DATETIME,
    Updated_By          BIGINT,
    FOREIGN KEY (Business_Unit_ID) REFERENCES Business_Unit_Master(Business_Unit_ID),
    FOREIGN KEY (Role_ID)          REFERENCES Role_Master(Role_ID)
);

CREATE TABLE System_Configuration (
    Configuration_ID    BIGINT       PRIMARY KEY AUTO_INCREMENT,
    Configuration_Key   VARCHAR(100) NOT NULL,
    Configuration_Value VARCHAR(255) NOT NULL,
    Data_Type           VARCHAR(20)  NOT NULL,
    Business_Unit_ID    BIGINT,        -- NULL = global
    Remarks             VARCHAR(255),
    Is_Active           BOOLEAN      NOT NULL DEFAULT TRUE,
    Created_On          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Created_By          BIGINT,
    Updated_On          DATETIME,
    Updated_By          BIGINT,
    UNIQUE (Configuration_Key, Business_Unit_ID),
    FOREIGN KEY (Business_Unit_ID) REFERENCES Business_Unit_Master(Business_Unit_ID)
);

-- ─── TRANSACTION TABLES ─────────────────────────────────────

CREATE TABLE Complaint_Header (
    Complaint_ID                        BIGINT        PRIMARY KEY AUTO_INCREMENT,
    Complaint_Number                    VARCHAR(30)   NOT NULL UNIQUE,
    Customer_ID                         VARCHAR(20)   NOT NULL,
    KAM_ID                              BIGINT        NOT NULL,
    Business_Unit_ID                    BIGINT        NOT NULL,
    Complaint_Source_ID                 BIGINT        NOT NULL,
    Complaint_Date                      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Complaint_Title                     VARCHAR(200)  NOT NULL,
    Complaint_Description               TEXT          NOT NULL,
    Priority_ID                         BIGINT        NOT NULL,
    Complaint_Status_ID                 BIGINT        NOT NULL,
    Current_Department_ID               BIGINT        NOT NULL,
    Current_Assignee_ID                 BIGINT,
    Total_Complaint_Value               DECIMAL(15,2) DEFAULT 0.00,
    Expected_Settlement_Amount          DECIMAL(15,2),
    Is_Duplicate                        BOOLEAN       NOT NULL DEFAULT FALSE,
    Duplicate_Reference_Complaint_ID    BIGINT,
    Duplicate_Flagged_On                DATETIME,
    Duplicate_Flagged_By                BIGINT,
    Closure_Date                        DATETIME,
    Closure_Remarks                     VARCHAR(500),
    Created_On                          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Created_By                          BIGINT,
    Updated_On                          DATETIME,
    Updated_By                          BIGINT,
    Is_Active                           BOOLEAN       NOT NULL DEFAULT TRUE,
    FOREIGN KEY (Customer_ID)           REFERENCES Customer_Master(Customer_ID),
    FOREIGN KEY (KAM_ID)                REFERENCES KAM_Master(KAM_ID),
    FOREIGN KEY (Business_Unit_ID)      REFERENCES Business_Unit_Master(Business_Unit_ID),
    FOREIGN KEY (Current_Department_ID) REFERENCES Department_Master(Department_ID),
    FOREIGN KEY (Current_Assignee_ID)   REFERENCES Employee_Master(Employee_ID),
    FOREIGN KEY (Duplicate_Reference_Complaint_ID) REFERENCES Complaint_Header(Complaint_ID)
);

CREATE TABLE Complaint_Line_Item (
    Complaint_Line_Item_ID  BIGINT         PRIMARY KEY AUTO_INCREMENT,
    Complaint_ID            BIGINT         NOT NULL,
    Invoice_No              VARCHAR(20)    NOT NULL,
    Line_Item               INT            NOT NULL,
    Defective_Quantity      DECIMAL(12,3)  NOT NULL DEFAULT 0,
    Complaint_Category_ID   BIGINT         NOT NULL,
    Defect_Nature_ID        BIGINT         NOT NULL,
    Complaint_Value         DECIMAL(15,2),   -- auto-calculated by app
    Customer_Remarks        VARCHAR(500),
    Created_On              DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Created_By              BIGINT,
    Updated_On              DATETIME,
    Updated_By              BIGINT,
    FOREIGN KEY (Complaint_ID)           REFERENCES Complaint_Header(Complaint_ID),
    FOREIGN KEY (Invoice_No, Line_Item)  REFERENCES Invoice_Master(Invoice_No, Line_Item)
);

CREATE TABLE Complaint_Workflow_Log (
    Workflow_Log_ID         BIGINT        PRIMARY KEY AUTO_INCREMENT,
    Complaint_ID            BIGINT        NOT NULL,
    Workflow_ID             BIGINT        NOT NULL,
    Action_By               BIGINT        NOT NULL,
    Action_Date             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Action_Type_ID          BIGINT        NOT NULL,
    Previous_Department_ID  BIGINT,
    Current_Department_ID   BIGINT        NOT NULL,
    Remarks                 VARCHAR(1000),
    Created_On              DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (Complaint_ID)           REFERENCES Complaint_Header(Complaint_ID),
    FOREIGN KEY (Workflow_ID)            REFERENCES Workflow_Configuration(Workflow_ID),
    FOREIGN KEY (Action_By)              REFERENCES Employee_Master(Employee_ID),
    FOREIGN KEY (Previous_Department_ID) REFERENCES Department_Master(Department_ID),
    FOREIGN KEY (Current_Department_ID)  REFERENCES Department_Master(Department_ID)
);

CREATE TABLE Technical_Service_Details (
    TS_Details_ID         BIGINT        PRIMARY KEY AUTO_INCREMENT,
    Complaint_ID          BIGINT        NOT NULL UNIQUE,  -- one-to-one
    Assigned_Engineer_ID  BIGINT        NOT NULL,
    Investigation_Date    DATETIME,
    Technical_Observation TEXT,
    Clarification_Required BOOLEAN      NOT NULL DEFAULT FALSE,
    Sample_Required       BOOLEAN       NOT NULL DEFAULT FALSE,
    Visit_Required        BOOLEAN       NOT NULL DEFAULT FALSE,
    Recommended_Action    TEXT,
    Can_Close_Complaint   BOOLEAN       NOT NULL DEFAULT FALSE,
    Remarks               VARCHAR(1000),
    Created_On            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Created_By            BIGINT,
    Updated_On            DATETIME,
    Updated_By            BIGINT,
    FOREIGN KEY (Complaint_ID)         REFERENCES Complaint_Header(Complaint_ID),
    FOREIGN KEY (Assigned_Engineer_ID) REFERENCES Employee_Master(Employee_ID)
);

CREATE TABLE Visit_Details (
    Visit_ID          BIGINT        PRIMARY KEY AUTO_INCREMENT,
    Complaint_ID      BIGINT        NOT NULL,
    Engineer_ID       BIGINT        NOT NULL,
    Visit_Date        DATETIME      NOT NULL,
    Visit_Status_ID   BIGINT        NOT NULL,
    Visit_Findings    TEXT,
    Customer_Feedback TEXT,
    Follow_Up_Required BOOLEAN      NOT NULL DEFAULT FALSE,
    Remarks           VARCHAR(1000),
    Created_On        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Created_By        BIGINT,
    Updated_On        DATETIME,
    Updated_By        BIGINT,
    FOREIGN KEY (Complaint_ID) REFERENCES Complaint_Header(Complaint_ID),
    FOREIGN KEY (Engineer_ID)  REFERENCES Employee_Master(Employee_ID)
);

CREATE TABLE Sample_Tracking (
    Sample_ID              BIGINT        PRIMARY KEY AUTO_INCREMENT,
    Complaint_ID           BIGINT        NOT NULL,
    Sample_Request_Date    DATETIME,
    Sample_Dispatched_Date DATETIME,
    Sample_Received_Date   DATETIME,
    Sample_Status_ID       BIGINT        NOT NULL,
    Courier_Details        VARCHAR(255),
    Received_By            BIGINT,
    Sample_Condition       VARCHAR(255),
    Remarks                VARCHAR(1000),
    Created_On             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Created_By             BIGINT,
    Updated_On             DATETIME,
    Updated_By             BIGINT,
    FOREIGN KEY (Complaint_ID) REFERENCES Complaint_Header(Complaint_ID),
    FOREIGN KEY (Received_By)  REFERENCES Employee_Master(Employee_ID)
);

CREATE TABLE Quality_Control_Details (
    QC_Details_ID    BIGINT        PRIMARY KEY AUTO_INCREMENT,
    Complaint_ID     BIGINT        NOT NULL UNIQUE,  -- one-to-one
    QC_Engineer_ID   BIGINT        NOT NULL,
    Inspection_Date  DATETIME,
    Sample_Verified  BOOLEAN       NOT NULL DEFAULT FALSE,
    QC_Observation   TEXT,
    QC_Recommendation TEXT,
    Remarks          VARCHAR(1000),
    Created_On       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Created_By       BIGINT,
    Updated_On       DATETIME,
    Updated_By       BIGINT,
    FOREIGN KEY (Complaint_ID)   REFERENCES Complaint_Header(Complaint_ID),
    FOREIGN KEY (QC_Engineer_ID) REFERENCES Employee_Master(Employee_ID)
);

CREATE TABLE CAPA_Analysis (
    CAPA_ID                  BIGINT   PRIMARY KEY AUTO_INCREMENT,
    Complaint_ID             BIGINT   NOT NULL UNIQUE,  -- one-to-one
    Root_Cause_Analysis      TEXT     NOT NULL,
    Corrective_Action        TEXT     NOT NULL,
    Preventive_Action        TEXT     NOT NULL,
    Responsible_Employee_ID  BIGINT   NOT NULL,
    Target_Completion_Date   DATE,
    Completion_Date          DATE,
    Effectiveness_Verified   BOOLEAN  NOT NULL DEFAULT FALSE,
    Approved_By              BIGINT,
    Approval_Date            DATETIME,
    Remarks                  VARCHAR(1000),
    Created_On               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Created_By               BIGINT,
    Updated_On               DATETIME,
    Updated_By               BIGINT,
    FOREIGN KEY (Complaint_ID)            REFERENCES Complaint_Header(Complaint_ID),
    FOREIGN KEY (Responsible_Employee_ID) REFERENCES Employee_Master(Employee_ID),
    FOREIGN KEY (Approved_By)             REFERENCES Employee_Master(Employee_ID)
);

CREATE TABLE Settlement_Details (
    Settlement_ID        BIGINT         PRIMARY KEY AUTO_INCREMENT,
    Complaint_ID         BIGINT         NOT NULL UNIQUE,  -- one-to-one
    Settlement_Type_ID   BIGINT         NOT NULL,
    Proposed_Amount      DECIMAL(15,2)  NOT NULL DEFAULT 0.00,
    Approved_Amount      DECIMAL(15,2),
    Approval_Status_ID   BIGINT         NOT NULL,
    Approved_By          BIGINT,
    Approval_Date        DATETIME,
    Commercial_Remarks   VARCHAR(1000),
    Created_On           DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Created_By           BIGINT,
    Updated_On           DATETIME,
    Updated_By           BIGINT,
    FOREIGN KEY (Complaint_ID)  REFERENCES Complaint_Header(Complaint_ID),
    FOREIGN KEY (Approved_By)   REFERENCES Employee_Master(Employee_ID)
);

CREATE TABLE Credit_Note (
    Credit_Note_ID        BIGINT        PRIMARY KEY AUTO_INCREMENT,
    Complaint_ID          BIGINT        NOT NULL UNIQUE,
    Settlement_ID         BIGINT        NOT NULL UNIQUE,
    Credit_Note_Number    VARCHAR(30),   -- dummy value during dev; SAP value after integration
    Credit_Note_Date      DATETIME,
    Credit_Note_Amount    DECIMAL(15,2),
    SAP_Fiscal_Year       VARCHAR(4),
    SAP_Company_Code      VARCHAR(10),
    SAP_Sync_Status_ID    BIGINT        NOT NULL,
    SAP_Response_Message  VARCHAR(500),
    Created_On            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Created_By            BIGINT,
    Updated_On            DATETIME,
    Updated_By            BIGINT,
    FOREIGN KEY (Complaint_ID)  REFERENCES Complaint_Header(Complaint_ID),
    FOREIGN KEY (Settlement_ID) REFERENCES Settlement_Details(Settlement_ID)
);

CREATE TABLE Attachment_Master (
    Attachment_ID  BIGINT         PRIMARY KEY AUTO_INCREMENT,
    Complaint_ID   BIGINT         NOT NULL,
    Uploaded_By    BIGINT         NOT NULL,
    File_Name      VARCHAR(255)   NOT NULL,
    File_Path      VARCHAR(500)   NOT NULL,
    File_Type      VARCHAR(50)    NOT NULL,
    File_Size_KB   DECIMAL(10,2),
    Upload_Date    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Remarks        VARCHAR(500),
    Created_On     DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Created_By     BIGINT,
    FOREIGN KEY (Complaint_ID) REFERENCES Complaint_Header(Complaint_ID),
    FOREIGN KEY (Uploaded_By)  REFERENCES Employee_Master(Employee_ID)
);

CREATE TABLE Notification_Log (
    Notification_ID         BIGINT        PRIMARY KEY AUTO_INCREMENT,
    Complaint_ID            BIGINT        NOT NULL,
    Recipient_Employee_ID   BIGINT,
    Recipient_Email         VARCHAR(150),
    Notification_Type_ID    BIGINT        NOT NULL,
    Notification_Status_ID  BIGINT        NOT NULL,
    Notification_Date       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Failure_Reason          VARCHAR(500),
    Created_On              DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (Complaint_ID)          REFERENCES Complaint_Header(Complaint_ID),
    FOREIGN KEY (Recipient_Employee_ID) REFERENCES Employee_Master(Employee_ID)
);

ALTER TABLE Business_Unit_Master ADD CONSTRAINT fk_bu_status FOREIGN KEY (Business_Unit_Status_ID) REFERENCES Lookup_Master(Lookup_ID);
ALTER TABLE Department_Master ADD CONSTRAINT fk_department_status FOREIGN KEY (Department_Status_ID) REFERENCES Lookup_Master(Lookup_ID);
ALTER TABLE Role_Master ADD CONSTRAINT fk_role_status FOREIGN KEY (Role_Status_ID) REFERENCES Lookup_Master(Lookup_ID);
ALTER TABLE Employee_Master ADD CONSTRAINT fk_employee_status FOREIGN KEY (Employee_Status_ID) REFERENCES Lookup_Master(Lookup_ID);
ALTER TABLE KAM_Master ADD CONSTRAINT fk_kam_status FOREIGN KEY (KAM_Status_ID) REFERENCES Lookup_Master(Lookup_ID);
ALTER TABLE Customer_Master ADD CONSTRAINT fk_customer_status FOREIGN KEY (Customer_Status_ID) REFERENCES Lookup_Master(Lookup_ID);
ALTER TABLE Product_Master ADD CONSTRAINT fk_product_status FOREIGN KEY (Product_Status_ID) REFERENCES Lookup_Master(Lookup_ID);
ALTER TABLE Complaint_Header ADD CONSTRAINT fk_complaint_source FOREIGN KEY (Complaint_Source_ID) REFERENCES Lookup_Master(Lookup_ID);
ALTER TABLE Complaint_Header ADD CONSTRAINT fk_priority FOREIGN KEY (Priority_ID) REFERENCES Lookup_Master(Lookup_ID);
ALTER TABLE Complaint_Header ADD CONSTRAINT fk_complaint_status FOREIGN KEY (Complaint_Status_ID) REFERENCES Lookup_Master(Lookup_ID);
ALTER TABLE Complaint_Header ADD CONSTRAINT fk_duplicate_flagged_by FOREIGN KEY (Duplicate_Flagged_By) REFERENCES Employee_Master(Employee_ID);
ALTER TABLE Complaint_Line_Item ADD CONSTRAINT fk_complaint_category FOREIGN KEY (Complaint_Category_ID) REFERENCES Lookup_Master(Lookup_ID);
ALTER TABLE Complaint_Line_Item ADD CONSTRAINT fk_defect_nature FOREIGN KEY (Defect_Nature_ID) REFERENCES Lookup_Master(Lookup_ID);
ALTER TABLE Complaint_Workflow_Log ADD CONSTRAINT fk_workflow_action FOREIGN KEY (Action_Type_ID) REFERENCES Lookup_Master(Lookup_ID);
ALTER TABLE Visit_Details ADD CONSTRAINT fk_visit_status FOREIGN KEY (Visit_Status_ID) REFERENCES Lookup_Master(Lookup_ID);
ALTER TABLE Sample_Tracking ADD CONSTRAINT fk_sample_status FOREIGN KEY (Sample_Status_ID) REFERENCES Lookup_Master(Lookup_ID);
ALTER TABLE Settlement_Details ADD CONSTRAINT fk_settlement_type FOREIGN KEY (Settlement_Type_ID) REFERENCES Lookup_Master(Lookup_ID);
ALTER TABLE Settlement_Details ADD CONSTRAINT fk_settlement_status FOREIGN KEY (Approval_Status_ID) REFERENCES Lookup_Master(Lookup_ID);
ALTER TABLE Credit_Note ADD CONSTRAINT fk_sap_sync_status FOREIGN KEY (SAP_Sync_Status_ID) REFERENCES Lookup_Master(Lookup_ID);
ALTER TABLE Notification_Log ADD CONSTRAINT fk_notification_type FOREIGN KEY (Notification_Type_ID) REFERENCES Lookup_Master(Lookup_ID);
ALTER TABLE Notification_Log ADD CONSTRAINT fk_notification_status FOREIGN KEY (Notification_Status_ID) REFERENCES Lookup_Master(Lookup_ID);
-- ALTER TABLE Settlement_Details ADD CONSTRAINT uq_settlement_complaint UNIQUE (Complaint_ID);
ALTER TABLE Notification_Log ADD CONSTRAINT chk_notification_recipient CHECK (Recipient_Employee_ID IS NOT NULL OR Recipient_Email IS NOT NULL);
ALTER TABLE Attachment_Master MODIFY File_Type VARCHAR(300) NOT NULL;

CREATE INDEX idx_customer ON Complaint_Header(Customer_ID);
CREATE INDEX idx_status ON Complaint_Header(Complaint_Status_ID);
CREATE INDEX idx_invoice ON Complaint_Line_Item(Invoice_No, Line_Item);
CREATE INDEX idx_workflow ON Complaint_Workflow_Log(Complaint_ID);
CREATE INDEX idx_visit ON Visit_Details(Complaint_ID);
CREATE INDEX idx_sample ON Sample_Tracking(Complaint_ID);
CREATE INDEX idx_notification ON Notification_Log(Complaint_ID);

-- ── Business Units ───────────────────────────────────────────
-- (Status Lookup inserted first — dummy ID 1 = Active)
INSERT INTO Lookup_Master (Lookup_Type, Lookup_Value) VALUES
  ('BU_Status',           'Active'),
  ('BU_Status',           'Inactive'),
  ('Customer_Status',     'Active'),
  ('Customer_Status',     'Inactive'),
  ('Customer_Status',     'Blocked'),
  ('Employee_Status',     'Active'),
  ('Employee_Status',     'Inactive'),
  ('Employee_Status',     'On Leave'),
  ('Department_Status',   'Active'),
  ('Department_Status',   'Inactive'),
  ('Role_Status',         'Active'),
  ('Product_Status',      'Active'),
  ('Product_Status',      'Inactive'),
  ('KAM_Status',          'Active'),
  ('KAM_Status',          'Inactive'),
  ('Complaint_Status',    'Draft'),
  ('Complaint_Status',    'Submitted'),
  ('Complaint_Status',    'Under TS Review'),
  ('Complaint_Status',    'Visit Scheduled'),
  ('Complaint_Status',    'Waiting Sample'),
  ('Complaint_Status',    'Under QC Review'),
  ('Complaint_Status',    'CAPA Pending'),
  ('Complaint_Status',    'Ops Head Approval'),
  ('Complaint_Status',    'Marketing Review'),
  ('Complaint_Status',    'Marketing Head Approval'),
  ('Complaint_Status',    'MD Approval'),
  ('Complaint_Status',    'Finance Pending'),
  ('Complaint_Status',    'Closed'),
  ('Complaint_Status',    'Rejected'),
  ('Complaint_Status',    'Auto Closed'),
  ('Priority',            'Low'),
  ('Priority',            'Medium'),
  ('Priority',            'High'),
  ('Priority',            'Critical'),
  ('Complaint_Source',    'Customer Portal'),
  ('Complaint_Source',    'KAM'),
  ('Complaint_Source',    'Sales'),
  ('Complaint_Category',  'Quality'),
  ('Complaint_Category',  'Packaging'),
  ('Complaint_Category',  'Delivery'),
  ('Complaint_Category',  'Commercial'),
  ('Complaint_Category',  'Others'),
  ('Defect_Nature',       'Bursting Strength Failure'),
  ('Defect_Nature',       'Color Difference'),
  ('Defect_Nature',       'Low GSM'),
  ('Defect_Nature',       'Moisture'),
  ('Defect_Nature',       'Chemical Concentration'),
  ('Defect_Nature',       'Torn / Damaged'),
  ('Defect_Nature',       'Size Defect'),
  ('Defect_Nature',       'Others'),
  ('Visit_Status',        'Scheduled'),
  ('Visit_Status',        'Completed'),
  ('Visit_Status',        'Cancelled'),
  ('Sample_Status',       'Requested'),
  ('Sample_Status',       'Dispatched'),
  ('Sample_Status',       'Received'),
  ('Sample_Status',       'Under Testing'),
  ('Sample_Status',       'Verified'),
  ('Settlement_Type',     'Credit Note'),
  ('Settlement_Type',     'Replacement'),
  ('Settlement_Type',     'Compensation'),
  ('Settlement_Status',   'Pending'),
  ('Settlement_Status',   'Approved'),
  ('Settlement_Status',   'Rejected'),
  ('SAP_Sync_Status',     'Pending'),
  ('SAP_Sync_Status',     'Posted'),
  ('SAP_Sync_Status',     'Failed'),
  ('Notification_Type',   'Email'),
  ('Notification_Type',   'SMS'),
  ('Notification_Type',   'Push'),
  ('Notification_Status', 'Sent'),
  ('Notification_Status', 'Failed'),
  ('Notification_Status', 'Pending'),
  ('Workflow_Action',     'Submitted'),
  ('Workflow_Action',     'Assigned'),
  ('Workflow_Action',     'Forwarded'),
  ('Workflow_Action',     'Approved'),
  ('Workflow_Action',     'Rejected'),
  ('Workflow_Action',     'Clarification Requested'),
  ('Workflow_Action',     'Review Requested'),
  ('Workflow_Action',     'Closed'),
  ('Workflow_Action',     'Auto Closed');


-- ── Business Units ───────────────────────────────────────────
INSERT INTO Business_Unit_Master
(
    Business_Unit_Name,
    Business_Unit_Code,
    Business_Unit_Description,
    Business_Unit_Status_ID
)
VALUES
(
    'Paper Business',
    'PAPER',
    'Paper manufacturing division',
    (
        SELECT Lookup_ID
        FROM Lookup_Master
        WHERE Lookup_Type = 'BU_Status'
          AND Lookup_Value = 'Active'
        LIMIT 1
    )
),
(
    'Chemical Business',
    'CHEMICAL',
    'Chemical manufacturing division',
    (
        SELECT Lookup_ID
        FROM Lookup_Master
        WHERE Lookup_Type = 'BU_Status'
          AND Lookup_Value = 'Active'
        LIMIT 1
    )
);

INSERT INTO Department_Master
(
    Department_Name,
    Business_Unit_ID,
    Department_Status_ID
)
VALUES
(
    'Technical Services',
    (
        SELECT Business_Unit_ID
        FROM Business_Unit_Master
        WHERE Business_Unit_Code='PAPER'
        LIMIT 1
    ),
    (
        SELECT Lookup_ID
        FROM Lookup_Master
        WHERE Lookup_Type='Department_Status'
          AND Lookup_Value='Active'
        LIMIT 1
    )
),

(
    'Quality Control',
    (
        SELECT Business_Unit_ID
        FROM Business_Unit_Master
        WHERE Business_Unit_Code='PAPER'
        LIMIT 1
    ),
    (
        SELECT Lookup_ID
        FROM Lookup_Master
        WHERE Lookup_Type='Department_Status'
          AND Lookup_Value='Active'
        LIMIT 1
    )
),

(
    'Operations',
    (
        SELECT Business_Unit_ID
        FROM Business_Unit_Master
        WHERE Business_Unit_Code='PAPER'
        LIMIT 1
    ),
    (
        SELECT Lookup_ID
        FROM Lookup_Master
        WHERE Lookup_Type='Department_Status'
          AND Lookup_Value='Active'
        LIMIT 1
    )
),

(
    'Marketing',
    (
        SELECT Business_Unit_ID
        FROM Business_Unit_Master
        WHERE Business_Unit_Code='PAPER'
        LIMIT 1
    ),
    (
        SELECT Lookup_ID
        FROM Lookup_Master
        WHERE Lookup_Type='Department_Status'
          AND Lookup_Value='Active'
        LIMIT 1
    )
),

(
    'Finance',
    (
        SELECT Business_Unit_ID
        FROM Business_Unit_Master
        WHERE Business_Unit_Code='PAPER'
        LIMIT 1
    ),
    (
        SELECT Lookup_ID
        FROM Lookup_Master
        WHERE Lookup_Type='Department_Status'
          AND Lookup_Value='Active'
        LIMIT 1
    )
),

(
    'Administration',
    (
        SELECT Business_Unit_ID
        FROM Business_Unit_Master
        WHERE Business_Unit_Code='PAPER'
        LIMIT 1
    ),
    (
        SELECT Lookup_ID
        FROM Lookup_Master
        WHERE Lookup_Type='Department_Status'
          AND Lookup_Value='Active'
        LIMIT 1
    )
),

(
    'Technical Services',
    (
        SELECT Business_Unit_ID
        FROM Business_Unit_Master
        WHERE Business_Unit_Code='CHEMICAL'
        LIMIT 1
    ),
    (
        SELECT Lookup_ID
        FROM Lookup_Master
        WHERE Lookup_Type='Department_Status'
          AND Lookup_Value='Active'
        LIMIT 1
    )
),

(
    'Quality Control',
    (
        SELECT Business_Unit_ID
        FROM Business_Unit_Master
        WHERE Business_Unit_Code='CHEMICAL'
        LIMIT 1
    ),
    (
        SELECT Lookup_ID
        FROM Lookup_Master
        WHERE Lookup_Type='Department_Status'
          AND Lookup_Value='Active'
        LIMIT 1
    )
),

(
    'Operations',
    (
        SELECT Business_Unit_ID
        FROM Business_Unit_Master
        WHERE Business_Unit_Code='CHEMICAL'
        LIMIT 1
    ),
    (
        SELECT Lookup_ID
        FROM Lookup_Master
        WHERE Lookup_Type='Department_Status'
          AND Lookup_Value='Active'
        LIMIT 1
    )
),

(
    'Marketing',
    (
        SELECT Business_Unit_ID
        FROM Business_Unit_Master
        WHERE Business_Unit_Code='CHEMICAL'
        LIMIT 1
    ),
    (
        SELECT Lookup_ID
        FROM Lookup_Master
        WHERE Lookup_Type='Department_Status'
          AND Lookup_Value='Active'
        LIMIT 1
    )
),

(
    'Finance',
    (
        SELECT Business_Unit_ID
        FROM Business_Unit_Master
        WHERE Business_Unit_Code='CHEMICAL'
        LIMIT 1
    ),
    (
        SELECT Lookup_ID
        FROM Lookup_Master
        WHERE Lookup_Type='Department_Status'
          AND Lookup_Value='Active'
        LIMIT 1
    )
),

(
    'Administration',
    (
        SELECT Business_Unit_ID
        FROM Business_Unit_Master
        WHERE Business_Unit_Code='CHEMICAL'
        LIMIT 1
    ),
    (
        SELECT Lookup_ID
        FROM Lookup_Master
        WHERE Lookup_Type='Department_Status'
          AND Lookup_Value='Active'
        LIMIT 1
    )
);


INSERT INTO Role_Master
(
    Role_Name,
    Role_Status_ID
)
VALUES
(
    'Administrator',
    (
        SELECT Lookup_ID
        FROM Lookup_Master
        WHERE Lookup_Type='Role_Status'
          AND Lookup_Value='Active'
        LIMIT 1
    )
),
(
    'Customer',
    (
        SELECT Lookup_ID
        FROM Lookup_Master
        WHERE Lookup_Type='Role_Status'
          AND Lookup_Value='Active'
        LIMIT 1
    )
),
(
    'KAM',
    (
        SELECT Lookup_ID
        FROM Lookup_Master
        WHERE Lookup_Type='Role_Status'
          AND Lookup_Value='Active'
        LIMIT 1
    )
),
(
    'TS Head',
    (
        SELECT Lookup_ID
        FROM Lookup_Master
        WHERE Lookup_Type='Role_Status'
          AND Lookup_Value='Active'
        LIMIT 1
    )
),
(
    'TS Engineer',
    (
        SELECT Lookup_ID
        FROM Lookup_Master
        WHERE Lookup_Type='Role_Status'
          AND Lookup_Value='Active'
        LIMIT 1
    )
),
(
    'QC Head',
    (
        SELECT Lookup_ID
        FROM Lookup_Master
        WHERE Lookup_Type='Role_Status'
          AND Lookup_Value='Active'
        LIMIT 1
    )
),
(
    'QC Engineer',
    (
        SELECT Lookup_ID
        FROM Lookup_Master
        WHERE Lookup_Type='Role_Status'
          AND Lookup_Value='Active'
        LIMIT 1
    )
),
(
    'Operations Head',
    (
        SELECT Lookup_ID
        FROM Lookup_Master
        WHERE Lookup_Type='Role_Status'
          AND Lookup_Value='Active'
        LIMIT 1
    )
),
(
    'Operations Engineer',
    (
        SELECT Lookup_ID
        FROM Lookup_Master
        WHERE Lookup_Type='Role_Status'
          AND Lookup_Value='Active'
        LIMIT 1
    )
),
(
    'Marketing Head',
    (
        SELECT Lookup_ID
        FROM Lookup_Master
        WHERE Lookup_Type='Role_Status'
          AND Lookup_Value='Active'
        LIMIT 1
    )
),
(
    'Marketing Executive',
    (
        SELECT Lookup_ID
        FROM Lookup_Master
        WHERE Lookup_Type='Role_Status'
          AND Lookup_Value='Active'
        LIMIT 1
    )
),
(
    'Finance Executive',
    (
        SELECT Lookup_ID
        FROM Lookup_Master
        WHERE Lookup_Type='Role_Status'
          AND Lookup_Value='Active'
        LIMIT 1
    )
),
(
    'Managing Director',
    (
        SELECT Lookup_ID
        FROM Lookup_Master
        WHERE Lookup_Type='Role_Status'
          AND Lookup_Value='Active'
        LIMIT 1
    )
);


INSERT INTO System_Configuration
(
    Configuration_Key,
    Configuration_Value,
    Data_Type,
    Business_Unit_ID,
    Remarks
)
VALUES
('MD_APPROVAL_LIMIT','100000','Decimal',NULL,'Settlement above this (INR) requires MD approval'),
('DUPLICATE_COMPLAINT_DAYS','90','Integer',NULL,'Cooldown days before same complaint can be re-raised'),
('AUTO_CLOSE_DAYS','30','Integer',NULL,'Days of inactivity before auto-close'),
('SAP_INTEGRATION_ENABLED','FALSE','Boolean',NULL,'Set TRUE when SAP API is live'),
('CUSTOMER_PORTAL_ENABLED','TRUE','Boolean',NULL,'Master toggle for customer login'),
('MAX_ATTACHMENT_SIZE_MB','20','Integer',NULL,'Max upload file size in MB'),
('EMAIL_NOTIFICATION_ENABLED','TRUE','Boolean',NULL,'Enable email notifications'),
('COMPLAINT_WINDOW_DAYS','180','Integer',NULL,'Max days after invoice to raise complaint');


INSERT INTO Approval_Matrix
(
    Business_Unit_ID,
    Approval_Type,
    Minimum_Amount,
    Maximum_Amount,
    Role_ID,
    Approval_Level
)
VALUES
(
    (
        SELECT Business_Unit_ID
        FROM Business_Unit_Master
        WHERE Business_Unit_Code='PAPER'
        LIMIT 1
    ),
    'Settlement',
    0,
    100000,
    (
        SELECT Role_ID
        FROM Role_Master
        WHERE Role_Name='Marketing Head'
        LIMIT 1
    ),
    1
),

(
    (
        SELECT Business_Unit_ID
        FROM Business_Unit_Master
        WHERE Business_Unit_Code='PAPER'
        LIMIT 1
    ),
    'Settlement',
    100001,
    9999999999,
    (
        SELECT Role_ID
        FROM Role_Master
        WHERE Role_Name='Managing Director'
        LIMIT 1
    ),
    2
),

(
    (
        SELECT Business_Unit_ID
        FROM Business_Unit_Master
        WHERE Business_Unit_Code='CHEMICAL'
        LIMIT 1
    ),
    'Settlement',
    0,
    100000,
    (
        SELECT Role_ID
        FROM Role_Master
        WHERE Role_Name='Marketing Head'
        LIMIT 1
    ),
    1
),

(
    (
        SELECT Business_Unit_ID
        FROM Business_Unit_Master
        WHERE Business_Unit_Code='CHEMICAL'
        LIMIT 1
    ),
    'Settlement',
    100001,
    9999999999,
    (
        SELECT Role_ID
        FROM Role_Master
        WHERE Role_Name='Managing Director'
        LIMIT 1
    ),
    2
);


-- ──  Dummy Data  in Emplyee Master ───────────────────────────────────────────
INSERT INTO Employee_Master
(
    Employee_ID,
    Employee_Code,
    Employee_Name,
    Official_Email,
    Mobile_Number,
    Department_ID,
    Role_ID,
    Reporting_Manager_ID,
    Employee_Status_ID,
    Created_By,
    Is_Active
)
VALUES

(
100001,
'EMP100001',
'Sanjay Bansal',
'sanjay.bansal@orientpaper.com',
'9876500001',

(SELECT Department_ID
 FROM Department_Master
 WHERE Department_Name='Administration'
 AND Business_Unit_ID=
 (
     SELECT Business_Unit_ID
     FROM Business_Unit_Master
     WHERE Business_Unit_Code='PAPER'
 )
 LIMIT 1),

(SELECT Role_ID
 FROM Role_Master
 WHERE Role_Name='Managing Director'
 LIMIT 1),

NULL,

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Employee_Status'
 AND Lookup_Value='Active'
 LIMIT 1),

NULL,
TRUE
),

(
100002,
'EMP100002',
'Amit Sharma',
'amit.sharma@orientpaper.com',
'9876500002',

(SELECT Department_ID
 FROM Department_Master
 WHERE Department_Name='Technical Services'
 AND Business_Unit_ID=
 (
     SELECT Business_Unit_ID
     FROM Business_Unit_Master
     WHERE Business_Unit_Code='PAPER'
 )
 LIMIT 1),

(SELECT Role_ID
 FROM Role_Master
 WHERE Role_Name='TS Head'
 LIMIT 1),

NULL,

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Employee_Status'
 AND Lookup_Value='Active'
 LIMIT 1),

100001,
TRUE
),

(
100003,
'EMP100003',
'Neha Verma',
'neha.verma@orientpaper.com',
'9876500003',

(SELECT Department_ID
 FROM Department_Master
 WHERE Department_Name='Technical Services'
 AND Business_Unit_ID=
 (
     SELECT Business_Unit_ID
     FROM Business_Unit_Master
     WHERE Business_Unit_Code='PAPER'
 )
 LIMIT 1),

(SELECT Role_ID
 FROM Role_Master
 WHERE Role_Name='TS Engineer'
 LIMIT 1),

NULL,

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Employee_Status'
 AND Lookup_Value='Active'
 LIMIT 1),

100001,
TRUE
),

(
100004,
'EMP100004',
'Rajesh Gupta',
'rajesh.gupta@orientpaper.com',
'9876500004',

(SELECT Department_ID
 FROM Department_Master
 WHERE Department_Name='Quality Control'
 AND Business_Unit_ID=
 (
     SELECT Business_Unit_ID
     FROM Business_Unit_Master
     WHERE Business_Unit_Code='PAPER'
 )
 LIMIT 1),

(SELECT Role_ID
 FROM Role_Master
 WHERE Role_Name='QC Head'
 LIMIT 1),

NULL,

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Employee_Status'
 AND Lookup_Value='Active'
 LIMIT 1),

100001,
TRUE
),

(
100005,
'EMP100005',
'Pooja Singh',
'pooja.singh@orientpaper.com',
'9876500005',

(SELECT Department_ID
 FROM Department_Master
 WHERE Department_Name='Quality Control'
 AND Business_Unit_ID=
 (
     SELECT Business_Unit_ID
     FROM Business_Unit_Master
     WHERE Business_Unit_Code='PAPER'
 )
 LIMIT 1),

(SELECT Role_ID
 FROM Role_Master
 WHERE Role_Name='QC Engineer'
 LIMIT 1),

NULL,

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Employee_Status'
 AND Lookup_Value='Active'
 LIMIT 1),

100001,
TRUE
);

INSERT INTO Employee_Master
(
    Employee_ID,
    Employee_Code,
    Employee_Name,
    Official_Email,
    Mobile_Number,
    Department_ID,
    Role_ID,
    Reporting_Manager_ID,
    Employee_Status_ID,
    Created_By,
    Is_Active
)
VALUES

(
100006,
'EMP100006',
'Vikram Mehta',
'vikram.mehta@orientpaper.com',
'9876500006',

(SELECT Department_ID
 FROM Department_Master
 WHERE Department_Name='Operations'
 AND Business_Unit_ID=(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='PAPER')
 LIMIT 1),

(SELECT Role_ID
 FROM Role_Master
 WHERE Role_Name='Operations Head'
 LIMIT 1),

NULL,

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Employee_Status'
 AND Lookup_Value='Active'
 LIMIT 1),

100001,
TRUE
),

(
100007,
'EMP100007',
'Karan Patel',
'karan.patel@orientpaper.com',
'9876500007',

(SELECT Department_ID
 FROM Department_Master
 WHERE Department_Name='Operations'
 AND Business_Unit_ID=(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='PAPER')
 LIMIT 1),

(SELECT Role_ID
 FROM Role_Master
 WHERE Role_Name='Operations Engineer'
 LIMIT 1),

NULL,

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Employee_Status'
 AND Lookup_Value='Active'
 LIMIT 1),

100001,
TRUE
),

(
100008,
'EMP100008',
'Anjali Kapoor',
'anjali.kapoor@orientpaper.com',
'9876500008',

(SELECT Department_ID
 FROM Department_Master
 WHERE Department_Name='Marketing'
 AND Business_Unit_ID=(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='PAPER')
 LIMIT 1),

(SELECT Role_ID
 FROM Role_Master
 WHERE Role_Name='Marketing Head'
 LIMIT 1),

NULL,

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Employee_Status'
 AND Lookup_Value='Active'
 LIMIT 1),

100001,
TRUE
),

(
100009,
'EMP100009',
'Rohit Malhotra',
'rohit.malhotra@orientpaper.com',
'9876500009',

(SELECT Department_ID
 FROM Department_Master
 WHERE Department_Name='Marketing'
 AND Business_Unit_ID=(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='PAPER')
 LIMIT 1),

(SELECT Role_ID
 FROM Role_Master
 WHERE Role_Name='Marketing Executive'
 LIMIT 1),

NULL,

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Employee_Status'
 AND Lookup_Value='Active'
 LIMIT 1),

100001,
TRUE
),

(
100010,
'EMP100010',
'Deepak Sinha',
'deepak.sinha@orientpaper.com',
'9876500010',

(SELECT Department_ID
 FROM Department_Master
 WHERE Department_Name='Finance'
 AND Business_Unit_ID=(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='PAPER')
 LIMIT 1),

(SELECT Role_ID
 FROM Role_Master
 WHERE Role_Name='Finance Executive'
 LIMIT 1),

NULL,

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Employee_Status'
 AND Lookup_Value='Active'
 LIMIT 1),

100001,
TRUE
),

(
100011,
'EMP100011',
'Sandeep Nair',
'sandeep.nair@orientpaper.com',
'9876500011',

(SELECT Department_ID
 FROM Department_Master
 WHERE Department_Name='Technical Services'
 AND Business_Unit_ID=(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='CHEMICAL')
 LIMIT 1),

(SELECT Role_ID
 FROM Role_Master
 WHERE Role_Name='TS Engineer'
 LIMIT 1),

NULL,

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Employee_Status'
 AND Lookup_Value='Active'
 LIMIT 1),

100001,
TRUE
),

(
100012,
'EMP100012',
'Meenal Joshi',
'meenal.joshi@orientpaper.com',
'9876500012',

(SELECT Department_ID
 FROM Department_Master
 WHERE Department_Name='Quality Control'
 AND Business_Unit_ID=(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='CHEMICAL')
 LIMIT 1),

(SELECT Role_ID
 FROM Role_Master
 WHERE Role_Name='QC Engineer'
 LIMIT 1),

NULL,

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Employee_Status'
 AND Lookup_Value='Active'
 LIMIT 1),

100001,
TRUE
),

(
100013,
'EMP100013',
'Arjun Rao',
'arjun.rao@orientpaper.com',
'9876500013',

(SELECT Department_ID
 FROM Department_Master
 WHERE Department_Name='Operations'
 AND Business_Unit_ID=(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='CHEMICAL')
 LIMIT 1),

(SELECT Role_ID
 FROM Role_Master
 WHERE Role_Name='Operations Engineer'
 LIMIT 1),

NULL,

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Employee_Status'
 AND Lookup_Value='Active'
 LIMIT 1),

100001,
TRUE
),

(
100014,
'EMP100014',
'Admin User',
'admin@orientpaper.com',
'9876500014',

(SELECT Department_ID
 FROM Department_Master
 WHERE Department_Name='Administration'
 AND Business_Unit_ID=(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='PAPER')
 LIMIT 1),

(SELECT Role_ID
 FROM Role_Master
 WHERE Role_Name='Administrator'
 LIMIT 1),

NULL,

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Employee_Status'
 AND Lookup_Value='Active'
 LIMIT 1),

100001,
TRUE
);

INSERT INTO Employee_Master
(
    Employee_ID,
    Employee_Code,
    Employee_Name,
    Official_Email,
    Mobile_Number,
    Department_ID,
    Role_ID,
    Reporting_Manager_ID,
    Employee_Status_ID,
    Created_By,
    Is_Active
)
VALUES

(
100015,
'EMP100015',
'Ritika Mehra',
'ritika.mehra@orientpaper.com',
'9876500015',

(SELECT Department_ID
 FROM Department_Master
 WHERE Department_Name='Marketing'
 AND Business_Unit_ID=(SELECT Business_Unit_ID
                       FROM Business_Unit_Master
                       WHERE Business_Unit_Code='CHEMICAL')
 LIMIT 1),

(SELECT Role_ID
 FROM Role_Master
 WHERE Role_Name='Marketing Executive'
 LIMIT 1),

NULL,

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Employee_Status'
 AND Lookup_Value='Active'
 LIMIT 1),

100001,
TRUE
),

(
100016,
'EMP100016',
'Nitin Khanna',
'nitin.khanna@orientpaper.com',
'9876500016',

(SELECT Department_ID
 FROM Department_Master
 WHERE Department_Name='Finance'
 AND Business_Unit_ID=(SELECT Business_Unit_ID
                       FROM Business_Unit_Master
                       WHERE Business_Unit_Code='CHEMICAL')
 LIMIT 1),

(SELECT Role_ID
 FROM Role_Master
 WHERE Role_Name='Finance Executive'
 LIMIT 1),

NULL,

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Employee_Status'
 AND Lookup_Value='Active'
 LIMIT 1),

100001,
TRUE
);


-- ──  Dummy Data  in KAM Master ───────────────────────────────────────────
INSERT INTO KAM_Master
(
    Employee_ID,
    KAM_Status_ID,
    Created_By,
    Is_Active
)
VALUES
(
    100002,
    (
        SELECT Lookup_ID
        FROM Lookup_Master
        WHERE Lookup_Type='KAM_Status'
          AND Lookup_Value='Active'
        LIMIT 1
    ),
    100014,
    TRUE
),

(
    100009,
    (
        SELECT Lookup_ID
        FROM Lookup_Master
        WHERE Lookup_Type='KAM_Status'
          AND Lookup_Value='Active'
        LIMIT 1
    ),
    100014,
    TRUE
),

(
    100011,
    (
        SELECT Lookup_ID
        FROM Lookup_Master
        WHERE Lookup_Type='KAM_Status'
          AND Lookup_Value='Active'
        LIMIT 1
    ),
    100014,
    TRUE
),

(
    100015,
    (
        SELECT Lookup_ID
        FROM Lookup_Master
        WHERE Lookup_Type='KAM_Status'
          AND Lookup_Value='Active'
        LIMIT 1
    ),
    100014,
    TRUE
);


-- ──  Dummy Data  in Customer Master ───────────────────────────────────────────
INSERT INTO Customer_Master
(
    Customer_ID,
    Customer_Name,
    Business_Unit_ID,
    KAM_ID,
    GSTIN,
    PAN_Number,
    Customer_Email,
    Customer_Phone,
    Billing_Address,
    Shipping_Address,
    City,
    State,
    Country,
    Postal_Code,
    Customer_Portal_Access,
    Customer_Status_ID,
    Last_SAP_Sync,
    Created_By,
    Is_Active
)
VALUES

-- ================= PAPER BUSINESS =================

(
'CUST100001',
'ITC Limited',
(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='PAPER'),
(SELECT KAM_ID FROM KAM_Master WHERE Employee_ID=100002),
'19AAACI5950L1ZB',
'AAACI5950L',
'paper.procurement@itc.in',
'9877000001',
'Virginia House, Kolkata',
'Virginia House, Kolkata',
'Kolkata',
'West Bengal',
'India',
'700071',
TRUE,
(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Customer_Status' AND Lookup_Value='Active'),
NOW(),
'Admin',
TRUE
),

(
'CUST100002',
'JK Paper Limited',
(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='PAPER'),
(SELECT KAM_ID FROM KAM_Master WHERE Employee_ID=100002),
'21AAACJ6459N1ZP',
'AAACJ6459N',
'purchase@jkpaper.com',
'9877000002',
'Rayagada Office',
'Rayagada Office',
'Rayagada',
'Odisha',
'India',
'765001',
TRUE,
(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Customer_Status' AND Lookup_Value='Active'),
NOW(),
'Admin',
TRUE
),

(
'CUST100003',
'West Coast Paper Mills',
(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='PAPER'),
(SELECT KAM_ID FROM KAM_Master WHERE Employee_ID=100009),
'29AAACW3144A1ZX',
'AAACW3144A',
'procurement@westcoastpaper.com',
'9877000003',
'Dandeli Plant',
'Dandeli Plant',
'Dandeli',
'Karnataka',
'India',
'581325',
FALSE,
(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Customer_Status' AND Lookup_Value='Active'),
NOW(),
'Admin',
TRUE
),

(
'CUST100004',
'Century Pulp & Paper',
(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='PAPER'),
(SELECT KAM_ID FROM KAM_Master WHERE Employee_ID=100009),
'05AAACC2338K1ZM',
'AAACC2338K',
'purchase@centurypaper.in',
'9877000004',
'Lalkuan Plant',
'Lalkuan Plant',
'Nainital',
'Uttarakhand',
'India',
'263139',
TRUE,
(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Customer_Status' AND Lookup_Value='Active'),
NOW(),
'Admin',
TRUE
),

-- ================= CHEMICAL BUSINESS =================

(
'CUST200001',
'Asian Paints Limited',
(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='CHEMICAL'),
(SELECT KAM_ID FROM KAM_Master WHERE Employee_ID=100011),
'27AAACA3622K1ZU',
'AAACA3622K',
'rawmaterials@asianpaints.com',
'9877000005',
'Mumbai Office',
'Mumbai Office',
'Mumbai',
'Maharashtra',
'India',
'400093',
TRUE,
(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Customer_Status' AND Lookup_Value='Active'),
NOW(),
'Admin',
TRUE
),

(
'CUST200002',
'Berger Paints India Limited',
(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='CHEMICAL'),
(SELECT KAM_ID FROM KAM_Master WHERE Employee_ID=100011),
'19AACCB1645P1Z8',
'AACCB1645P',
'purchase@bergerindia.com',
'9877000006',
'Kolkata Office',
'Kolkata Office',
'Kolkata',
'West Bengal',
'India',
'700001',
TRUE,
(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Customer_Status' AND Lookup_Value='Active'),
NOW(),
'Admin',
TRUE
),

(
'CUST200003',
'Kansai Nerolac Paints',
(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='CHEMICAL'),
(SELECT KAM_ID FROM KAM_Master WHERE Employee_ID=100015),
'27AAACK8094P1ZL',
'AAACK8094P',
'procurement@nerolac.com',
'9877000007',
'Mumbai Office',
'Mumbai Office',
'Mumbai',
'Maharashtra',
'India',
'400057',
FALSE,
(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Customer_Status' AND Lookup_Value='Active'),
NOW(),
'Admin',
TRUE
),

(
'CUST200004',
'Akzo Nobel India Limited',
(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='CHEMICAL'),
(SELECT KAM_ID FROM KAM_Master WHERE Employee_ID=100015),
'29AABCA8056G1ZL',
'AABCA8056G',
'purchase@akzonobel.com',
'9877000008',
'Bengaluru Office',
'Bengaluru Office',
'Bengaluru',
'Karnataka',
'India',
'560001',
TRUE,
(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Customer_Status' AND Lookup_Value='Active'),
NOW(),
'Admin',
TRUE
);


-- ──  Dummy Data  in Product Master ───────────────────────────────────────────
INSERT INTO Product_Master
(
    Product_Code,
    Product_Name,
    Business_Unit_ID,
    Product_Category,
    Product_Group,
    Unit_Of_Measure,
    Product_Status_ID,
    Last_SAP_Sync,
    Created_By,
    Is_Active
)
VALUES

-- ================= PAPER PRODUCTS =================

(
'MATP100001',
'A4 Copier Paper 70 GSM',
(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='PAPER'),
'Printing Paper',
'Copier Paper',
'REAM',
(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Product_Status' AND Lookup_Value='Active'),
NOW(),
'Admin',
TRUE
),

(
'MATP100002',
'A4 Copier Paper 80 GSM',
(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='PAPER'),
'Printing Paper',
'Copier Paper',
'REAM',
(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Product_Status' AND Lookup_Value='Active'),
NOW(),
'Admin',
TRUE
),

(
'MATP100003',
'Maplitho Paper',
(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='PAPER'),
'Writing & Printing',
'Maplitho',
'MT',
(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Product_Status' AND Lookup_Value='Active'),
NOW(),
'Admin',
TRUE
),

(
'MATP100004',
'Kraft Paper',
(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='PAPER'),
'Packaging',
'Kraft',
'MT',
(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Product_Status' AND Lookup_Value='Active'),
NOW(),
'Admin',
TRUE
),

(
'MATP100005',
'Duplex Board',
(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='PAPER'),
'Packaging',
'Board',
'MT',
(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Product_Status' AND Lookup_Value='Active'),
NOW(),
'Admin',
TRUE
),

(
'MATP100006',
'Cup Stock Paper',
(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='PAPER'),
'Food Grade',
'Cup Stock',
'MT',
(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Product_Status' AND Lookup_Value='Active'),
NOW(),
'Admin',
TRUE
),

(
'MATP100007',
'Poster Paper',
(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='PAPER'),
'Printing Paper',
'Poster',
'MT',
(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Product_Status' AND Lookup_Value='Active'),
NOW(),
'Admin',
TRUE
),

(
'MATP100008',
'Tissue Paper Jumbo Roll',
(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='PAPER'),
'Tissue',
'Jumbo Roll',
'ROLL',
(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Product_Status' AND Lookup_Value='Active'),
NOW(),
'Admin',
TRUE
),

-- ================= CHEMICAL PRODUCTS =================

(
'MATC200001',
'Wet Strength Resin',
(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='CHEMICAL'),
'Paper Chemicals',
'Resin',
'KG',
(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Product_Status' AND Lookup_Value='Active'),
NOW(),
'Admin',
TRUE
),

(
'MATC200002',
'Surface Sizing Chemical',
(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='CHEMICAL'),
'Paper Chemicals',
'Sizing',
'KG',
(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Product_Status' AND Lookup_Value='Active'),
NOW(),
'Admin',
TRUE
),

(
'MATC200003',
'Defoamer',
(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='CHEMICAL'),
'Process Chemicals',
'Defoamer',
'KG',
(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Product_Status' AND Lookup_Value='Active'),
NOW(),
'Admin',
TRUE
),

(
'MATC200004',
'Retention Aid',
(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='CHEMICAL'),
'Paper Chemicals',
'Retention',
'KG',
(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Product_Status' AND Lookup_Value='Active'),
NOW(),
'Admin',
TRUE
),

(
'MATC200005',
'Optical Brightening Agent',
(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='CHEMICAL'),
'Additives',
'OBA',
'KG',
(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Product_Status' AND Lookup_Value='Active'),
NOW(),
'Admin',
TRUE
),

(
'MATC200006',
'Cationic Starch',
(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='CHEMICAL'),
'Starch',
'Modified Starch',
'KG',
(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Product_Status' AND Lookup_Value='Active'),
NOW(),
'Admin',
TRUE
),

(
'MATC200007',
'AKD Wax Emulsion',
(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='CHEMICAL'),
'Sizing Chemicals',
'AKD',
'KG',
(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Product_Status' AND Lookup_Value='Active'),
NOW(),
'Admin',
TRUE
);


-- ──  Dummy Data  in Workflow Configuration  ───────────────────────────────────────────
INSERT INTO Workflow_Configuration
(
    Business_Unit_ID,
    Stage_Number,
    Stage_Name,
    Department_ID,
    Default_Role_ID,
    SLA_Days,
    Can_Approve,
    Can_Reject,
    Can_Request_Clarification,
    Can_Request_Review,
    Created_By
)
VALUES

-- ================= PAPER BUSINESS =================

(
(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='PAPER'),
1,
'Technical Services Review',
(SELECT Department_ID FROM Department_Master
 WHERE Department_Name='Technical Services'
 AND Business_Unit_ID=(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='PAPER')),
(SELECT Role_ID FROM Role_Master WHERE Role_Name='TS Engineer'),
2,
FALSE,TRUE,TRUE,FALSE,
100014
),

(
(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='PAPER'),
2,
'Quality Control Review',
(SELECT Department_ID FROM Department_Master
 WHERE Department_Name='Quality Control'
 AND Business_Unit_ID=(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='PAPER')),
(SELECT Role_ID FROM Role_Master WHERE Role_Name='QC Engineer'),
2,
FALSE,TRUE,TRUE,FALSE,
100014
),

(
(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='PAPER'),
3,
'CAPA & Root Cause Analysis',
(SELECT Department_ID FROM Department_Master
 WHERE Department_Name='Operations'
 AND Business_Unit_ID=(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='PAPER')),
(SELECT Role_ID FROM Role_Master WHERE Role_Name='Operations Engineer'),
3,
FALSE,TRUE,TRUE,FALSE,
100014
),

(
(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='PAPER'),
4,
'Operations Head Approval',
(SELECT Department_ID FROM Department_Master
 WHERE Department_Name='Operations'
 AND Business_Unit_ID=(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='PAPER')),
(SELECT Role_ID FROM Role_Master WHERE Role_Name='Operations Head'),
2,
TRUE,TRUE,TRUE,FALSE,
100014
),

(
(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='PAPER'),
5,
'Marketing Review',
(SELECT Department_ID FROM Department_Master
 WHERE Department_Name='Marketing'
 AND Business_Unit_ID=(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='PAPER')),
(SELECT Role_ID FROM Role_Master WHERE Role_Name='Marketing Executive'),
2,
FALSE,TRUE,TRUE,FALSE,
100014
),

(
(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='PAPER'),
6,
'Marketing Head Approval',
(SELECT Department_ID FROM Department_Master
 WHERE Department_Name='Marketing'
 AND Business_Unit_ID=(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='PAPER')),
(SELECT Role_ID FROM Role_Master WHERE Role_Name='Marketing Head'),
2,
TRUE,TRUE,TRUE,TRUE,
100014
),

(
(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='PAPER'),
7,
'Finance Processing',
(SELECT Department_ID FROM Department_Master
 WHERE Department_Name='Finance'
 AND Business_Unit_ID=(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='PAPER')),
(SELECT Role_ID FROM Role_Master WHERE Role_Name='Finance Executive'),
2,
TRUE,FALSE,FALSE,FALSE,
100014
),

-- ================= CHEMICAL BUSINESS =================

(
(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='CHEMICAL'),
1,
'Technical Services Review',
(SELECT Department_ID FROM Department_Master
 WHERE Department_Name='Technical Services'
 AND Business_Unit_ID=(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='CHEMICAL')),
(SELECT Role_ID FROM Role_Master WHERE Role_Name='TS Engineer'),
2,
FALSE,TRUE,TRUE,FALSE,
100014
),

(
(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='CHEMICAL'),
2,
'Quality Control Review',
(SELECT Department_ID FROM Department_Master
 WHERE Department_Name='Quality Control'
 AND Business_Unit_ID=(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='CHEMICAL')),
(SELECT Role_ID FROM Role_Master WHERE Role_Name='QC Engineer'),
2,
FALSE,TRUE,TRUE,FALSE,
100014
),

(
(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='CHEMICAL'),
3,
'CAPA & Root Cause Analysis',
(SELECT Department_ID FROM Department_Master
 WHERE Department_Name='Operations'
 AND Business_Unit_ID=(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='CHEMICAL')),
(SELECT Role_ID FROM Role_Master WHERE Role_Name='Operations Engineer'),
3,
FALSE,TRUE,TRUE,FALSE,
100014
),

(
(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='CHEMICAL'),
4,
'Operations Head Approval',
(SELECT Department_ID FROM Department_Master
 WHERE Department_Name='Operations'
 AND Business_Unit_ID=(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='CHEMICAL')),
(SELECT Role_ID FROM Role_Master WHERE Role_Name='Operations Head'),
2,
TRUE,TRUE,TRUE,FALSE,
100014
),

(
(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='CHEMICAL'),
5,
'Marketing Review',
(SELECT Department_ID FROM Department_Master
 WHERE Department_Name='Marketing'
 AND Business_Unit_ID=(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='CHEMICAL')),
(SELECT Role_ID FROM Role_Master WHERE Role_Name='Marketing Executive'),
2,
FALSE,TRUE,TRUE,FALSE,
100014
),

(
(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='CHEMICAL'),
6,
'Marketing Head Approval',
(SELECT Department_ID FROM Department_Master
 WHERE Department_Name='Marketing'
 AND Business_Unit_ID=(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='CHEMICAL')),
(SELECT Role_ID FROM Role_Master WHERE Role_Name='Marketing Head'),
2,
TRUE,TRUE,TRUE,TRUE,
100014
),

(
(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='CHEMICAL'),
7,
'Finance Processing',
(SELECT Department_ID FROM Department_Master
 WHERE Department_Name='Finance'
 AND Business_Unit_ID=(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='CHEMICAL')),
(SELECT Role_ID FROM Role_Master WHERE Role_Name='Finance Executive'),
2,
TRUE,FALSE,FALSE,FALSE,
100014
);


-- ──  Dummy Data  in Invoice Master  ───────────────────────────────────────────
INSERT INTO Invoice_Master
(
    Invoice_No,
    Line_Item,
    Customer_ID,
    Product_Code,
    Invoice_Date,
    Delivery_Date,
    Quantity,
    Unit_Of_Measure,
    Unit_Price,
    Net_Amount,
    Purchase_Order_No,
    Billing_Type,
    Distribution_Channel,
    Division,
    Transporter_Name,
    Truck_No,
    LR_Number,
    Last_SAP_Sync
)
VALUES

-- ================= INV100001 =================

('INV100001',1,'CUST100001','MATP100001','2026-06-01','2026-06-03',100,'REAM',280.00,28000.00,'PO100001','F2','Domestic','Paper','VRL Logistics','MH12AB1234','LR100001',NOW()),

('INV100001',2,'CUST100001','MATP100002','2026-06-01','2026-06-03',150,'REAM',320.00,48000.00,'PO100001','F2','Domestic','Paper','VRL Logistics','MH12AB1234','LR100001',NOW()),

('INV100001',3,'CUST100001','MATP100004','2026-06-01','2026-06-03',20,'MT',55000.00,1100000.00,'PO100001','F2','Domestic','Paper','VRL Logistics','MH12AB1234','LR100001',NOW()),

-- ================= INV100002 =================

('INV100002',1,'CUST100002','MATP100003','2026-06-05','2026-06-07',15,'MT',65000.00,975000.00,'PO100002','F2','Domestic','Paper','TCI Express','RJ14CD5678','LR100002',NOW()),

('INV100002',2,'CUST100002','MATP100006','2026-06-05','2026-06-07',10,'MT',72000.00,720000.00,'PO100002','F2','Domestic','Paper','TCI Express','RJ14CD5678','LR100002',NOW()),

('INV100002',3,'CUST100002','MATP100007','2026-06-05','2026-06-07',8,'MT',58000.00,464000.00,'PO100002','F2','Domestic','Paper','TCI Express','RJ14CD5678','LR100002',NOW()),

-- ================= INV100003 =================

('INV100003',1,'CUST100003','MATP100005','2026-06-10','2026-06-12',12,'MT',68000.00,816000.00,'PO100003','F2','Domestic','Paper','Safe Express','KA05EF2233','LR100003',NOW()),

('INV100003',2,'CUST100003','MATP100008','2026-06-10','2026-06-12',25,'ROLL',18000.00,450000.00,'PO100003','F2','Domestic','Paper','Safe Express','KA05EF2233','LR100003',NOW()),

('INV100003',3,'CUST100003','MATP100001','2026-06-10','2026-06-12',200,'REAM',280.00,56000.00,'PO100003','F2','Domestic','Paper','Safe Express','KA05EF2233','LR100003',NOW()),

-- ================= INV100004 =================

('INV100004',1,'CUST100004','MATP100004','2026-06-15','2026-06-17',18,'MT',55000.00,990000.00,'PO100004','F2','Domestic','Paper','Delhivery','UK07GH7788','LR100004',NOW());

INSERT INTO Invoice_Master
(
    Invoice_No,
    Line_Item,
    Customer_ID,
    Product_Code,
    Invoice_Date,
    Delivery_Date,
    Quantity,
    Unit_Of_Measure,
    Unit_Price,
    Net_Amount,
    Purchase_Order_No,
    Billing_Type,
    Distribution_Channel,
    Division,
    Transporter_Name,
    Truck_No,
    LR_Number,
    Last_SAP_Sync
)
VALUES

-- ================= INV100004 =================

('INV100004',2,'CUST100004','MATP100006','2026-06-15','2026-06-17',12,'MT',72000.00,864000.00,'PO100004','F2','Domestic','Paper','Delhivery','UK07GH7788','LR100004',NOW()),

('INV100004',3,'CUST100004','MATP100003','2026-06-15','2026-06-17',10,'MT',65000.00,650000.00,'PO100004','F2','Domestic','Paper','Delhivery','UK07GH7788','LR100004',NOW()),

-- ================= INV100005 =================

('INV100005',1,'CUST200001','MATC200001','2026-06-18','2026-06-20',500,'KG',180.00,90000.00,'PO200001','F2','Domestic','Chemical','Blue Dart','MH20AA1122','LR200001',NOW()),

('INV100005',2,'CUST200001','MATC200002','2026-06-18','2026-06-20',300,'KG',210.00,63000.00,'PO200001','F2','Domestic','Chemical','Blue Dart','MH20AA1122','LR200001',NOW()),

('INV100005',3,'CUST200001','MATC200003','2026-06-18','2026-06-20',200,'KG',160.00,32000.00,'PO200001','F2','Domestic','Chemical','Blue Dart','MH20AA1122','LR200001',NOW()),

-- ================= INV100006 =================

('INV100006',1,'CUST200002','MATC200004','2026-06-21','2026-06-23',600,'KG',190.00,114000.00,'PO200002','F2','Domestic','Chemical','TCI Express','MH21BB2233','LR200002',NOW()),

('INV100006',2,'CUST200002','MATC200005','2026-06-21','2026-06-23',250,'KG',260.00,65000.00,'PO200002','F2','Domestic','Chemical','TCI Express','MH21BB2233','LR200002',NOW()),

('INV100006',3,'CUST200002','MATC200006','2026-06-21','2026-06-23',800,'KG',95.00,76000.00,'PO200002','F2','Domestic','Chemical','TCI Express','MH21BB2233','LR200002',NOW()),

-- ================= INV100007 =================

('INV100007',1,'CUST200003','MATC200007','2026-06-24','2026-06-26',400,'KG',240.00,96000.00,'PO200003','F2','Domestic','Chemical','VRL Logistics','KA01CC3344','LR200003',NOW()),

('INV100007',2,'CUST200003','MATC200001','2026-06-24','2026-06-26',350,'KG',180.00,63000.00,'PO200003','F2','Domestic','Chemical','VRL Logistics','KA01CC3344','LR200003',NOW());

INSERT INTO Invoice_Master
(
    Invoice_No,
    Line_Item,
    Customer_ID,
    Product_Code,
    Invoice_Date,
    Delivery_Date,
    Quantity,
    Unit_Of_Measure,
    Unit_Price,
    Net_Amount,
    Purchase_Order_No,
    Billing_Type,
    Distribution_Channel,
    Division,
    Transporter_Name,
    Truck_No,
    LR_Number,
    Last_SAP_Sync
)
VALUES

-- ================= INV100007 =================

('INV100007',3,'CUST200003','MATC200005','2026-06-24','2026-06-26',150,'KG',260.00,39000.00,'PO200003','F2','Domestic','Chemical','VRL Logistics','KA01CC3344','LR200003',NOW()),

-- ================= INV100008 =================

('INV100008',1,'CUST200004','MATC200002','2026-06-26','2026-06-28',450,'KG',210.00,94500.00,'PO200004','F2','Domestic','Chemical','Delhivery','TN10DD4455','LR200004',NOW()),

('INV100008',2,'CUST200004','MATC200004','2026-06-26','2026-06-28',550,'KG',190.00,104500.00,'PO200004','F2','Domestic','Chemical','Delhivery','TN10DD4455','LR200004',NOW()),

('INV100008',3,'CUST200004','MATC200007','2026-06-26','2026-06-28',300,'KG',240.00,72000.00,'PO200004','F2','Domestic','Chemical','Delhivery','TN10DD4455','LR200004',NOW()),

-- ================= INV100009 =================

('INV100009',1,'CUST100001','MATP100002','2026-06-27','2026-06-29',180,'REAM',320.00,57600.00,'PO100005','F2','Domestic','Paper','Safe Express','MH11EE5566','LR100005',NOW()),

('INV100009',2,'CUST100001','MATP100005','2026-06-27','2026-06-29',16,'MT',68000.00,1088000.00,'PO100005','F2','Domestic','Paper','Safe Express','MH11EE5566','LR100005',NOW()),

('INV100009',3,'CUST100001','MATP100006','2026-06-27','2026-06-29',14,'MT',72000.00,1008000.00,'PO100005','F2','Domestic','Paper','Safe Express','MH11EE5566','LR100005',NOW()),

-- ================= INV100010 =================

('INV100010',1,'CUST200002','MATC200003','2026-06-29','2026-07-01',350,'KG',160.00,56000.00,'PO200005','F2','Domestic','Chemical','Blue Dart','GJ05FF6677','LR200005',NOW()),

('INV100010',2,'CUST200002','MATC200006','2026-06-29','2026-07-01',900,'KG',95.00,85500.00,'PO200005','F2','Domestic','Chemical','Blue Dart','GJ05FF6677','LR200005',NOW()),

('INV100010',3,'CUST200002','MATC200001','2026-06-29','2026-07-01',500,'KG',180.00,90000.00,'PO200005','F2','Domestic','Chemical','Blue Dart','GJ05FF6677','LR200005',NOW());



-- ──  Dummy Data  in Complaint Header  ───────────────────────────────────────────
INSERT INTO Complaint_Header
(
    Complaint_Number,
    Customer_ID,
    KAM_ID,
    Business_Unit_ID,
    Complaint_Source_ID,
    Complaint_Date,
    Complaint_Title,
    Complaint_Description,
    Priority_ID,
    Complaint_Status_ID,
    Current_Department_ID,
    Current_Assignee_ID,
    Total_Complaint_Value,
    Expected_Settlement_Amount,
    Is_Duplicate,
    Created_By,
    Is_Active
)
VALUES

-- ======================================================
-- Complaint 1 : Low GSM
-- ======================================================

(
'CMP20260001',

'CUST100001',

(SELECT KAM_ID
 FROM KAM_Master
 WHERE Employee_ID=100002),

(SELECT Business_Unit_ID
 FROM Business_Unit_Master
 WHERE Business_Unit_Code='PAPER'),

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Complaint_Source'
 AND Lookup_Value='Customer Portal'),

'2026-06-04 10:15:00',

'Low GSM Paper Received',

'Customer reported that the supplied paper GSM is significantly lower than the ordered specification.',

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Priority'
 AND Lookup_Value='High'),

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Complaint_Status'
 AND Lookup_Value='Submitted'),

(SELECT Department_ID
 FROM Department_Master
 WHERE Department_Name='Technical Services'
 AND Business_Unit_ID=
 (
     SELECT Business_Unit_ID
     FROM Business_Unit_Master
     WHERE Business_Unit_Code='PAPER'
 )),

100003,

1100000,

900000,

FALSE,

100014,

TRUE
),

-- ======================================================
-- Complaint 2 : Torn Paper
-- ======================================================

(
'CMP20260002',

'CUST100002',

(SELECT KAM_ID
 FROM KAM_Master
 WHERE Employee_ID=100002),

(SELECT Business_Unit_ID
 FROM Business_Unit_Master
 WHERE Business_Unit_Code='PAPER'),

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Complaint_Source'
 AND Lookup_Value='KAM'),

'2026-06-08 11:00:00',

'Torn Paper Bundles',

'Several paper bundles were received in damaged condition due to handling during transportation.',

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Priority'
 AND Lookup_Value='Medium'),

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Complaint_Status'
 AND Lookup_Value='Submitted'),

(SELECT Department_ID
 FROM Department_Master
 WHERE Department_Name='Technical Services'
 AND Business_Unit_ID=
 (
     SELECT Business_Unit_ID
     FROM Business_Unit_Master
     WHERE Business_Unit_Code='PAPER'
 )),

100003,

720000,

500000,

FALSE,

100014,

TRUE
),

-- ======================================================
-- Complaint 3 : Moisture Issue
-- ======================================================

(
'CMP20260003',

'CUST100003',

(SELECT KAM_ID
 FROM KAM_Master
 WHERE Employee_ID=100009),

(SELECT Business_Unit_ID
 FROM Business_Unit_Master
 WHERE Business_Unit_Code='PAPER'),

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Complaint_Source'
 AND Lookup_Value='Customer Portal'),

'2026-06-13 14:00:00',

'Moisture Content High',

'Paper rolls contain excessive moisture resulting in poor printing quality.',

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Priority'
 AND Lookup_Value='Critical'),

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Complaint_Status'
 AND Lookup_Value='Submitted'),

(SELECT Department_ID
 FROM Department_Master
 WHERE Department_Name='Technical Services'
 AND Business_Unit_ID=
 (
     SELECT Business_Unit_ID
     FROM Business_Unit_Master
     WHERE Business_Unit_Code='PAPER'
 )),

100003,

816000,

700000,

FALSE,

100014,

TRUE
),

-- ======================================================
-- Complaint 4 : Color Difference
-- ======================================================

(
'CMP20260004',

'CUST200001',

(SELECT KAM_ID
 FROM KAM_Master
 WHERE Employee_ID=100011),

(SELECT Business_Unit_ID
 FROM Business_Unit_Master
 WHERE Business_Unit_Code='CHEMICAL'),

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Complaint_Source'
 AND Lookup_Value='Sales'),

'2026-06-19 09:30:00',

'Color Difference in Chemical Batch',

'Customer observed color variation compared to the approved sample.',

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Priority'
 AND Lookup_Value='High'),

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Complaint_Status'
 AND Lookup_Value='Submitted'),

(SELECT Department_ID
 FROM Department_Master
 WHERE Department_Name='Technical Services'
 AND Business_Unit_ID=
 (
     SELECT Business_Unit_ID
     FROM Business_Unit_Master
     WHERE Business_Unit_Code='CHEMICAL'
 )),

100011,

90000,

50000,

FALSE,

100014,

TRUE
),

-- ======================================================
-- Complaint 5 : Packaging Damage
-- ======================================================

(
'CMP20260005',

'CUST200002',

(SELECT KAM_ID
 FROM KAM_Master
 WHERE Employee_ID=100011),

(SELECT Business_Unit_ID
 FROM Business_Unit_Master
 WHERE Business_Unit_Code='CHEMICAL'),

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Complaint_Source'
 AND Lookup_Value='Customer Portal'),

'2026-06-22 16:45:00',

'Packaging Damage During Transit',

'Multiple chemical bags were torn during transportation causing material leakage.',

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Priority'
 AND Lookup_Value='Medium'),

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Complaint_Status'
 AND Lookup_Value='Submitted'),

(SELECT Department_ID
 FROM Department_Master
 WHERE Department_Name='Technical Services'
 AND Business_Unit_ID=
 (
     SELECT Business_Unit_ID
     FROM Business_Unit_Master
     WHERE Business_Unit_Code='CHEMICAL'
 )),

100011,

114000,

70000,

FALSE,

100014,

TRUE
);




-- ──  UPdate Workflow Congifuration  ───────────────────────────────────────────
UPDATE Workflow_Configuration
SET Stage_Number = 8
WHERE Workflow_ID IN (7,14);

INSERT INTO Workflow_Configuration
(
    Business_Unit_ID,
    Stage_Number,
    Stage_Name,
    Department_ID,
    Default_Role_ID,
    SLA_Days,
    Can_Approve,
    Can_Reject,
    Can_Request_Clarification,
    Can_Request_Review,
    Created_By
)
VALUES

-- PAPER
(
(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='PAPER'),
7,
'MD Approval',
(SELECT Department_ID
 FROM Department_Master
 WHERE Department_Name='Administration'
 AND Business_Unit_ID=(SELECT Business_Unit_ID
                       FROM Business_Unit_Master
                       WHERE Business_Unit_Code='PAPER')),
(SELECT Role_ID
 FROM Role_Master
 WHERE Role_Name='Managing Director'),
2,
TRUE,
TRUE,
FALSE,
FALSE,
100014
),

-- CHEMICAL
(
(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='CHEMICAL'),
7,
'MD Approval',
(SELECT Department_ID
 FROM Department_Master
 WHERE Department_Name='Administration'
 AND Business_Unit_ID=(SELECT Business_Unit_ID
                       FROM Business_Unit_Master
                       WHERE Business_Unit_Code='CHEMICAL')),
(SELECT Role_ID
 FROM Role_Master
 WHERE Role_Name='Managing Director'),
2,
TRUE,
TRUE,
FALSE,
FALSE,
100014
);

--  ──── dummy data on Complaint Line Item  ───────────────────────────────────────────
INSERT INTO Complaint_Line_Item
(
    Complaint_ID,
    Invoice_No,
    Line_Item,
    Defective_Quantity,
    Complaint_Category_ID,
    Defect_Nature_ID,
    Complaint_Value,
    Customer_Remarks,
    Created_By
)
VALUES

-- Complaint 1 : Low GSM
(
1,
'INV100001',
3,
5,

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Complaint_Category'
 AND Lookup_Value='Quality'),

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Defect_Nature'
 AND Lookup_Value='Low GSM'),

275000.00,

'Paper GSM measured below specification.',

100014
),

-- Complaint 2 : Torn Paper
(
2,
'INV100002',
2,
2,

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Complaint_Category'
 AND Lookup_Value='Packaging'),

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Defect_Nature'
 AND Lookup_Value='Torn / Damaged'),

144000.00,

'Bundles received torn during unloading.',

100014
),

-- Complaint 3 : Moisture
(
3,
'INV100003',
1,
3,

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Complaint_Category'
 AND Lookup_Value='Quality'),

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Defect_Nature'
 AND Lookup_Value='Moisture'),

204000.00,

'High moisture observed in supplied paper.',

100014
),

-- Complaint 4 : Color Difference
(
4,
'INV100005',
2,
80,

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Complaint_Category'
 AND Lookup_Value='Quality'),

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Defect_Nature'
 AND Lookup_Value='Color Difference'),

16800.00,

'Chemical batch color differs from approved sample.',

100014
),

-- Complaint 5 : Packaging Damage
(
5,
'INV100006',
1,
120,

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Complaint_Category'
 AND Lookup_Value='Packaging'),

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Defect_Nature'
 AND Lookup_Value='Torn / Damaged'),

22800.00,

'Chemical bags damaged during transportation.',

100014
);


--  ──── dummy data on Complaint Workflow Log  ───────────────────────────────────────────
INSERT INTO Complaint_Workflow_Log
(
    Complaint_ID,
    Workflow_ID,
    Action_By,
    Action_Type_ID,
    Previous_Department_ID,
    Current_Department_ID,
    Remarks
)
VALUES

(
1,
(SELECT Workflow_ID
 FROM Workflow_Configuration
 WHERE Business_Unit_ID=(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='PAPER')
   AND Stage_Number=1),

100002,

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Workflow_Action'
   AND Lookup_Value='Submitted'),

NULL,

(SELECT Department_ID
 FROM Department_Master
 WHERE Department_Name='Technical Services'
   AND Business_Unit_ID=(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='PAPER')),

'Complaint submitted to Technical Services.'
),

(
2,
(SELECT Workflow_ID
 FROM Workflow_Configuration
 WHERE Business_Unit_ID=(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='PAPER')
   AND Stage_Number=1),

100002,

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Workflow_Action'
   AND Lookup_Value='Submitted'),

NULL,

(SELECT Department_ID
 FROM Department_Master
 WHERE Department_Name='Technical Services'
   AND Business_Unit_ID=(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='PAPER')),

'Complaint submitted to Technical Services.'
),

(
3,
(SELECT Workflow_ID
 FROM Workflow_Configuration
 WHERE Business_Unit_ID=(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='PAPER')
   AND Stage_Number=1),

100009,

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Workflow_Action'
   AND Lookup_Value='Submitted'),

NULL,

(SELECT Department_ID
 FROM Department_Master
 WHERE Department_Name='Technical Services'
   AND Business_Unit_ID=(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='PAPER')),

'Complaint submitted to Technical Services.'
),

(
4,
(SELECT Workflow_ID
 FROM Workflow_Configuration
 WHERE Business_Unit_ID=(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='CHEMICAL')
   AND Stage_Number=1),

100011,

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Workflow_Action'
   AND Lookup_Value='Submitted'),

NULL,

(SELECT Department_ID
 FROM Department_Master
 WHERE Department_Name='Technical Services'
   AND Business_Unit_ID=(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='CHEMICAL')),

'Complaint submitted to Technical Services.'
),

(
5,
(SELECT Workflow_ID
 FROM Workflow_Configuration
 WHERE Business_Unit_ID=(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='CHEMICAL')
   AND Stage_Number=1),

100011,

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Workflow_Action'
   AND Lookup_Value='Submitted'),

NULL,

(SELECT Department_ID
 FROM Department_Master
 WHERE Department_Name='Technical Services'
   AND Business_Unit_ID=(SELECT Business_Unit_ID FROM Business_Unit_Master WHERE Business_Unit_Code='CHEMICAL')),

'Complaint submitted to Technical Services.'
);

--  ──── dummy data on Technical Service Details  ───────────────────────────────────────────
INSERT INTO Technical_Service_Details
(
    Complaint_ID,
    Assigned_Engineer_ID,
    Investigation_Date,
    Technical_Observation,
    Clarification_Required,
    Sample_Required,
    Visit_Required,
    Recommended_Action,
    Can_Close_Complaint,
    Remarks,
    Created_By
)
VALUES

(
1,
100003,
'2026-06-05 11:00:00',
'Measured GSM found below ordered specification.',
FALSE,
TRUE,
TRUE,
'Send sample to QC for laboratory verification.',
FALSE,
'Field investigation completed.',
100003
),

(
2,
100003,
'2026-06-09 10:30:00',
'Damage caused during transportation. Manufacturing defect not observed.',
FALSE,
FALSE,
FALSE,
'Recommend settlement without laboratory testing.',
TRUE,
'No further technical investigation required.',
100003
),

(
3,
100003,
'2026-06-14 14:15:00',
'High moisture content suspected. Site visit recommended.',
FALSE,
TRUE,
TRUE,
'Collect samples and forward to QC.',
FALSE,
'Further investigation required.',
100003
),

(
4,
100011,
'2026-06-20 09:45:00',
'Color variation observed compared with approved batch.',
TRUE,
TRUE,
FALSE,
'Seek batch history and laboratory verification.',
FALSE,
'Customer clarification required before QC review.',
100011
),

(
5,
100011,
'2026-06-23 15:30:00',
'Packaging damaged during transport causing leakage.',
FALSE,
FALSE,
TRUE,
'Conduct customer site visit before settlement.',
FALSE,
'Transportation conditions need verification.',
100011
);

--  ──── dummy data on Visit Details  ───────────────────────────────────────────
INSERT INTO Visit_Details
(
    Complaint_ID,
    Engineer_ID,
    Visit_Date,
    Visit_Status_ID,
    Visit_Findings,
    Customer_Feedback,
    Follow_Up_Required,
    Remarks,
    Created_By
)
VALUES

-- =====================================================
-- Complaint 1
-- =====================================================

(
1,
100003,
'2026-06-06 11:00:00',

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Visit_Status'
   AND Lookup_Value='Completed'),

'Paper GSM measured between 66–67 GSM instead of the ordered 70 GSM. Samples collected for QC testing.',

'Customer requested replacement of the affected lot.',

TRUE,

'Visit completed successfully.',

100003
),

-- =====================================================
-- Complaint 3
-- =====================================================

(
3,
100003,
'2026-06-15 02:30:00',

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Visit_Status'
   AND Lookup_Value='Completed'),

'Improper warehouse storage conditions resulted in increased moisture content.',

'Customer agreed to send additional samples for verification.',

TRUE,

'QC laboratory testing recommended.',

100003
),

-- =====================================================
-- Complaint 5
-- =====================================================

(
5,
100011,
'2026-06-24 10:00:00',

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Visit_Status'
   AND Lookup_Value='Completed'),

'Packaging damage observed due to mishandling during transportation.',

'Customer requested compensation for damaged material.',

FALSE,

'Transportation issue confirmed.',

100011
);


--  ──── dummy data on Sample Tracking  ───────────────────────────────────────────
INSERT INTO Sample_Tracking
(
    Complaint_ID,
    Sample_Request_Date,
    Sample_Dispatched_Date,
    Sample_Received_Date,
    Sample_Status_ID,
    Courier_Details,
    Received_By,
    Sample_Condition,
    Remarks,
    Created_By
)
VALUES

-- =====================================================
-- Complaint 1
-- =====================================================
(
1,
'2026-06-06 14:00:00',
'2026-06-07 10:00:00',
'2026-06-08 11:30:00',

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Sample_Status'
   AND Lookup_Value='Received'),

'Blue Dart - AWB BD100001',

100005,

'Sample received in good condition.',

'Forwarded to QC laboratory for GSM verification.',

100003
),

-- =====================================================
-- Complaint 3
-- =====================================================
(
3,
'2026-06-15 15:30:00',
'2026-06-16 09:45:00',
'2026-06-17 10:15:00',

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Sample_Status'
   AND Lookup_Value='Received'),

'DTDC - AWB DT100002',

100005,

'Moisture observed during sample inspection.',

'Laboratory testing initiated.',

100003
),

-- =====================================================
-- Complaint 4
-- =====================================================
(
4,
'2026-06-20 13:00:00',
'2026-06-20 17:15:00',
'2026-06-21 09:30:00',

(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Sample_Status'
   AND Lookup_Value='Received'),

'Delhivery - AWB DL100003',

100012,

'Chemical sample sealed and intact.',

'Color comparison testing initiated.',

100011
);

--  ──── dummy data on Quality Control Details  ───────────────────────────────────────────
INSERT INTO Quality_Control_Details
(
    Complaint_ID,
    QC_Engineer_ID,
    Inspection_Date,
    Sample_Verified,
    QC_Observation,
    QC_Recommendation,
    Remarks,
    Created_By
)
VALUES

-- =====================================================
-- Complaint 1
-- =====================================================
(
1,
100005,
'2026-06-09 10:30:00',
TRUE,

'Laboratory testing confirmed average GSM of 66.8 against the ordered 70 GSM.',

'Complaint validated. Initiate CAPA and process commercial settlement.',

'QC report approved.',

100005
),

-- =====================================================
-- Complaint 3
-- =====================================================
(
3,
100005,
'2026-06-18 11:15:00',
TRUE,

'Moisture level exceeded acceptable specification due to improper storage conditions.',

'Initiate CAPA and recommend corrective storage procedures.',

'QC investigation completed.',

100005
),

-- =====================================================
-- Complaint 4
-- =====================================================
(
4,
100012,
'2026-06-22 09:45:00',
TRUE,

'Color variation found within approved manufacturing tolerance.',

'Complaint not technically justified. Recommend rejection.',

'QC report finalized.',

100012
);

--  ──── dummy data on CAPA Analysis  ───────────────────────────────────────────
INSERT INTO CAPA_Analysis
(
    Complaint_ID,
    Root_Cause_Analysis,
    Corrective_Action,
    Preventive_Action,
    Responsible_Employee_ID,
    Target_Completion_Date,
    Completion_Date,
    Effectiveness_Verified,
    Approved_By,
    Approval_Date,
    Remarks,
    Created_By
)
VALUES

-- =====================================================
-- Complaint 1
-- =====================================================
(
1,
'Machine calibration drift resulted in paper being produced below the specified GSM.',
'Production machine recalibrated and affected production lot isolated.',
'Introduce daily GSM calibration checks and weekly preventive maintenance.',
100007,
'2026-06-15',
'2026-06-14',
TRUE,
100006,
'2026-06-14 16:00:00',
'CAPA implemented successfully and verified effective.',
100007
),
-- =====================================================
-- Complaint 3
-- =====================================================
(
3,
'Improper warehouse storage conditions exposed finished goods to excessive humidity.',
'Warehouse ventilation improved and damaged stock segregated.',
'Install continuous humidity monitoring and revise storage SOP.',
100007,
'2026-06-28',
NULL,
FALSE,
NULL,
NULL,
'Corrective actions initiated. Effectiveness verification pending.',
100007
);

--  ──── dummy data on Settlement Details  ───────────────────────────────────────────
INSERT INTO Settlement_Details
(
    Complaint_ID,
    Settlement_Type_ID,
    Proposed_Amount,
    Approved_Amount,
    Approval_Status_ID,
    Approved_By,
    Approval_Date,
    Commercial_Remarks,
    Created_By
)
VALUES
-- Complaint 1 (Above ₹1 lakh → MD Approved)
(
1,
(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Settlement_Type'
   AND Lookup_Value='Credit Note'),
900000,
900000,
(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Settlement_Status'
   AND Lookup_Value='Approved'),
100001,
'2026-06-16 11:00:00',
'MD approved full commercial settlement.',
100010
),
-- Complaint 2 (Replacement Approved)
(
2,
(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Settlement_Type'
   AND Lookup_Value='Replacement'),
500000,
500000,
(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Settlement_Status'
   AND Lookup_Value='Approved'),
100008,
'2026-06-11 15:30:00',
'Replacement approved by Marketing Head.',
100010
),
-- Complaint 3 (Pending)
(
3,
(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Settlement_Type'
   AND Lookup_Value='Compensation'),
700000,
NULL,
(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Settlement_Status'
   AND Lookup_Value='Pending'),
NULL,
NULL,
'Awaiting CAPA completion before commercial approval.',
100010
),
-- Complaint 5 (Below ₹1 lakh)
(
5,
(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Settlement_Type'
   AND Lookup_Value='Compensation'),
70000,
70000,
(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Settlement_Status'
   AND Lookup_Value='Approved'),
100008,
'2026-06-26 10:30:00',
'Marketing Head approved settlement.',
100010
);

--  ──── dummy data on Credit Note  ───────────────────────────────────────────
INSERT INTO Credit_Note
(
    Complaint_ID,
    Settlement_ID,
    Credit_Note_Number,
    Credit_Note_Date,
    Credit_Note_Amount,
    SAP_Fiscal_Year,
    SAP_Company_Code,
    SAP_Sync_Status_ID,
    SAP_Response_Message,
    Created_By
)
VALUES
(
1,
(SELECT Settlement_ID FROM Settlement_Details WHERE Complaint_ID=1),
'CN20260001',
'2026-06-17',
900000,
'2026',
'1000',
(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='SAP_Sync_Status'
   AND Lookup_Value='Posted'),
'Credit Note successfully posted to SAP.',
100010
),
(
2,
(SELECT Settlement_ID FROM Settlement_Details WHERE Complaint_ID=2),
'CN20260002',
'2026-06-12',
500000,
'2026',
'1000',
(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='SAP_Sync_Status'
   AND Lookup_Value='Posted'),
'Credit Note successfully posted to SAP.',
100010
),
(
5,
(SELECT Settlement_ID FROM Settlement_Details WHERE Complaint_ID=5),
'CN20260003',
'2026-06-27',
70000,
'2026',
'1000',
(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='SAP_Sync_Status'
   AND Lookup_Value='Pending'),
'Waiting for SAP integration service.',
100010
);


--  ──── dummy data on Attachement Master  ───────────────────────────────────────────
INSERT INTO Attachment_Master
(
    Complaint_ID,
    Uploaded_By,
    File_Name,
    File_Path,
    File_Type,
    File_Size_KB,
    Remarks,
    Created_By
)
VALUES

(
1,
100002,
'gsm_test_report.pdf',
'/uploads/2026/06/gsm_test_report.pdf',
'application/pdf',
1245.60,
'Customer uploaded initial complaint evidence.',
100002
),

(
2,
100002,
'damaged_paper.jpg',
'/uploads/2026/06/damaged_paper.jpg',
'image/jpeg',
845.20,
'Photographs showing torn paper bundles.',
100002
),

(
3,
100009,
'moisture_readings.xlsx',
'/uploads/2026/06/moisture_readings.xlsx',
'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
356.80,
'Warehouse moisture measurements.',
100009
),

(
4,
100011,
'chemical_sample_photo.png',
'/uploads/2026/06/chemical_sample_photo.png',
'image/png',
612.30,
'Image of color variation.',
100011
),

(
5,
100011,
'transport_damage.pdf',
'/uploads/2026/06/transport_damage.pdf',
'application/pdf',
978.40,
'Transport damage assessment.',
100011
);


--  ──── dummy data on Notification Log  ───────────────────────────────────────────
INSERT INTO Notification_Log
(
    Complaint_ID,
    Recipient_Employee_ID,
    Recipient_Email,
    Notification_Type_ID,
    Notification_Status_ID,
    Notification_Date,
    Failure_Reason
)
VALUES
(
1,
100003,
'ts.engineer@orientmills.com',
(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Notification_Type'
   AND Lookup_Value='Email'),
(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Notification_Status'
   AND Lookup_Value='Sent'),
'2026-06-04 10:20:00',
NULL
),
(
2,
100003,
'ts.engineer@orientmills.com',
(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Notification_Type'
   AND Lookup_Value='Email'),
(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Notification_Status'
   AND Lookup_Value='Sent'),
'2026-06-08 11:10:00',
NULL
),
(
3,
100003,
'ts.engineer@orientmills.com',
(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Notification_Type'
   AND Lookup_Value='Email'),
(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Notification_Status'
   AND Lookup_Value='Sent'),
'2026-06-13 14:05:00',

NULL
),
(
4,
100011,
'ts.chemical@orientmills.com',
(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Notification_Type'
   AND Lookup_Value='Email'),
(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Notification_Status'
   AND Lookup_Value='Sent'),
'2026-06-19 09:35:00',
NULL
),
(
5,
100011,
'ts.chemical@orientmills.com',
(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Notification_Type'
   AND Lookup_Value='Email'),
(SELECT Lookup_ID
 FROM Lookup_Master
 WHERE Lookup_Type='Notification_Status'
   AND Lookup_Value='Sent'),
'2026-06-22 16:50:00',
NULL
);


--  ────────────── Fixx ───────────────────────────────────────────
ALTER TABLE Employee_Master ADD COLUMN Password_Hash VARCHAR(255) NULL AFTER Official_Email;
ALTER TABLE Workflow_Configuration ADD CONSTRAINT uq_workflow_stage UNIQUE (Business_Unit_ID, Stage_Number);
SELECT
    Employee_ID,
    Employee_Code,
    Employee_Name,
    Reporting_Manager_ID
FROM Employee_Master WHERE Reporting_Manager_ID IS NULL ORDER BY Employee_ID;

CREATE INDEX idx_complaint_date
ON Complaint_Header (Complaint_Date);

CREATE INDEX idx_complaint_bu
ON Complaint_Header (Business_Unit_ID);

CREATE INDEX idx_settlement_status
ON Settlement_Details (Approval_Status_ID);

CREATE INDEX idx_notification_date
ON Notification_Log (Notification_Date);

ALTER TABLE Complaint_Header
ADD COLUMN SLA_Due_Date DATETIME NULL AFTER Complaint_Date,
ADD COLUMN SLA_Breached BOOLEAN NOT NULL DEFAULT FALSE AFTER SLA_Due_Date;

SELECT Complaint_ID, Customer_ID
FROM Complaint_Header ch
WHERE NOT EXISTS (
    SELECT 1
    FROM Customer_Master cm
    WHERE cm.Customer_ID = ch.Customer_ID
);

SELECT Complaint_Line_Item_ID,
       Invoice_No,
       Line_Item
FROM Complaint_Line_Item cli
WHERE NOT EXISTS (
    SELECT 1
    FROM Invoice_Master im
    WHERE im.Invoice_No = cli.Invoice_No
      AND im.Line_Item = cli.Line_Item
);