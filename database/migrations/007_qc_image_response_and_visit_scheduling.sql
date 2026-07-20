-- CCMS Database Migration 007
-- QC Attachment Responses and SLA tracking modifications

USE CCMS;

-- 1. Create QC Attachment Responses table
CREATE TABLE IF NOT EXISTS QC_Attachment_Response (
    QC_Response_ID  BIGINT PRIMARY KEY AUTO_INCREMENT,
    QC_Details_ID   BIGINT NOT NULL,
    Attachment_ID   BIGINT NOT NULL,
    QC_Remarks      TEXT NULL,
    Reply_File_Path VARCHAR(500) NULL,
    Created_On      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (QC_Details_ID) REFERENCES Quality_Control_Details(QC_Details_ID) ON DELETE CASCADE,
    FOREIGN KEY (Attachment_ID) REFERENCES Attachment_Master(Attachment_ID) ON DELETE CASCADE
);

-- 2. Add SLA paused columns to Complaint_Header
ALTER TABLE Complaint_Header ADD COLUMN SLA_Paused BOOLEAN DEFAULT FALSE;
ALTER TABLE Complaint_Header ADD COLUMN SLA_Pause_Reason VARCHAR(100) NULL;
ALTER TABLE Complaint_Header ADD COLUMN SLA_Paused_At DATETIME NULL;
