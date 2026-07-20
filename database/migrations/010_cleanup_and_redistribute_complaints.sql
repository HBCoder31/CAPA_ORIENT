-- ============================================================
-- Migration 010: Clean up & redistribute complaint demo data
-- Date: 2026-07-20
-- Purpose: Remove excess complaints so each workflow stage has
--          at most 1-2 complaints, and each customer has at most
--          7-8 complaints across different stages.
--          All complaints are updated to follow their respective SLAs.
-- ============================================================

-- Step 1: Delete all dependent data in correct FK order

DELETE FROM Credit_Note;
DELETE FROM Settlement_Details;
DELETE FROM CAPA_Analysis;
DELETE FROM Quality_Control_Details;
DELETE FROM Sample_Tracking;
DELETE FROM Visit_Details;
DELETE FROM Notification_Log WHERE Complaint_ID IS NOT NULL;
DELETE FROM Attachment_Master;
DELETE FROM Complaint_Workflow_Log;
DELETE FROM Complaint_Line_Item;
DELETE FROM Technical_Service_Details;
DELETE FROM Complaint_Header;

-- Reset auto-increment counters
ALTER TABLE Complaint_Header AUTO_INCREMENT = 1;
ALTER TABLE Complaint_Line_Item AUTO_INCREMENT = 1;
ALTER TABLE Complaint_Workflow_Log AUTO_INCREMENT = 1;
ALTER TABLE Technical_Service_Details AUTO_INCREMENT = 1;
ALTER TABLE Visit_Details AUTO_INCREMENT = 1;
ALTER TABLE Sample_Tracking AUTO_INCREMENT = 1;
ALTER TABLE Quality_Control_Details AUTO_INCREMENT = 1;
ALTER TABLE CAPA_Analysis AUTO_INCREMENT = 1;
ALTER TABLE Settlement_Details AUTO_INCREMENT = 1;
ALTER TABLE Credit_Note AUTO_INCREMENT = 1;
ALTER TABLE Attachment_Master AUTO_INCREMENT = 1;

-- ============================================================
-- Step 2: Re-insert clean complaints
-- Distribution plan (1-2 per workflow stage):
--  KAM Review (Submitted):          CMP1 (ITC),     CMP2 (Asian Paints)
--  Under TS Review:                 CMP3 (JK Paper), CMP4 (Berger Paints)
--  Under QC Review:                 CMP5 (West Coast), CMP6 (Kansai)
--  CAPA Pending:                    CMP7 (Century),  CMP8 (Akzo Nobel)
--  Ops Head Approval:               CMP9 (ITC),      CMP10 (Asian Paints)
--  Marketing Review:                CMP11 (JK Paper),CMP12 (Berger Paints)
--  Marketing Head Approval:         CMP13 (W.Coast), CMP14 (Kansai)
--  Finance Pending:                 CMP15 (Century), CMP16 (Akzo Nobel)
--  Closed:                          CMP17 (ITC),     CMP18 (Asian Paints)
--  Rejected:                        CMP19 (JK Paper)
-- ============================================================

INSERT INTO Complaint_Header
(Complaint_Number, Customer_ID, KAM_ID, Business_Unit_ID, Complaint_Source_ID,
 Complaint_Date, SLA_Due_Date, SLA_Breached, Complaint_Title, Complaint_Description,
 Priority_ID, Complaint_Status_ID, Current_Department_ID, Current_Assignee_ID,
 Total_Complaint_Value, Expected_Settlement_Amount, Is_Duplicate, Created_By, Is_Active)
VALUES

-- CMP1: ITC | KAM Review (Submitted) (SLA: Medium = 168 hours = 7 days)
('CMP20260001','CUST100001',
 (SELECT KAM_ID FROM Customer_Master WHERE Customer_ID='CUST100001'),
 1,
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Source' AND Lookup_Value='Customer Portal'),
 '2026-07-18 09:30:00', DATE_ADD('2026-07-18 09:30:00', INTERVAL 168 HOUR), 0,
 'Low GSM in A4 Copier Paper',
 'Customer received A4 70 GSM paper but measured values consistently below specification.',
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Priority' AND Lookup_Value='Medium'),
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Status' AND Lookup_Value='Submitted'),
 (SELECT Department_ID FROM Department_Master WHERE Department_Name='Administration' AND Business_Unit_ID=1),
 100020, 28000.00, 20000.00, FALSE, NULL, TRUE),

-- CMP2: Asian Paints | KAM Review (Submitted) (SLA: Medium = 168 hours = 7 days)
('CMP20260002','CUST200001',
 (SELECT KAM_ID FROM Customer_Master WHERE Customer_ID='CUST200001'),
 2,
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Source' AND Lookup_Value='Customer Portal'),
 '2026-07-20 11:00:00', DATE_ADD('2026-07-20 11:00:00', INTERVAL 168 HOUR), 0,
 'Chemical Concentration Deviation — Wet Strength Resin',
 'Batch shows resin concentration 12% below agreed specification, affecting paper quality.',
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Priority' AND Lookup_Value='Medium'),
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Status' AND Lookup_Value='Submitted'),
 (SELECT Department_ID FROM Department_Master WHERE Department_Name='Administration' AND Business_Unit_ID=2),
 100022, 90000.00, 75000.00, FALSE, NULL, TRUE),

-- CMP3: JK Paper | Under TS Review (SLA: Low = 336 hours = 14 days)
('CMP20260003','CUST100002',
 (SELECT KAM_ID FROM Customer_Master WHERE Customer_ID='CUST100002'),
 1,
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Source' AND Lookup_Value='KAM'),
 '2026-07-19 14:00:00', DATE_ADD('2026-07-19 14:00:00', INTERVAL 336 HOUR), 0,
 'Bursting Strength Failure — Maplitho Paper',
 'Maplitho Paper lots fail bursting strength test at 120 kPa vs the contracted 160 kPa minimum.',
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Priority' AND Lookup_Value='Low'),
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Status' AND Lookup_Value='Under TS Review'),
 (SELECT Department_ID FROM Department_Master WHERE Department_Name='Technical Services' AND Business_Unit_ID=1),
 100003, 975000.00, 700000.00, FALSE, 100020, TRUE),

-- CMP4: Berger Paints | Under TS Review (SLA: Medium = 168 hours = 7 days)
('CMP20260004','CUST200002',
 (SELECT KAM_ID FROM Customer_Master WHERE Customer_ID='CUST200002'),
 2,
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Source' AND Lookup_Value='KAM'),
 '2026-07-18 10:15:00', DATE_ADD('2026-07-18 10:15:00', INTERVAL 168 HOUR), 0,
 'Color Difference — Surface Sizing Chemical Batch',
 'Delivered batch shows off-white coloration vs approved reference; ΔE measured at 8.5 (max 3.0).',
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Priority' AND Lookup_Value='Medium'),
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Status' AND Lookup_Value='Under TS Review'),
 (SELECT Department_ID FROM Department_Master WHERE Department_Name='Technical Services' AND Business_Unit_ID=2),
 100011, 63000.00, 45000.00, FALSE, 100022, TRUE),

