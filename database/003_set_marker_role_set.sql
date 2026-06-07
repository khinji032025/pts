-- Migration: support multiple marker role assignments for department users

ALTER TABLE users
  MODIFY COLUMN marker_role SET('IN','OUT') DEFAULT NULL;
