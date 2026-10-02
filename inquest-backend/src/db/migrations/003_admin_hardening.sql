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
