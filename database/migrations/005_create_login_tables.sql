-- Migration: Centralize login credentials in Login_Master and introduce Login_Type_Master
-- Date: 2026-07-13

-- 1. Create Login_Type_Master
CREATE TABLE IF NOT EXISTS Login_Type_Master (
    Login_Type_ID INT PRIMARY KEY,
    Type_Name VARCHAR(50) NOT NULL UNIQUE,
    Is_Active TINYINT(1) DEFAULT 1
);

-- 2. Seed Login_Type_Master lookup data
INSERT INTO Login_Type_Master (Login_Type_ID, Type_Name, Is_Active)
VALUES 
(1, 'Customer', 1),
(2, 'Employee', 1),
(3, 'Unknown', 1),
(4, 'Admin', 1)
ON DUPLICATE KEY UPDATE Type_Name = VALUES(Type_Name);

-- 3. Create Login_Master Table
CREATE TABLE IF NOT EXISTS Login_Master (
    Login_ID INT AUTO_INCREMENT PRIMARY KEY,
    Email VARCHAR(150) NOT NULL UNIQUE,
    Password_Hash VARCHAR(255) NOT NULL,
    Login_Type_ID INT NOT NULL,
    Employee_ID BIGINT NULL,
    Customer_ID VARCHAR(20) NULL,
    Is_Active TINYINT(1) DEFAULT 1,
    Last_Login DATETIME NULL,
    Created_On DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (Login_Type_ID) REFERENCES Login_Type_Master(Login_Type_ID),
    FOREIGN KEY (Employee_ID) REFERENCES Employee_Master(Employee_ID) ON DELETE SET NULL,
    FOREIGN KEY (Customer_ID) REFERENCES Customer_Master(Customer_ID) ON DELETE SET NULL
);

-- 4. Port existing Customer Credentials (with fallback to default password123 hash)
INSERT INTO Login_Master (Email, Password_Hash, Login_Type_ID, Customer_ID, Is_Active, Last_Login)
SELECT Customer_Email, COALESCE(Password_Hash, '$2a$10$3B2fLo5NgMxvDfqnImx3oeKknhKfFX/CijGUCa.41Q1Fq.uKhzY8.'), 1, Customer_ID, Is_Active, NULL
FROM Customer_Master
WHERE Customer_Email IS NOT NULL AND Customer_Email != ''
ON DUPLICATE KEY UPDATE Password_Hash = VALUES(Password_Hash), Customer_ID = VALUES(Customer_ID);

-- 5. Port existing Employee/Admin Credentials
INSERT INTO Login_Master (Email, Password_Hash, Login_Type_ID, Employee_ID, Is_Active, Last_Login)
SELECT 
    e.Official_Email, 
    e.Password_Hash, 
    IF(r.Role_Name = 'Administrator', 4, 2) AS Login_Type_ID, 
    e.Employee_ID, 
    e.Is_Active, 
    e.Last_Login
FROM Employee_Master e
JOIN Role_Master r ON e.Role_ID = r.Role_ID
WHERE e.Password_Hash IS NOT NULL AND e.Official_Email IS NOT NULL AND e.Official_Email != ''
ON DUPLICATE KEY UPDATE Password_Hash = VALUES(Password_Hash), Employee_ID = VALUES(Employee_ID), Login_Type_ID = VALUES(Login_Type_ID);