-- CMP5: West Coast Paper | Under QC Review (SLA: Medium = 168 hours = 7 days)
('CMP20260005','CUST100003',
 (SELECT KAM_ID FROM Customer_Master WHERE Customer_ID='CUST100003'),
 1,
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Source' AND Lookup_Value='Customer Portal'),
 '2026-07-20 12:00:00', DATE_ADD('2026-07-20 12:00:00', INTERVAL 168 HOUR), 0,
 'Moisture Content Exceeding Specification — Duplex Board',
 'Duplex Board has moisture content of 14.2% vs maximum 10%, causing warping during processing.',
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Priority' AND Lookup_Value='Medium'),
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Status' AND Lookup_Value='Under QC Review'),
 (SELECT Department_ID FROM Department_Master WHERE Department_Name='Quality Control' AND Business_Unit_ID=1),
 100005, 816000.00, 650000.00, FALSE, NULL, TRUE),

-- CMP6: Kansai Nerolac | Under QC Review (SLA: Medium = 168 hours = 7 days)
('CMP20260006','CUST200003',
 (SELECT KAM_ID FROM Customer_Master WHERE Customer_ID='CUST200003'),
 2,
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Source' AND Lookup_Value='Sales'),
 '2026-07-17 15:30:00', DATE_ADD('2026-07-17 15:30:00', INTERVAL 168 HOUR), 0,
 'AKD Wax Emulsion — Size Defect Observed',
 'AKD emulsion shows D90 particle size at 8.2 microns vs spec ≤5.0 microns, reducing sizing efficiency by 30%.',
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Priority' AND Lookup_Value='Medium'),
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Status' AND Lookup_Value='Under QC Review'),
 (SELECT Department_ID FROM Department_Master WHERE Department_Name='Quality Control' AND Business_Unit_ID=2),
 100012, 96000.00, 70000.00, FALSE, 100023, TRUE),

-- CMP7: Century Pulp | CAPA Pending (SLA: High = 72 hours = 3 days)
('CMP20260007','CUST100004',
 (SELECT KAM_ID FROM Customer_Master WHERE Customer_ID='CUST100004'),
 1,
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Source' AND Lookup_Value='Customer Portal'),
 '2026-07-19 10:00:00', DATE_ADD('2026-07-19 10:00:00', INTERVAL 72 HOUR), 0,
 'Torn / Damaged Kraft Paper Rolls — Transportation',
 '8 of 18 MT of Kraft Paper Rolls arrived unusable due to mishandling; no roll cradles used by transporter.',
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Priority' AND Lookup_Value='High'),
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Status' AND Lookup_Value='CAPA Pending'),
 (SELECT Department_ID FROM Department_Master WHERE Department_Name='Operations' AND Business_Unit_ID=1),
 100007, 990000.00, 800000.00, FALSE, NULL, TRUE),

-- CMP8: Akzo Nobel | CAPA Pending (SLA: High = 72 hours = 3 days)
('CMP20260008','CUST200004',
 (SELECT KAM_ID FROM Customer_Master WHERE Customer_ID='CUST200004'),
 2,
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Source' AND Lookup_Value='KAM'),
 '2026-07-19 11:30:00', DATE_ADD('2026-07-19 11:30:00', INTERVAL 72 HOUR), 0,
 'Retention Aid — Active Polymer Below Specification',
 'Retention Aid batch: active polymer at 4.8% vs contracted 7.0% minimum; retention efficiency down to 68%.',
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Priority' AND Lookup_Value='High'),
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Status' AND Lookup_Value='CAPA Pending'),
 (SELECT Department_ID FROM Department_Master WHERE Department_Name='Operations' AND Business_Unit_ID=2),
 100013, 104500.00, 90000.00, FALSE, 100023, TRUE),

-- CMP9: ITC | Ops Head Approval (SLA: High = 72 hours = 3 days)
('CMP20260009','CUST100001',
 (SELECT KAM_ID FROM Customer_Master WHERE Customer_ID='CUST100001'),
 1,
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Source' AND Lookup_Value='Customer Portal'),
 '2026-07-20 13:00:00', DATE_ADD('2026-07-20 13:00:00', INTERVAL 72 HOUR), 0,
 'Cup Stock Paper — Dual Defect: Low GSM and High Moisture',
 'Cup Stock Paper lot: moisture 12.1% (max 8%), GSM averaging 69.3 vs ordered 72 GSM.',
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Priority' AND Lookup_Value='High'),
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Status' AND Lookup_Value='Ops Head Approval'),
 (SELECT Department_ID FROM Department_Master WHERE Department_Name='Operations' AND Business_Unit_ID=1),
 100006, 1008000.00, 900000.00, FALSE, NULL, TRUE),

-- CMP10: Asian Paints | Ops Head Approval (SLA: Medium = 168 hours = 7 days)
('CMP20260010','CUST200001',
 (SELECT KAM_ID FROM Customer_Master WHERE Customer_ID='CUST200001'),
 2,
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Source' AND Lookup_Value='Sales'),
 '2026-07-16 14:00:00', DATE_ADD('2026-07-16 14:00:00', INTERVAL 168 HOUR), 0,
 'Optical Brightening Agent — Fluorescence 22% Below Spec',
 'OBA lot shows 22% lower fluorescence intensity than specification due to compounding error.',
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Priority' AND Lookup_Value='Medium'),
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Status' AND Lookup_Value='Ops Head Approval'),
 (SELECT Department_ID FROM Department_Master WHERE Department_Name='Operations' AND Business_Unit_ID=2),
 100006, 65000.00, 50000.00, FALSE, 100022, TRUE),

-- CMP11: JK Paper | Marketing Review (SLA: Medium = 168 hours = 7 days)
('CMP20260011','CUST100002',
 (SELECT KAM_ID FROM Customer_Master WHERE Customer_ID='CUST100002'),
 1,
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Source' AND Lookup_Value='KAM'),
 '2026-07-15 10:00:00', DATE_ADD('2026-07-15 10:00:00', INTERVAL 168 HOUR), 0,
 'Tissue Paper Jumbo Rolls — Weight Deviation',
 'Tissue Paper Jumbo Rolls show consistent 8-12% weight shortfall from ordered specifications.',
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Priority' AND Lookup_Value='Medium'),
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Status' AND Lookup_Value='Marketing Review'),
 (SELECT Department_ID FROM Department_Master WHERE Department_Name='Marketing' AND Business_Unit_ID=1),
 100009, 450000.00, 350000.00, FALSE, 100020, TRUE),

-- CMP12: Berger Paints | Marketing Review (SLA: Medium = 168 hours = 7 days)
('CMP20260012','CUST200002',
 (SELECT KAM_ID FROM Customer_Master WHERE Customer_ID='CUST200002'),
 2,
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Source' AND Lookup_Value='Customer Portal'),
 '2026-07-16 09:30:00', DATE_ADD('2026-07-16 09:30:00', INTERVAL 168 HOUR), 0,
 'Defoamer — Packaging Torn During Transit',
 '4 out of 10 Defoamer drums arrived punctured with partial spillage.',
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Priority' AND Lookup_Value='Medium'),
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Status' AND Lookup_Value='Marketing Review'),
 (SELECT Department_ID FROM Department_Master WHERE Department_Name='Marketing' AND Business_Unit_ID=2),
 100015, 32000.00, 25000.00, FALSE, NULL, TRUE),

