-- Migration: Update existing database to support department-based reference codes
-- Run this script on your existing pts_db database

-- Step 1: Add abbreviation column to departments table
ALTER TABLE departments ADD COLUMN abbreviation VARCHAR(20) UNIQUE AFTER name;

-- Step 2: Set abbreviations for existing departments
UPDATE departments SET abbreviation = 'MO' WHERE name = 'Mayor''s Office';
UPDATE departments SET abbreviation = 'MTO' WHERE name = 'MTO';
UPDATE departments SET abbreviation = 'HR' WHERE name = 'HR';
UPDATE departments SET abbreviation = 'LYDO' WHERE name = 'LYDO';
UPDATE departments SET abbreviation = 'BO' WHERE name = 'Budget Office';
UPDATE departments SET abbreviation = 'ARM' WHERE name = 'Army';

-- If you have other departments, add them here:
-- UPDATE departments SET abbreviation = 'XXX' WHERE name = 'Your Department';

-- Step 3: Drop the old global counter table
DROP TABLE IF EXISTS ref_counter;

-- Step 4: Create new department-specific counter table
CREATE TABLE IF NOT EXISTS dept_ref_counter (
    department_id INT PRIMARY KEY,
    next_ref INT NOT NULL DEFAULT 101,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
);

-- Step 5: Initialize counters for all departments starting at 101
INSERT IGNORE INTO dept_ref_counter (department_id, next_ref)
SELECT id, 101 FROM departments;

-- Step 6: Modify papers.ref_code from INT to VARCHAR(50)
ALTER TABLE papers MODIFY COLUMN ref_code VARCHAR(50) NOT NULL;

-- Step 7: Update existing paper reference codes with department abbreviations
-- This converts old numeric refs (42, 43, 44) to formatted refs (MO42, HR43, etc.)
UPDATE papers p
JOIN departments d ON p.origin_department_id = d.id
SET p.ref_code = CONCAT(d.abbreviation, p.ref_code)
WHERE p.ref_code NOT REGEXP '^[A-Z]+[0-9]+$';

-- Verify the migration
SELECT 'Migration Complete!' as status;
SELECT COUNT(*) as total_papers FROM papers;
SELECT id, name, abbreviation FROM departments;
