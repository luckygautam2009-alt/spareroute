-- Migration 003: Admin hardening
-- 1. Add user_id column with plain unique constraint to admin_profiles (NULLs allowed for legacy rows)
ALTER TABLE admin_profiles ADD COLUMN IF NOT EXISTS user_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admin_profiles_user_id_key'
  ) THEN
    ALTER TABLE admin_profiles ADD CONSTRAINT admin_profiles_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- 2. Create sequence for sequential employee codes
CREATE SEQUENCE IF NOT EXISTS admin_employee_seq;

-- Initialise sequence so nextval is greater than any existing numeric suffix (INQ-ADM-###)
DO $$
DECLARE
  max_val integer;
  current_seq_val bigint;
  seq_called boolean;
BEGIN
  SELECT COALESCE(MAX(SUBSTRING(employee_code FROM 'INQ-ADM-([0-9]+)')::integer), 0)
    INTO max_val
    FROM admin_profiles;

  SELECT last_value, is_called INTO current_seq_val, seq_called FROM admin_employee_seq;

  IF NOT seq_called AND current_seq_val = 1 AND max_val >= 1 THEN
    PERFORM setval('admin_employee_seq', max_val, true);
  ELSIF max_val > current_seq_val THEN
    PERFORM setval('admin_employee_seq', max_val, true);
  END IF;
END $$;
