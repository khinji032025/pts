-- Migration: Add RETURNED action to status_logs
-- This migration adds the RETURNED action to the status_logs table's action ENUM
-- to support returning documents when issues are identified

ALTER TABLE status_logs MODIFY COLUMN action ENUM('IN','OUT','DONE','RETURNED') NOT NULL;
