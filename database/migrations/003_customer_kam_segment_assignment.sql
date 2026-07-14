-- Migration: Add Customer_KAM_Segment_Assignment table
-- Reason: A customer can have a different KAM per business segment
--         (e.g. Customer A -> KAM X1 for Paper, KAM X2 for Chemical).
--         Customer_Master.KAM_ID cannot represent this — it's single-valued.
-- Date: 2026-07-13

CREATE TABLE Customer_KAM_Segment_Assignment (
    Assignment_ID       BIGINT       PRIMARY KEY AUTO_INCREMENT,
    Customer_ID         VARCHAR(20)  NOT NULL,
    Business_Unit_ID    BIGINT       NOT NULL,   -- the "segment"
    KAM_ID               BIGINT       NOT NULL,
    Assigned_On          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Is_Active             BOOLEAN      NOT NULL DEFAULT TRUE,
    Created_On            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Created_By            BIGINT,
    Updated_On            DATETIME,
    Updated_By            BIGINT,
    UNIQUE KEY uq_customer_segment (Customer_ID, Business_Unit_ID),
    FOREIGN KEY (Customer_ID)      REFERENCES Customer_Master(Customer_ID),
    FOREIGN KEY (Business_Unit_ID) REFERENCES Business_Unit_Master(Business_Unit_ID),
    FOREIGN KEY (KAM_ID)           REFERENCES KAM_Master(KAM_ID)
);

-- Backfill: every existing customer currently has exactly one segment + one KAM,
-- so this preserves current behaviour with zero data loss.
INSERT INTO Customer_KAM_Segment_Assignment (Customer_ID, Business_Unit_ID, KAM_ID)
SELECT Customer_ID, Business_Unit_ID, KAM_ID
FROM Customer_Master
WHERE KAM_ID IS NOT NULL;