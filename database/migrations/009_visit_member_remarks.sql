USE CCMS;

-- Add field remarks tracking to Visit_Members
SET @dbname = DATABASE();

SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME='Visit_Members' AND COLUMN_NAME='Remarks');
SET @sql = IF(@col=0, 'ALTER TABLE Visit_Members ADD COLUMN Remarks TEXT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME='Visit_Members' AND COLUMN_NAME='Submitted_At');
SET @sql = IF(@col=0, 'ALTER TABLE Visit_Members ADD COLUMN Submitted_At DATETIME NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT 'Migration 009 applied successfully.' AS Status;
