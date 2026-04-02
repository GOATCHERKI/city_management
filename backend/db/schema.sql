-- Smart City Management System - PostgreSQL schema (Neon compatible)
-- Run this in Neon SQL Editor or with `npm run migrate`.

CREATE TABLE
IF NOT EXISTS departments
(
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR
(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW
()
);

CREATE TABLE
IF NOT EXISTS users
(
  id BIGSERIAL PRIMARY KEY,
  cid VARCHAR
(50) NOT NULL UNIQUE,
  full_name VARCHAR
(120) NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR
(20) NOT NULL DEFAULT 'citizen',
  is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verification_token_hash TEXT,
  verification_expires_at TIMESTAMPTZ,
  department_id BIGINT REFERENCES departments
(id) ON
DELETE
SET NULL
,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW
(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW
(),
  CONSTRAINT valid_user_role CHECK
(role IN
('citizen', 'admin', 'staff', 'dept_admin'))
);

DO $$
BEGIN
  ALTER TABLE users DROP CONSTRAINT IF EXISTS valid_user_role;
  ALTER TABLE users
  ADD CONSTRAINT valid_user_role CHECK
  (role IN ('citizen', 'admin', 'staff', 'dept_admin'));
EXCEPTION
  WHEN undefined_table THEN
    NULL;
END $$;

CREATE TABLE
IF NOT EXISTS issues
(
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR
(160) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR
(80) NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  status VARCHAR
(20) NOT NULL DEFAULT 'pending',
  created_by BIGINT NOT NULL REFERENCES users
(id) ON
DELETE CASCADE,
  assigned_department BIGINT
REFERENCES departments
(id) ON
DELETE
SET NULL
,
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW
(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW
(),
  CONSTRAINT valid_latitude CHECK
(latitude BETWEEN -90 AND 90),
  CONSTRAINT valid_longitude CHECK
(longitude BETWEEN -180 AND 180),
  CONSTRAINT valid_issue_status CHECK
(status IN
('pending', 'in_progress', 'resolved'))
);

CREATE TABLE
IF NOT EXISTS budgets
(
  id BIGSERIAL PRIMARY KEY,
  department_id BIGINT NOT NULL REFERENCES departments
(id) ON
DELETE CASCADE,
  category VARCHAR
(80),
  period_month DATE NOT NULL,
  total_amount NUMERIC
(12, 2) NOT NULL CHECK
(total_amount >= 0),
  used_amount NUMERIC
(12, 2) NOT NULL DEFAULT 0 CHECK
(used_amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW
(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW
(),
  CONSTRAINT budgets_unique_scope UNIQUE
(department_id, category, period_month)
);

ALTER TABLE issues
ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC(12, 2);

ALTER TABLE issues
ADD COLUMN IF NOT EXISTS final_cost NUMERIC(12, 2);

ALTER TABLE issues
ADD COLUMN IF NOT EXISTS budget_id BIGINT REFERENCES budgets(id) ON DELETE SET NULL;

ALTER TABLE issues
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'issues_estimated_cost_non_negative'
  ) THEN
    ALTER TABLE issues
    ADD CONSTRAINT issues_estimated_cost_non_negative
    CHECK (estimated_cost IS NULL OR estimated_cost >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'issues_final_cost_non_negative'
  ) THEN
    ALTER TABLE issues
    ADD CONSTRAINT issues_final_cost_non_negative
    CHECK (final_cost IS NULL OR final_cost >= 0);
  END IF;
END $$;

CREATE TABLE
IF NOT EXISTS issue_updates
(
  id BIGSERIAL PRIMARY KEY,
  issue_id BIGINT NOT NULL REFERENCES issues
(id) ON
DELETE CASCADE,
  message TEXT
NOT NULL,
  photo_url TEXT,
  created_by BIGINT NOT NULL REFERENCES users
(id) ON
DELETE CASCADE,
  created_at TIMESTAMPTZ
NOT NULL DEFAULT NOW
()
);

ALTER TABLE issue_updates
ADD COLUMN IF NOT EXISTS photo_url TEXT;

ALTER TABLE issue_updates
ADD COLUMN IF NOT EXISTS cost_added NUMERIC(12, 2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'issue_updates_cost_added_non_negative'
  ) THEN
    ALTER TABLE issue_updates
    ADD CONSTRAINT issue_updates_cost_added_non_negative
    CHECK (cost_added IS NULL OR cost_added >= 0);
  END IF;
END $$;

CREATE TABLE
IF NOT EXISTS admin_audit_logs
(
  id BIGSERIAL PRIMARY KEY,
  actor_user_id BIGINT REFERENCES users
(id) ON
DELETE
SET NULL
,
  actor_cid VARCHAR
(50),
  target_user_id BIGINT REFERENCES users
(id) ON
DELETE
SET NULL
,
  action VARCHAR
(60) NOT NULL,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW
()
);

CREATE INDEX
IF NOT EXISTS idx_users_role ON users
(role);
CREATE UNIQUE INDEX
IF NOT EXISTS idx_users_email_unique_lower ON users
(LOWER
(email));
CREATE INDEX
IF NOT EXISTS idx_issues_status ON issues
(status);
CREATE INDEX
IF NOT EXISTS idx_issues_created_by ON issues
(created_by);
CREATE INDEX
IF NOT EXISTS idx_issues_assigned_department ON issues
(assigned_department);
CREATE INDEX
IF NOT EXISTS idx_issues_created_at ON issues
(created_at DESC);
CREATE INDEX
IF NOT EXISTS idx_issue_updates_issue_id ON issue_updates
(issue_id);
CREATE INDEX
IF NOT EXISTS idx_issue_updates_cost_added ON issue_updates
(cost_added);
CREATE INDEX
IF NOT EXISTS idx_issues_budget_id ON issues
(budget_id);
CREATE INDEX
IF NOT EXISTS idx_issues_resolved_at ON issues
(resolved_at DESC);
CREATE INDEX
IF NOT EXISTS idx_budgets_department_period ON budgets
(department_id, period_month DESC);
CREATE INDEX
IF NOT EXISTS idx_admin_audit_logs_created_at ON admin_audit_logs
(created_at DESC);
CREATE INDEX
IF NOT EXISTS idx_admin_audit_logs_actor_user_id ON admin_audit_logs
(actor_user_id);
CREATE INDEX
IF NOT EXISTS idx_admin_audit_logs_target_user_id ON admin_audit_logs
(target_user_id);

INSERT INTO departments
  (name, description)
VALUES
  ('Public Works', 'Roads, potholes, and general infrastructure'),
  ('Sanitation', 'Garbage collection and waste management'),
  ('Water Services', 'Leaks, pipelines, and drainage')
ON CONFLICT
(name) DO NOTHING;
