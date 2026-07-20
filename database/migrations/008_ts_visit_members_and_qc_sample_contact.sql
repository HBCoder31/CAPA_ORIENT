USE CCMS;

-- 1. Create Visit_Members table (idempotent)
CREATE TABLE IF NOT EXISTS Visit_Members (
    Visit_Member_ID  BIGINT PRIMARY KEY AUTO_INCREMENT,
    Complaint_ID     BIGINT NOT NULL,
    Employee_ID      BIGINT NOT NULL,
    Created_On       DATETIME DEFAULT CURRENT_TIMESTAMP,
    Created_By       BIGINT NULL,
    FOREIGN KEY (Complaint_ID) REFERENCES Complaint_Header(Complaint_ID) ON DELETE CASCADE,
    FOREIGN KEY (Employee_ID)  REFERENCES Employee_Master(Employee_ID)
);

-- 2. Add columns to Visit_Details (safe via information_schema check)
SET @dbname = DATABASE();

SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME='Visit_Details' AND COLUMN_NAME='Departure_Date');
SET @sql = IF(@col=0, 'ALTER TABLE Visit_Details ADD COLUMN Departure_Date DATETIME NULL AFTER Visit_Date', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME='Visit_Details' AND COLUMN_NAME='Return_Date');
SET @sql = IF(@col=0, 'ALTER TABLE Visit_Details ADD COLUMN Return_Date DATETIME NULL AFTER Departure_Date', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME='Visit_Details' AND COLUMN_NAME='Scheduled_At');
SET @sql = IF(@col=0, 'ALTER TABLE Visit_Details ADD COLUMN Scheduled_At DATETIME NULL AFTER Return_Date', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. Add Contact_Employee_ID to Sample_Tracking
SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME='Sample_Tracking' AND COLUMN_NAME='Contact_Employee_ID');
SET @sql = IF(@col=0, 'ALTER TABLE Sample_Tracking ADD COLUMN Contact_Employee_ID BIGINT NULL, ADD FOREIGN KEY fk_sample_contact (Contact_Employee_ID) REFERENCES Employee_Master(Employee_ID)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4. Drop obsolete columns from Technical_Service_Details (idempotent)
SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME='Technical_Service_Details' AND COLUMN_NAME='Clarification_Required');
SET @sql = IF(@col>0, 'ALTER TABLE Technical_Service_Details DROP COLUMN Clarification_Required', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME='Technical_Service_Details' AND COLUMN_NAME='Sample_Required');
SET @sql = IF(@col>0, 'ALTER TABLE Technical_Service_Details DROP COLUMN Sample_Required', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT 'Migration 008 applied successfully.' AS Status;
