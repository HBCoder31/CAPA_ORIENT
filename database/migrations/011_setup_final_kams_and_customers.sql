-- Migration: Setup custom KAM and Customer accounts
-- Date: 2026-07-20

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Create employees
DELETE FROM Employee_Master WHERE Employee_ID IN (100018, 100019, 100020, 100021);
INSERT INTO Employee_Master (Employee_ID, Employee_Code, Employee_Name, Official_Email, Department_ID, Role_ID, Employee_Status_ID, Created_On, Is_Active)
VALUES
(100018, 'EMP100018', 'Dev Brat', 'db@orientpaper.com', 6, 3, 6, NOW(), 1),
(100019, 'EMP100019', 'Siddharth Roy', 'siddharth@orientpaper.com', 6, 3, 6, NOW(), 1),
(100020, 'EMP100020', 'Komal Sharma', 'komal@orientpaper.com', 12, 3, 6, NOW(), 1),
(100021, 'EMP100021', 'Vikas Malhotra', 'vikas@orientpaper.com', 12, 3, 6, NOW(), 1);

-- 2. Create employee logins
DELETE FROM Login_Master WHERE Email IN ('db@orientpaper.com', 'siddharth@orientpaper.com', 'komal@orientpaper.com', 'vikas@orientpaper.com');
INSERT INTO Login_Master (Email, Password_Hash, Login_Type_ID, Employee_ID, Is_Active)
VALUES
('db@orientpaper.com', '$2a$10$q0F5zdEr/YUBc/Luqic5n.wF7BjW5gX35cNZPqNRCXfbWyxWAhWKy', 2, 100018, 1),
('siddharth@orientpaper.com', '$2a$10$q0F5zdEr/YUBc/Luqic5n.wF7BjW5gX35cNZPqNRCXfbWyxWAhWKy', 2, 100019, 1),
('komal@orientpaper.com', '$2a$10$q0F5zdEr/YUBc/Luqic5n.wF7BjW5gX35cNZPqNRCXfbWyxWAhWKy', 2, 100020, 1),
('vikas@orientpaper.com', '$2a$10$q0F5zdEr/YUBc/Luqic5n.wF7BjW5gX35cNZPqNRCXfbWyxWAhWKy', 2, 100021, 1);

-- 3. Map KAM IDs to these employees in KAM_Master
UPDATE KAM_Master SET Employee_ID = 100018, Is_Active = 1 WHERE KAM_ID = 1;
UPDATE KAM_Master SET Employee_ID = 100019, Is_Active = 1 WHERE KAM_ID = 2;
UPDATE KAM_Master SET Employee_ID = 100020, Is_Active = 1 WHERE KAM_ID = 3;
UPDATE KAM_Master SET Employee_ID = 100021, Is_Active = 1 WHERE KAM_ID = 4;

-- 4. Create HB Division Customer if not exists
INSERT INTO Customer_Master (Customer_ID, Customer_Name, Business_Unit_ID, KAM_ID, GSTIN, PAN_Number, Customer_Email, Customer_Phone, Billing_Address, Shipping_Address, City, State, Country, Postal_Code, Customer_Portal_Access, Customer_Status_ID, Last_SAP_Sync, Created_By, Is_Active)
SELECT 'CUST100005', 'ITC Limited (HB Division)', 1, 1, '19AAACI5950L1ZB', 'AAACI5950L', 'hb@itc.in', '9877000001', 'Virginia House, Kolkata', 'Virginia House, Kolkata', 'Kolkata', 'West Bengal', 'India', '700071', 1, 3, NOW(), 'Admin', 1
FROM (SELECT 1) AS dummy
WHERE NOT EXISTS (SELECT 1 FROM Customer_Master WHERE Customer_ID = 'CUST100005');

