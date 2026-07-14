-- Migration: Add Is_Escalated to Complaint_Header
-- Reason: Visual flag to mark if a complaint has breached SLA and has been escalated.
-- Date: 2026-07-12

ALTER TABLE Complaint_Header ADD COLUMN Is_Escalated TINYINT(1) NOT NULL DEFAULT 0 AFTER SLA_Breached;
