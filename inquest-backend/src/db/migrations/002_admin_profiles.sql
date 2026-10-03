CREATE TABLE admin_profiles (
  email TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  employee_code TEXT NOT NULL UNIQUE,
  profile_photo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_profiles_employee_code ON admin_profiles(employee_code);