-- CMP13: West Coast Paper | Marketing Head Approval (SLA: High = 72 hours = 3 days)
('CMP20260013','CUST100003',
 (SELECT KAM_ID FROM Customer_Master WHERE Customer_ID='CUST100003'),
 1,
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Source' AND Lookup_Value='Customer Portal'),
 '2026-07-18 08:00:00', DATE_ADD('2026-07-18 08:00:00', INTERVAL 72 HOUR), 0,
 'Poster Paper — Color Density Variation Across Lot',
 'Poster Paper batch shows 3 distinct shade zones, rendering it unusable for uniform print jobs.',
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Priority' AND Lookup_Value='High'),
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Status' AND Lookup_Value='Marketing Head Approval'),
 (SELECT Department_ID FROM Department_Master WHERE Department_Name='Marketing' AND Business_Unit_ID=1),
 100008, 464000.00, 400000.00, FALSE, NULL, TRUE),

-- CMP14: Kansai Nerolac | Marketing Head Approval (SLA: Medium = 168 hours = 7 days)
('CMP20260014','CUST200003',
 (SELECT KAM_ID FROM Customer_Master WHERE Customer_ID='CUST200003'),
 2,
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Source' AND Lookup_Value='KAM'),
 '2026-07-17 15:00:00', DATE_ADD('2026-07-17 15:00:00', INTERVAL 168 HOUR), 0,
 'Cationic Starch — Moisture Absorption Above Specification',
 'Cationic Starch moisture at 14.5% (spec max 12%) due to inadequate moisture-proof packaging.',
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Priority' AND Lookup_Value='Medium'),
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Status' AND Lookup_Value='Marketing Head Approval'),
 (SELECT Department_ID FROM Department_Master WHERE Department_Name='Marketing' AND Business_Unit_ID=2),
 100008, 76000.00, 60000.00, FALSE, 100023, TRUE),

-- CMP15: Century Pulp | Finance Pending (SLA: Medium = 168 hours = 7 days)
('CMP20260015','CUST100004',
 (SELECT KAM_ID FROM Customer_Master WHERE Customer_ID='CUST100004'),
 1,
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Source' AND Lookup_Value='Customer Portal'),
 '2026-07-16 09:00:00', DATE_ADD('2026-07-16 09:00:00', INTERVAL 168 HOUR), 0,
 'A4 Copier 80 GSM — Labelling Error and GSM Shortfall',
 'Batch supplied with incorrect labels causing inventory mismatch, plus 5 GSM shortfall in actual product.',
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Priority' AND Lookup_Value='Medium'),
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Status' AND Lookup_Value='Finance Pending'),
 (SELECT Department_ID FROM Department_Master WHERE Department_Name='Finance' AND Business_Unit_ID=1),
 100010, 864000.00, 750000.00, FALSE, NULL, TRUE),

-- CMP16: Akzo Nobel | Finance Pending (SLA: High = 72 hours = 3 days)
('CMP20260016','CUST200004',
 (SELECT KAM_ID FROM Customer_Master WHERE Customer_ID='CUST200004'),
 2,
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Source' AND Lookup_Value='Sales'),
 '2026-07-18 10:00:00', DATE_ADD('2026-07-18 10:00:00', INTERVAL 72 HOUR), 0,
 'Surface Sizing Chemical — Solids Content Below Contract',
 'Solids content at 12.5% vs contracted 15%, requiring 20% extra dosage and increased production costs.',
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Priority' AND Lookup_Value='High'),
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Status' AND Lookup_Value='Finance Pending'),
 (SELECT Department_ID FROM Department_Master WHERE Department_Name='Finance' AND Business_Unit_ID=2),
 100016, 94500.00, 80000.00, FALSE, 100023, TRUE),

-- CMP17: ITC | Closed (SLA: Medium = 168 hours = 7 days)
('CMP20260017','CUST100001',
 (SELECT KAM_ID FROM Customer_Master WHERE Customer_ID='CUST100001'),
 1,
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Source' AND Lookup_Value='Customer Portal'),
 '2026-05-20 09:00:00', DATE_ADD('2026-05-20 09:00:00', INTERVAL 168 HOUR), 0,
 'Maplitho Paper — Color Streak Defect Resolved',
 'Color streaking defect in Maplitho batch attributed to coating blade contamination. Fully resolved.',
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Priority' AND Lookup_Value='Medium'),
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Status' AND Lookup_Value='Closed'),
 (SELECT Department_ID FROM Department_Master WHERE Department_Name='Finance' AND Business_Unit_ID=1),
 100010, 48000.00, 40000.00, FALSE, NULL, TRUE),

-- CMP18: Asian Paints | Closed (SLA: Low = 336 hours = 14 days)
('CMP20260018','CUST200001',
 (SELECT KAM_ID FROM Customer_Master WHERE Customer_ID='CUST200001'),
 2,
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Source' AND Lookup_Value='KAM'),
 '2026-05-22 14:00:00', DATE_ADD('2026-05-22 14:00:00', INTERVAL 336 HOUR), 0,
 'Defoamer — Performance Below Specification (Resolved)',
 'Defoamer required 40% higher dosage. Root cause identified and corrected. Settlement completed.',
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Priority' AND Lookup_Value='Low'),
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Status' AND Lookup_Value='Closed'),
 (SELECT Department_ID FROM Department_Master WHERE Department_Name='Finance' AND Business_Unit_ID=2),
 100016, 32000.00, 25000.00, FALSE, 100022, TRUE),