-- 5. Create YB Division Customer if not exists
INSERT INTO Customer_Master (Customer_ID, Customer_Name, Business_Unit_ID, KAM_ID, GSTIN, PAN_Number, Customer_Email, Customer_Phone, Billing_Address, Shipping_Address, City, State, Country, Postal_Code, Customer_Portal_Access, Customer_Status_ID, Last_SAP_Sync, Created_By, Is_Active)
SELECT 'CUST100006', 'ITC Limited (YB Division)', 1, 1, '19AAACI5950L1ZB', 'AAACI5950L', 'yb@itc.in', '9877000001', 'Virginia House, Kolkata', 'Virginia House, Kolkata', 'Kolkata', 'West Bengal', 'India', '700071', 1, 3, NOW(), 'Admin', 1
FROM (SELECT 1) AS dummy
WHERE NOT EXISTS (SELECT 1 FROM Customer_Master WHERE Customer_ID = 'CUST100006');

-- 6. Clean customer logins
DELETE FROM Login_Master WHERE Customer_ID IN ('CUST100001', 'CUST100005', 'CUST100006', 'CUST100002');
DELETE FROM Login_Master WHERE Email IN ('paper.procurement@itc.in', 'hb@itc.in', 'yb@itc.in', 'purchase@jkpaper.com');

-- 7. Insert customer logins with specific hashes
INSERT INTO Login_Master (Email, Password_Hash, Login_Type_ID, Customer_ID, Is_Active)
VALUES
('paper.procurement@itc.in', '$2a$10$q0F5zdEr/YUBc/Luqic5n.w3O3b6w7UcxMCUBMTqNPS/AjOpuJx9K', 1, 'CUST100001', 1), -- hash for customerpassword123
('hb@itc.in', '$2a$10$q0F5zdEr/YUBc/Luqic5n.sdMaM7jF4BhzYK6TYR6aNgFvxnrTf2G', 1, 'CUST100005', 1), -- hash for hb123
('yb@itc.in', '$2a$10$q0F5zdEr/YUBc/Luqic5n.dmChF/dSbeb0rt5d.Z3Q.TFVNB6jkc.', 1, 'CUST100006', 1), -- hash for yb123
('purchase@jkpaper.com', '$2a$10$q0F5zdEr/YUBc/Luqic5n.z/1lnnHkJsAmVA7kb9.s.jqIDBBAGl6', 1, 'CUST100002', 1); -- hash for jkpassword123

-- 8. Update Customer_Master legacy Password_Hash fields
UPDATE Customer_Master SET Password_Hash = '$2a$10$q0F5zdEr/YUBc/Luqic5n.w3O3b6w7UcxMCUBMTqNPS/AjOpuJx9K', Customer_Email = 'paper.procurement@itc.in' WHERE Customer_ID = 'CUST100001';
UPDATE Customer_Master SET Password_Hash = '$2a$10$q0F5zdEr/YUBc/Luqic5n.sdMaM7jF4BhzYK6TYR6aNgFvxnrTf2G', Customer_Email = 'hb@itc.in' WHERE Customer_ID = 'CUST100005';
UPDATE Customer_Master SET Password_Hash = '$2a$10$q0F5zdEr/YUBc/Luqic5n.dmChF/dSbeb0rt5d.Z3Q.TFVNB6jkc.', Customer_Email = 'yb@itc.in' WHERE Customer_ID = 'CUST100006';
UPDATE Customer_Master SET Password_Hash = '$2a$10$q0F5zdEr/YUBc/Luqic5n.z/1lnnHkJsAmVA7kb9.s.jqIDBBAGl6', Customer_Email = 'purchase@jkpaper.com' WHERE Customer_ID = 'CUST100002';

-- 9. Sync any active complaints in KAM Review stage (status 17) to match customer's new KAM Employee_ID
UPDATE Complaint_Header c
JOIN Customer_Master cust ON c.Customer_ID = cust.Customer_ID
JOIN KAM_Master k ON cust.KAM_ID = k.KAM_ID
SET c.Current_Assignee_ID = k.Employee_ID
WHERE c.Complaint_Status_ID = 17;

SET FOREIGN_KEY_CHECKS = 1;
