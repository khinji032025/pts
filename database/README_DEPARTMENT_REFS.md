# Department-Based Reference Code System

## Overview

This update implements department-specific reference codes for the Paper Tracking System.

### Reference Code Format

- **Format**: `{DEPARTMENT_ABBREVIATION}{SEQUENCE_NUMBER}`
- **Examples**: `HR101`, `MTO102`, `LYDO101`, `MO101`, `BO102`
- **Behavior**: Each department starts numbering at 101 independently

### Examples by Department

- **HR**: HR101, HR102, HR103...
- **MTO**: MTO101, MTO102...
- **LYDO**: LYDO101, LYDO102...
- **Mayor's Office (MO)**: MO101, MO102...
- **Budget Office (BO)**: BO101, BO102...
- **Army (ARM)**: ARM101, ARM102...

## Database Changes

### New Tables

- **dept_ref_counter**: Tracks the next reference number for each department
  - `department_id` (INT, PRIMARY KEY): References departments table
  - `next_ref` (INT): Next number to use (starts at 101)

### Modified Tables

- **departments**: Added `abbreviation` column (VARCHAR(20), UNIQUE)
- **papers**: Changed `ref_code` from INT to VARCHAR(50)

### Removed Tables

- **ref_counter**: The old global counter table (replaced by dept_ref_counter)

## Implementation Steps

### Option 1: Fresh Installation

If starting fresh, simply run:

```bash
mysql pts_db < database/schema.sql
```

### Option 2: Migrate Existing Database

If you have existing data, run the migration script:

```bash
mysql pts_db < database/migrate_to_department_refs.sql
```

**Important**: The migration script will:

1. Add the abbreviation column to departments
2. Set abbreviations for existing departments
3. Create the new counter table
4. Convert existing numeric ref codes to formatted codes (e.g., 42 → MO42)

## API Usage

### Creating a Department

```json
POST /backend/modules/departments.php?action=create
{
  "name": "Finance",
  "abbreviation": "FIN"
}
```

**Response:**

```json
{
  "success": true,
  "id": 7,
  "name": "Finance",
  "abbreviation": "FIN"
}
```

### Creating a Paper

```json
POST /backend/modules/papers.php?action=create
{
  "title": "Budget Report 2026",
  "dept_id": 1
}
```

**Response:**

```json
{
  "success": true,
  "id": 102,
  "ref_code": "HR101"
}
```

### Viewing a Paper (Public)

```
GET /backend/modules/papers.php?action=public_view&ref=HR101
```

## Customizing Abbreviations

### Set Abbreviations for Existing Departments

Edit `schema.sql` or run SQL:

```sql
UPDATE departments SET abbreviation = 'NEW_CODE' WHERE id = department_id;
```

### View All Department Abbreviations

```sql
SELECT id, name, abbreviation FROM departments;
```

## Notes

- ✅ Reference codes are unique per department naming scheme
- ✅ Each department maintains independent numbering
- ✅ Starting number for all departments is 101
- ✅ Automatic counter increment on paper creation
- ✅ Supports up to 999 papers per department (101-1099)

## Troubleshooting

### "Counter value not found" Error

- Ensure the `dept_ref_counter` table exists
- Run the migration script if needed

### "Abbreviation required" Error

- When creating a new department via API, provide both `name` and `abbreviation`

### Old Numeric Ref Codes Still Showing

- Run the migration script to convert existing codes
- Manually update using SQL: `UPDATE papers SET ref_code = CONCAT('ABBREV', ref_code) WHERE ...`