-- CMP19: JK Paper | Rejected (SLA: Low = 336 hours = 14 days)
('CMP20260019','CUST100002',
 (SELECT KAM_ID FROM Customer_Master WHERE Customer_ID='CUST100002'),
 1,
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Source' AND Lookup_Value='Customer Portal'),
 '2026-06-18 13:00:00', DATE_ADD('2026-06-18 13:00:00', INTERVAL 336 HOUR), 0,
 'Kraft Paper — Claimed Size Defect (Not Substantiated)',
 'Customer claimed size defect. TS investigation found all dimensions within ±2mm contract tolerance.',
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Priority' AND Lookup_Value='Low'),
 (SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Status' AND Lookup_Value='Rejected'),
 (SELECT Department_ID FROM Department_Master WHERE Department_Name='Technical Services' AND Business_Unit_ID=1),
 100002, 55000.00, 0.00, FALSE, 100020, TRUE);

-- Update closure dates
UPDATE Complaint_Header SET Closure_Date='2026-06-15 16:00:00', Closure_Remarks='Credit note issued and posted. Settlement fully processed.' WHERE Complaint_Number='CMP20260017';
UPDATE Complaint_Header SET Closure_Date='2026-06-18 10:00:00', Closure_Remarks='SAP credit note confirmed. Customer satisfied.' WHERE Complaint_Number='CMP20260018';

-- ============================================================
-- Step 3: Complaint Line Items
-- ============================================================

INSERT INTO Complaint_Line_Item (Complaint_ID, Invoice_No, Line_Item, Defective_Quantity, Complaint_Category_ID, Defect_Nature_ID, Complaint_Value, Customer_Remarks, Created_By)
VALUES
(1,'INV100001',1,20.000,(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Category' AND Lookup_Value='Quality'),(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Defect_Nature' AND Lookup_Value='Low GSM'),5600.00,'Measured 66 GSM vs ordered 70 GSM.',100014),
(2,'INV100005',1,100.000,(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Category' AND Lookup_Value='Quality'),(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Defect_Nature' AND Lookup_Value='Chemical Concentration'),18000.00,'Active resin concentration 12% below spec.',100014),
(3,'INV100002',1,5.000,(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Category' AND Lookup_Value='Quality'),(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Defect_Nature' AND Lookup_Value='Bursting Strength Failure'),325000.00,'Paper fails bursting test. 120 kPa vs 160 kPa minimum.',100014),
(4,'INV100006',2,100.000,(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Category' AND Lookup_Value='Quality'),(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Defect_Nature' AND Lookup_Value='Color Difference'),26000.00,'Off-white coloration. ΔE=8.5 vs max 3.0.',100014),
(5,'INV100003',1,4.000,(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Category' AND Lookup_Value='Quality'),(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Defect_Nature' AND Lookup_Value='Moisture'),272000.00,'Moisture 14.2% exceeds 10% limit.',100014),
(6,'INV100007',1,100.000,(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Category' AND Lookup_Value='Quality'),(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Defect_Nature' AND Lookup_Value='Size Defect'),24000.00,'D90 8.2 microns vs spec 5.0 max.',100014),
(7,'INV100004',1,8.000,(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Category' AND Lookup_Value='Packaging'),(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Defect_Nature' AND Lookup_Value='Torn / Damaged'),440000.00,'8 MT crushed — no roll cradles used.',100014),
(8,'INV100008',2,200.000,(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Category' AND Lookup_Value='Quality'),(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Defect_Nature' AND Lookup_Value='Chemical Concentration'),38000.00,'Active polymer 4.8% vs 7.0% contracted.',100014),
(9,'INV100009',3,5.000,(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Category' AND Lookup_Value='Quality'),(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Defect_Nature' AND Lookup_Value='Low GSM'),360000.00,'Both moisture and GSM non-conforming.',100014),
(10,'INV100005',2,50.000,(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Category' AND Lookup_Value='Quality'),(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Defect_Nature' AND Lookup_Value='Color Difference'),13000.00,'OBA fluorescence 22% below specification.',100014),
(11,'INV100003',2,6.000,(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Category' AND Lookup_Value='Quality'),(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Defect_Nature' AND Lookup_Value='Low GSM'),108000.00,'Roll weight 10% below ordered specification.',100014),
(12,'INV100010',1,140.000,(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Category' AND Lookup_Value='Packaging'),(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Defect_Nature' AND Lookup_Value='Torn / Damaged'),22400.00,'4 drums punctured. Spillage occurred.',100014),
(13,'INV100002',3,4.000,(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Category' AND Lookup_Value='Quality'),(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Defect_Nature' AND Lookup_Value='Color Difference'),232000.00,'3 distinct shade zones across batch.',100014),
(14,'INV100007',2,180.000,(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Category' AND Lookup_Value='Quality'),(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Defect_Nature' AND Lookup_Value='Moisture'),32400.00,'Starch moisture 14.5% vs spec max 12%.',100014),
(15,'INV100004',2,6.000,(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Category' AND Lookup_Value='Packaging'),(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Defect_Nature' AND Lookup_Value='Others'),432000.00,'Wrong label batch causing inventory mismatch.',100014),
(16,'INV100008',1,150.000,(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Category' AND Lookup_Value='Quality'),(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Defect_Nature' AND Lookup_Value='Chemical Concentration'),31500.00,'Solids 12.5% vs 15% — extra dosage required.',100014),
(17,'INV100001',2,30.000,(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Category' AND Lookup_Value='Quality'),(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Defect_Nature' AND Lookup_Value='Color Difference'),9600.00,'Color streak across 30 REAM. Blade contamination.',100014),
(18,'INV100005',3,100.000,(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Category' AND Lookup_Value='Quality'),(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Defect_Nature' AND Lookup_Value='Chemical Concentration'),16000.00,'Dosage 40% over required. Performance below guarantee.',100014),
(19,'INV100004',3,2.000,(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Complaint_Category' AND Lookup_Value='Others'),(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Defect_Nature' AND Lookup_Value='Size Defect'),130000.00,'All dimensions within ±2mm tolerance.',100014);

-- ============================================================
-- Step 4: Workflow Logs
-- ============================================================

INSERT INTO Complaint_Workflow_Log (Complaint_ID, Workflow_ID, Action_By, Action_Date, Action_Type_ID, Previous_Department_ID, Current_Department_ID, Remarks, Created_On)
VALUES
-- CMP1 submitted
(1,(SELECT Workflow_ID FROM Workflow_Configuration WHERE Business_Unit_ID=1 AND Stage_Number=1),100020,'2026-07-18 09:35:00',(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Workflow_Action' AND Lookup_Value='Submitted'),NULL,(SELECT Department_ID FROM Department_Master WHERE Department_Name='Administration' AND Business_Unit_ID=1),'Complaint submitted via customer portal. Awaiting KAM verification.','2026-07-18 09:35:00'),
-- CMP2 submitted
(2,(SELECT Workflow_ID FROM Workflow_Configuration WHERE Business_Unit_ID=2 AND Stage_Number=1),100022,'2026-07-20 11:05:00',(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Workflow_Action' AND Lookup_Value='Submitted'),NULL,(SELECT Department_ID FROM Department_Master WHERE Department_Name='Administration' AND Business_Unit_ID=2),'Complaint submitted via customer portal. Awaiting KAM verification.','2026-07-20 11:05:00'),
-- CMP3 submitted then to TS
(3,(SELECT Workflow_ID FROM Workflow_Configuration WHERE Business_Unit_ID=1 AND Stage_Number=1),100020,'2026-07-19 14:05:00',(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Workflow_Action' AND Lookup_Value='Submitted'),NULL,(SELECT Department_ID FROM Department_Master WHERE Department_Name='Technical Services' AND Business_Unit_ID=1),'KAM verified and forwarded to Technical Services.','2026-07-19 14:05:00'),
(3,(SELECT Workflow_ID FROM Workflow_Configuration WHERE Business_Unit_ID=1 AND Stage_Number=1),100020,'2026-07-19 16:00:00',(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Workflow_Action' AND Lookup_Value='Forwarded'),(SELECT Department_ID FROM Department_Master WHERE Department_Name='Technical Services' AND Business_Unit_ID=1),(SELECT Department_ID FROM Department_Master WHERE Department_Name='Technical Services' AND Business_Unit_ID=1),'Assigned to TS Engineer: Neha Verma for site investigation.','2026-07-19 16:00:00'),
-- CMP4 submitted then to TS
(4,(SELECT Workflow_ID FROM Workflow_Configuration WHERE Business_Unit_ID=2 AND Stage_Number=1),100022,'2026-07-18 10:20:00',(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Workflow_Action' AND Lookup_Value='Submitted'),NULL,(SELECT Department_ID FROM Department_Master WHERE Department_Name='Technical Services' AND Business_Unit_ID=2),'KAM verified and forwarded to Technical Services.','2026-07-18 10:20:00'),
(4,(SELECT Workflow_ID FROM Workflow_Configuration WHERE Business_Unit_ID=2 AND Stage_Number=1),100022,'2026-07-18 12:00:00',(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Workflow_Action' AND Lookup_Value='Forwarded'),(SELECT Department_ID FROM Department_Master WHERE Department_Name='Technical Services' AND Business_Unit_ID=2),(SELECT Department_ID FROM Department_Master WHERE Department_Name='Technical Services' AND Business_Unit_ID=2),'Assigned to TS Engineer: Sandeep Nair for chemical analysis.','2026-07-18 12:00:00'),
-- CMP5 to QC
(5,(SELECT Workflow_ID FROM Workflow_Configuration WHERE Business_Unit_ID=1 AND Stage_Number=1),100021,'2026-07-20 12:05:00',(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Workflow_Action' AND Lookup_Value='Submitted'),NULL,(SELECT Department_ID FROM Department_Master WHERE Department_Name='Technical Services' AND Business_Unit_ID=1),'Complaint submitted.','2026-07-20 12:05:00'),
(5,(SELECT Workflow_ID FROM Workflow_Configuration WHERE Business_Unit_ID=1 AND Stage_Number=2),100003,'2026-07-20 14:00:00',(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Workflow_Action' AND Lookup_Value='Forwarded'),(SELECT Department_ID FROM Department_Master WHERE Department_Name='Technical Services' AND Business_Unit_ID=1),(SELECT Department_ID FROM Department_Master WHERE Department_Name='Quality Control' AND Business_Unit_ID=1),'TS completed site inspection. Samples forwarded to QC: Pooja Singh for laboratory moisture verification.','2026-07-20 14:00:00'),
-- CMP6 to QC
(6,(SELECT Workflow_ID FROM Workflow_Configuration WHERE Business_Unit_ID=2 AND Stage_Number=1),100023,'2026-07-17 15:35:00',(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Workflow_Action' AND Lookup_Value='Submitted'),NULL,(SELECT Department_ID FROM Department_Master WHERE Department_Name='Technical Services' AND Business_Unit_ID=2),'Complaint forwarded from Sales channel.','2026-07-17 15:35:00'),
(6,(SELECT Workflow_ID FROM Workflow_Configuration WHERE Business_Unit_ID=2 AND Stage_Number=2),100011,'2026-07-17 17:00:00',(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Workflow_Action' AND Lookup_Value='Forwarded'),(SELECT Department_ID FROM Department_Master WHERE Department_Name='Technical Services' AND Business_Unit_ID=2),(SELECT Department_ID FROM Department_Master WHERE Department_Name='Quality Control' AND Business_Unit_ID=2),'TS confirmed particle size out of spec. Forwarding to QC: Meenal Joshi.','2026-07-17 17:00:00'),
-- CMP7 to CAPA
(7,(SELECT Workflow_ID FROM Workflow_Configuration WHERE Business_Unit_ID=1 AND Stage_Number=1),100021,'2026-07-19 10:05:00',(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Workflow_Action' AND Lookup_Value='Submitted'),NULL,(SELECT Department_ID FROM Department_Master WHERE Department_Name='Technical Services' AND Business_Unit_ID=1),'Complaint submitted via customer portal.','2026-07-19 10:05:00'),
(7,(SELECT Workflow_ID FROM Workflow_Configuration WHERE Business_Unit_ID=1 AND Stage_Number=2),100003,'2026-07-19 16:00:00',(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Workflow_Action' AND Lookup_Value='Forwarded'),(SELECT Department_ID FROM Department_Master WHERE Department_Name='Technical Services' AND Business_Unit_ID=1),(SELECT Department_ID FROM Department_Master WHERE Department_Name='Quality Control' AND Business_Unit_ID=1),'TS confirmed transport damage. Forwarding to QC.','2026-07-19 16:00:00'),
(7,(SELECT Workflow_ID FROM Workflow_Configuration WHERE Business_Unit_ID=1 AND Stage_Number=3),100005,'2026-07-20 14:00:00',(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Workflow_Action' AND Lookup_Value='Forwarded'),(SELECT Department_ID FROM Department_Master WHERE Department_Name='Quality Control' AND Business_Unit_ID=1),(SELECT Department_ID FROM Department_Master WHERE Department_Name='Operations' AND Business_Unit_ID=1),'QC validated damage. CAPA required. Forwarded to Ops Engineer: Karan Patel.','2026-07-20 14:00:00'),
-- CMP8 to CAPA
(8,(SELECT Workflow_ID FROM Workflow_Configuration WHERE Business_Unit_ID=2 AND Stage_Number=1),100023,'2026-07-19 11:35:00',(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Workflow_Action' AND Lookup_Value='Submitted'),NULL,(SELECT Department_ID FROM Department_Master WHERE Department_Name='Technical Services' AND Business_Unit_ID=2),'Complaint raised via KAM.','2026-07-19 11:35:00'),
(8,(SELECT Workflow_ID FROM Workflow_Configuration WHERE Business_Unit_ID=2 AND Stage_Number=2),100011,'2026-07-19 13:00:00',(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Workflow_Action' AND Lookup_Value='Forwarded'),(SELECT Department_ID FROM Department_Master WHERE Department_Name='Technical Services' AND Business_Unit_ID=2),(SELECT Department_ID FROM Department_Master WHERE Department_Name='Quality Control' AND Business_Unit_ID=2),'TS confirmed concentration deficiency. Forwarding to QC: Meenal Joshi.','2026-07-19 13:00:00'),
(8,(SELECT Workflow_ID FROM Workflow_Configuration WHERE Business_Unit_ID=2 AND Stage_Number=3),100012,'2026-07-20 11:00:00',(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Workflow_Action' AND Lookup_Value='Forwarded'),(SELECT Department_ID FROM Department_Master WHERE Department_Name='Quality Control' AND Business_Unit_ID=2),(SELECT Department_ID FROM Department_Master WHERE Department_Name='Operations' AND Business_Unit_ID=2),'QC confirmed non-conformance. CAPA required. Forwarded to Ops: Arjun Rao.','2026-07-20 11:00:00'),
-- CMP9 to Ops Head Approval
(9,(SELECT Workflow_ID FROM Workflow_Configuration WHERE Business_Unit_ID=1 AND Stage_Number=1),100020,'2026-07-20 09:05:00',(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Workflow_Action' AND Lookup_Value='Submitted'),NULL,(SELECT Department_ID FROM Department_Master WHERE Department_Name='Technical Services' AND Business_Unit_ID=1),'Complaint submitted.','2026-07-20 09:05:00'),
(9,(SELECT Workflow_ID FROM Workflow_Configuration WHERE Business_Unit_ID=1 AND Stage_Number=4),100007,'2026-07-20 13:00:00',(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Workflow_Action' AND Lookup_Value='Forwarded'),(SELECT Department_ID FROM Department_Master WHERE Department_Name='Operations' AND Business_Unit_ID=1),(SELECT Department_ID FROM Department_Master WHERE Department_Name='Operations' AND Business_Unit_ID=1),'CAPA completed by Karan Patel. Awaiting Ops Head: Vikram Mehta approval.','2026-07-20 13:00:00'),
-- CMP10 to Ops Head Approval
(10,(SELECT Workflow_ID FROM Workflow_Configuration WHERE Business_Unit_ID=2 AND Stage_Number=1),100022,'2026-07-16 14:05:00',(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Workflow_Action' AND Lookup_Value='Submitted'),NULL,(SELECT Department_ID FROM Department_Master WHERE Department_Name='Technical Services' AND Business_Unit_ID=2),'Complaint raised via Sales.','2026-07-16 14:05:00'),
(10,(SELECT Workflow_ID FROM Workflow_Configuration WHERE Business_Unit_ID=2 AND Stage_Number=4),100013,'2026-07-17 15:00:00',(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Workflow_Action' AND Lookup_Value='Forwarded'),(SELECT Department_ID FROM Department_Master WHERE Department_Name='Operations' AND Business_Unit_ID=2),(SELECT Department_ID FROM Department_Master WHERE Department_Name='Operations' AND Business_Unit_ID=2),'CAPA completed. Forwarded to Ops Head for approval.','2026-07-17 15:00:00'),
-- CMP11 to Marketing Review
(11,(SELECT Workflow_ID FROM Workflow_Configuration WHERE Business_Unit_ID=1 AND Stage_Number=5),100006,'2026-07-16 10:00:00',(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Workflow_Action' AND Lookup_Value='Forwarded'),(SELECT Department_ID FROM Department_Master WHERE Department_Name='Operations' AND Business_Unit_ID=1),(SELECT Department_ID FROM Department_Master WHERE Department_Name='Marketing' AND Business_Unit_ID=1),'Ops Head approved CAPA. Settlement forwarded to Marketing Exec: Rohit Malhotra.','2026-07-16 10:00:00'),
-- CMP12 to Marketing Review
(12,(SELECT Workflow_ID FROM Workflow_Configuration WHERE Business_Unit_ID=2 AND Stage_Number=5),100006,'2026-07-17 09:00:00',(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Workflow_Action' AND Lookup_Value='Forwarded'),(SELECT Department_ID FROM Department_Master WHERE Department_Name='Operations' AND Business_Unit_ID=2),(SELECT Department_ID FROM Department_Master WHERE Department_Name='Marketing' AND Business_Unit_ID=2),'Ops approved. Settlement forwarded to Marketing Exec: Ritika Mehra.','2026-07-17 09:00:00'),
-- CMP13 to Marketing Head Approval
(13,(SELECT Workflow_ID FROM Workflow_Configuration WHERE Business_Unit_ID=1 AND Stage_Number=6),100009,'2026-07-18 11:00:00',(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Workflow_Action' AND Lookup_Value='Forwarded'),(SELECT Department_ID FROM Department_Master WHERE Department_Name='Marketing' AND Business_Unit_ID=1),(SELECT Department_ID FROM Department_Master WHERE Department_Name='Marketing' AND Business_Unit_ID=1),'Marketing Exec reviewed. Escalated to Marketing Head: Anjali Kapoor.','2026-07-18 11:00:00'),
-- CMP14 to Marketing Head Approval
(14,(SELECT Workflow_ID FROM Workflow_Configuration WHERE Business_Unit_ID=2 AND Stage_Number=6),100015,'2026-07-18 12:00:00',(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Workflow_Action' AND Lookup_Value='Forwarded'),(SELECT Department_ID FROM Department_Master WHERE Department_Name='Marketing' AND Business_Unit_ID=2),(SELECT Department_ID FROM Department_Master WHERE Department_Name='Marketing' AND Business_Unit_ID=2),'Settlement escalated to Marketing Head for final approval.','2026-07-18 12:00:00'),
-- CMP15 to Finance
(15,(SELECT Workflow_ID FROM Workflow_Configuration WHERE Business_Unit_ID=1 AND Stage_Number=8),100008,'2026-07-17 09:00:00',(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Workflow_Action' AND Lookup_Value='Approved'),(SELECT Department_ID FROM Department_Master WHERE Department_Name='Marketing' AND Business_Unit_ID=1),(SELECT Department_ID FROM Department_Master WHERE Department_Name='Finance' AND Business_Unit_ID=1),'Marketing Head approved ₹750,000 settlement. Forwarded to Finance Exec: Deepak Sinha for credit note.','2026-07-17 09:00:00'),
-- CMP16 to Finance
(16,(SELECT Workflow_ID FROM Workflow_Configuration WHERE Business_Unit_ID=2 AND Stage_Number=8),100008,'2026-07-19 10:00:00',(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Workflow_Action' AND Lookup_Value='Approved'),(SELECT Department_ID FROM Department_Master WHERE Department_Name='Marketing' AND Business_Unit_ID=2),(SELECT Department_ID FROM Department_Master WHERE Department_Name='Finance' AND Business_Unit_ID=2),'Marketing Head approved settlement. Finance Exec: Nitin Khanna to process credit note.','2026-07-19 10:00:00'),
-- CMP17 closed
(17,(SELECT Workflow_ID FROM Workflow_Configuration WHERE Business_Unit_ID=1 AND Stage_Number=8),100010,'2026-06-15 16:00:00',(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Workflow_Action' AND Lookup_Value='Closed'),(SELECT Department_ID FROM Department_Master WHERE Department_Name='Finance' AND Business_Unit_ID=1),(SELECT Department_ID FROM Department_Master WHERE Department_Name='Finance' AND Business_Unit_ID=1),'Credit note CN20260017 issued and posted to SAP. Complaint closed.','2026-06-15 16:00:00'),
-- CMP18 closed
(18,(SELECT Workflow_ID FROM Workflow_Configuration WHERE Business_Unit_ID=2 AND Stage_Number=8),100016,'2026-06-18 10:00:00',(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Workflow_Action' AND Lookup_Value='Closed'),(SELECT Department_ID FROM Department_Master WHERE Department_Name='Finance' AND Business_Unit_ID=2),(SELECT Department_ID FROM Department_Master WHERE Department_Name='Finance' AND Business_Unit_ID=2),'Compensation CN20260018 posted to SAP. Complaint closed.','2026-06-18 10:00:00'),
-- CMP19 rejected
(19,(SELECT Workflow_ID FROM Workflow_Configuration WHERE Business_Unit_ID=1 AND Stage_Number=1),100020,'2026-06-18 13:05:00',(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Workflow_Action' AND Lookup_Value='Submitted'),NULL,(SELECT Department_ID FROM Department_Master WHERE Department_Name='Technical Services' AND Business_Unit_ID=1),'Complaint submitted via customer portal.','2026-06-18 13:05:00'),
(19,(SELECT Workflow_ID FROM Workflow_Configuration WHERE Business_Unit_ID=1 AND Stage_Number=1),100020,'2026-06-19 10:00:00',(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Workflow_Action' AND Lookup_Value='Rejected'),(SELECT Department_ID FROM Department_Master WHERE Department_Name='Technical Services' AND Business_Unit_ID=1),(SELECT Department_ID FROM Department_Master WHERE Department_Name='Technical Services' AND Business_Unit_ID=1),'TS investigation: all Kraft dimensions within ±2mm tolerance. Complaint not substantiated. Rejected.','2026-06-19 10:00:00');

-- ============================================================
-- Step 5: Technical Service Details
-- ============================================================

INSERT INTO Technical_Service_Details (Complaint_ID, Assigned_Engineer_ID, Investigation_Date, Technical_Observation, Visit_Required, Recommended_Action, Can_Close_Complaint, Remarks, Created_By)
VALUES
(3,100003,'2026-07-19 18:00:00','Lab test: bursting strength 118-123 kPa across 5 samples. All below 160 kPa minimum.',FALSE,'Proceed to full QC laboratory testing on representative lot samples.',FALSE,'Investigation confirmed complaint validity.',100003),
(4,100011,'2026-07-18 14:00:00','Color spectroscopy: ΔE of 8.5 vs reference (max acceptable 3.0). Off-white confirmed.',FALSE,'Send samples for QC color analysis and chemical composition check.',FALSE,'Color deviation beyond acceptable limits. QC required.',100011),
(5,100003,'2026-07-20 11:00:00','On-site: moisture 14.1-14.3% across 6 board stacks. Max spec 10%.',FALSE,'QC to validate and issue non-conformance certificate.',FALSE,'Site inspection complete. Moisture validated.',100003),
(6,100011,'2026-07-17 18:00:00','Particle size D90 at 8.2 microns vs spec ≤5.0 microns. Sizing efficiency 67% of baseline.',FALSE,'QC to run full particle analysis and confirm efficiency.',FALSE,'Clearly out of spec. QC required.',100011),
(7,100003,'2026-07-19 16:00:00','Physical inspection: 8 of 18 MT severely damaged. Outer layers torn, cores crushed. Transportation origin confirmed.',FALSE,'QC to document damage. Ops to initiate transport CAPA.',FALSE,'Physical damage confirmed. Not a manufacturing defect.',100003),
(8,100011,'2026-07-19 15:00:00','Lab: active polymer at 4.8% vs contracted 7.0%. Retention efficiency at 68% of baseline.',FALSE,'Operations to investigate production records and initiate CAPA.',FALSE,'Chemical concentration deficiency confirmed. CAPA required.',100011),
(9,100003,'2026-07-20 14:00:00','GSM: 69.3 average (vs 72 ordered). Moisture: 12.1% (vs 8% max). Both parameters out of spec.',FALSE,'CAPA for production calibration drift. Settlement required.',FALSE,'Dual non-conformance. Priority escalation.',100003),
(10,100011,'2026-07-17 11:00:00','Fluorescence intensity 78% of specification across 3 test points.',FALSE,'OBA batch review and dosage recalculation. Partial settlement proposed.',FALSE,'Performance deficiency confirmed.',100011),
(17,100003,'2026-05-21 09:00:00','Color streak defect confirmed. 30 of 150 REAM affected. Coating blade contamination.',FALSE,'CAPA, QC, and settlement already completed.',TRUE,'Closed complaint record.',100003),
(19,100003,'2026-06-19 09:00:00','Dimensional measurement: width 1198-1202mm vs ordered 1200mm. Within ±2mm contract tolerance.',FALSE,'Complaint not substantiated. Recommend rejection.',FALSE,'All dimensions within specification.',100003);

-- ============================================================
-- Step 6: QC Details
-- ============================================================

INSERT INTO Quality_Control_Details (Complaint_ID, QC_Engineer_ID, Inspection_Date, Sample_Verified, QC_Observation, QC_Recommendation, Remarks, Created_By)
VALUES
(5,100005,'2026-07-20 13:00:00',TRUE,'Lab moisture: 14.2% confirmed across 6 samples. Non-conformance verified.','Initiate CAPA for storage conditions. Process settlement for 4 MT.','QC inspection complete. Report issued.',100005),
(6,100012,'2026-07-17 14:00:00',TRUE,'Full particle size analysis confirmed D90 at 8.1 microns. Sizing performance 65.8% baseline.','Reject batch. Recommend partial compensation settlement.','Non-conformance certificate issued.',100012),
(7,100005,'2026-07-19 11:00:00',TRUE,'Physical damage: 8.2 MT confirmed unusable. Transport documentation obtained.','CAPA for freight handling protocols. Settlement ₹440,000 recommended.','QC report validated transport damage.',100005),
(8,100012,'2026-07-19 09:00:00',TRUE,'Chemical assay: active polymer 4.79% ±0.1%. Batch-wide non-conformance confirmed.','Full CAPA for production batch control. Settlement ₹38,000 recommended.','Batch rejected. QC report finalized.',100012),
(9,100005,'2026-07-20 10:00:00',TRUE,'GSM 69.2 avg, moisture 12.0% across 10 samples. Both non-conformances validated.','CAPA completed. Settlement ₹900,000 approved.','Dual non-conformance confirmed.',100005),
(17,100005,'2026-05-23 10:00:00',TRUE,'Color streak confirmed. 30 REAM affected. Blade contamination identified.','CAPA implemented. Settlement ₹40,000 approved.','Historical closed record.',100005);

-- ============================================================
-- Step 7: CAPA Analysis
-- ============================================================

INSERT INTO CAPA_Analysis (Complaint_ID, Root_Cause_Analysis, Corrective_Action, Preventive_Action, Responsible_Employee_ID, Target_Completion_Date, Completion_Date, Effectiveness_Verified, Approved_By, Approval_Date, Remarks, Created_By)
VALUES
(7,'Transporter failed to use roll cradles causing lateral rolling and crushing during transit.','Recalled batch. New delivery with proper roll protection fixtures.','Mandatory roll cradles for all Kraft shipments. Revised freight SOPs issued.',100007,'2026-07-28',NULL,FALSE,NULL,NULL,'CAPA plan submitted. Awaiting Ops Head approval.',100007),
(8,'Production dosing system calibration error caused systematic under-dosing of active polymer.','Dosing system recalibrated. Affected batch destroyed. Replacement dispatched.','Daily dosing calibration checks. Automated out-of-range alarm during mixing.',100013,'2026-07-27',NULL,FALSE,NULL,NULL,'CAPA submitted. Awaiting Ops Head sign-off.',100013),
(9,'Paper machine calibration drift over 3-day run caused GSM reduction. Warehouse humidity spike caused moisture absorption.','Machine recalibrated. Humidity-controlled storage activated.','Weekly GSM calibration checks. Continuous humidity monitoring in Cup Stock storage.',100007,'2026-07-25','2026-07-20',TRUE,100006,'2026-07-20 14:00:00','CAPA implemented and verified effective.',100007),
(10,'OBA batch diluted during compounding due to incorrect water ratio. Quality check bypassed during shift change.','Recalled batch. Replacement prepared with enhanced supervision.','Automated concentration sensor. Shift handover quality gate.',100013,'2026-07-24','2026-07-20',TRUE,100006,'2026-07-20 15:00:00','CAPA complete. Ops Head approved.',100013),
(17,'Coating blade developed microchip causing inconsistent coating and color streaking.','Blade replaced immediately. Affected REAM credited.','Daily blade inspection and monthly replacement schedule.',100007,'2026-06-01','2026-05-31',TRUE,100006,'2026-06-01 14:00:00','Verified effective. No recurrence in subsequent lots.',100007);

-- ============================================================
-- Step 8: Settlement Details
-- ============================================================

INSERT INTO Settlement_Details (Complaint_ID, Settlement_Type_ID, Proposed_Amount, Approved_Amount, Approval_Status_ID, Approved_By, Approval_Date, Commercial_Remarks, Created_By)
VALUES
(9,(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Settlement_Type' AND Lookup_Value='Compensation'),900000.00,900000.00,(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Settlement_Status' AND Lookup_Value='Approved'),100008,'2026-07-20 14:00:00','Marketing Head approved full settlement for dual non-conformance.',100010),
(13,(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Settlement_Type' AND Lookup_Value='Credit Note'),400000.00,NULL,(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Settlement_Status' AND Lookup_Value='Pending'),NULL,NULL,'Pending Marketing Head approval.',100010),
(14,(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Settlement_Type' AND Lookup_Value='Replacement'),60000.00,NULL,(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Settlement_Status' AND Lookup_Value='Pending'),NULL,NULL,'Replacement proposed. Awaiting Marketing Head sign-off.',100010),
(15,(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Settlement_Type' AND Lookup_Value='Credit Note'),750000.00,750000.00,(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Settlement_Status' AND Lookup_Value='Approved'),100008,'2026-07-17 10:00:00','Marketing Head approved. Finance to process credit note.',100010),
(16,(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Settlement_Type' AND Lookup_Value='Compensation'),80000.00,80000.00,(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Settlement_Status' AND Lookup_Value='Approved'),100008,'2026-07-19 11:00:00','Marketing Head approved compensation.',100010),
(17,(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Settlement_Type' AND Lookup_Value='Credit Note'),40000.00,40000.00,(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Settlement_Status' AND Lookup_Value='Approved'),100008,'2026-06-13 09:00:00','Settlement approved. Credit note issued.',100010),
(18,(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Settlement_Type' AND Lookup_Value='Compensation'),25000.00,25000.00,(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Settlement_Status' AND Lookup_Value='Approved'),100008,'2026-06-16 10:00:00','Partial compensation approved for excess dosage costs.',100010);

-- ============================================================
-- Step 9: Credit Notes
-- ============================================================

INSERT INTO Credit_Note (Complaint_ID, Settlement_ID, Credit_Note_Number, Credit_Note_Date, Credit_Note_Amount, SAP_Fiscal_Year, SAP_Company_Code, SAP_Sync_Status_ID, SAP_Response_Message, Created_By)
VALUES
(15,(SELECT Settlement_ID FROM Settlement_Details WHERE Complaint_ID=15),'CN20260015','2026-07-19',750000.00,'2026','1000',(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='SAP_Sync_Status' AND Lookup_Value='Pending'),'Awaiting SAP posting by Finance Executive.',100010),
(17,(SELECT Settlement_ID FROM Settlement_Details WHERE Complaint_ID=17),'CN20260017','2026-06-14',40000.00,'2026','1000',(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='SAP_Sync_Status' AND Lookup_Value='Posted'),'Credit note successfully posted to SAP.',100010),
(18,(SELECT Settlement_ID FROM Settlement_Details WHERE Complaint_ID=18),'CN20260018','2026-06-17',25000.00,'2026','1000',(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='SAP_Sync_Status' AND Lookup_Value='Posted'),'Compensation credit note posted to SAP.',100010);

-- ============================================================
-- Step 10: Sample Tracking
-- ============================================================

INSERT INTO Sample_Tracking (Complaint_ID, Sample_Request_Date, Sample_Dispatched_Date, Sample_Received_Date, Sample_Status_ID, Courier_Details, Received_By, Sample_Condition, Remarks, Created_By)
VALUES
(5,'2026-07-20 12:30:00','2026-07-20 13:00:00','2026-07-20 13:30:00',(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Sample_Status' AND Lookup_Value='Received'),'Blue Dart AWB BD2026001',100005,'Sealed and intact. Minor surface moisture visible.','Samples received for moisture analysis.',100003),
(6,'2026-07-17 16:00:00','2026-07-17 16:30:00','2026-07-17 17:00:00',(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Sample_Status' AND Lookup_Value='Received'),'DTDC AWB DT2026002',100012,'AKD emulsion in sealed container. Intact.','Samples received for particle size analysis.',100011),
(7,'2026-07-19 11:00:00','2026-07-19 13:00:00','2026-07-19 14:00:00',(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Sample_Status' AND Lookup_Value='Received'),'VRL Logistics LR2026003',100005,'Damaged paper samples for documentation.','Physical damage evidence preserved.',100003);

-- ============================================================
-- Step 11: Visit Details
-- ============================================================

INSERT INTO Visit_Details (Complaint_ID, Engineer_ID, Visit_Date, Visit_Status_ID, Visit_Findings, Customer_Feedback, Follow_Up_Required, Remarks, Created_By)
VALUES
(5,100003,'2026-07-20 10:00:00',(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Visit_Status' AND Lookup_Value='Completed'),'Warehouse humidity 78% RH. Board stored on floor without pallets. Root cause identified.','Customer acknowledged improper storage but requested compensation.',FALSE,'Site visit complete.',100003),
(7,100003,'2026-07-19 14:00:00',(SELECT Lookup_ID FROM Lookup_Master WHERE Lookup_Type='Visit_Status' AND Lookup_Value='Completed'),'8 MT Kraft Paper rolls physically damaged confirmed. Truck loading photos obtained. No cradles used.','Customer requested immediate replacement with proper packaging.',FALSE,'Transport damage confirmed.',100003);

-- ============================================================
-- Step 12: Attachments
-- ============================================================

INSERT INTO Attachment_Master (Complaint_ID, Uploaded_By, File_Name, File_Path, File_Type, File_Size_KB, Remarks, Created_By)
VALUES
(1,100002,'itc_gsm_measurement_photo.jpg','/uploads/2026/07/itc_gsm.jpg','image/jpeg',842.50,'GSM measurement photo from customer site.',100002),
(3,100002,'jk_paper_bursting_strength_report.pdf','/uploads/2026/07/jk_burst.pdf','application/pdf',1124.30,'Customer lab bursting strength test report.',100002),
(5,100009,'westcoast_moisture_readings.xlsx','/uploads/2026/07/wc_moisture.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',445.80,'On-site moisture measurement log.',100009),
(7,100009,'century_kraft_damage_photos.pdf','/uploads/2026/06/century_damage.pdf','application/pdf',2341.60,'Photographic evidence of transport damage.',100009),
(13,100009,'poster_paper_color_zones.png','/uploads/2026/06/poster_color.png','image/png',673.20,'Color zone inconsistency photo.',100009),
(17,100002,'maplitho_streak_sample.jpg','/uploads/2026/05/maplitho_streak.jpg','image/jpeg',512.40,'Color streak defect photo (closed).',100002),
(19,100002,'kraft_dimensional_report.pdf','/uploads/2026/06/kraft_dimensions.pdf','application/pdf',789.10,'Independent dimensional measurement report.',100002);

SELECT 'Migration 010 complete. 19 complaints redistributed across all workflow stages and following SLA.' AS Result;
