-- Migration: Add Password_Hash to Customer_Master
-- Reason: Customers with portal access enabled require an encrypted password column for authentication.
-- Date: 2026-07-08

ALTER TABLE Customer_Master ADD COLUMN Password_Hash VARCHAR(255) NULL AFTER Customer_Email;
