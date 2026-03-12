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
('citizen', 'admin', 'staff'))
);

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
IF NOT EXISTS issue_updates
(
  id BIGSERIAL PRIMARY KEY,
  issue_id BIGINT NOT NULL REFERENCES issues
(id) ON
DELETE CASCADE,
  message TEXT
NOT NULL,
  created_by BIGINT NOT NULL REFERENCES users
(id) ON
DELETE CASCADE,
  created_at TIMESTAMPTZ
NOT NULL DEFAULT NOW
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

INSERT INTO departments
    (name, description)
VALUES
    ('Public Works', 'Roads, potholes, and general infrastructure'),
    ('Sanitation', 'Garbage collection and waste management'),
    ('Water Services', 'Leaks, pipelines, and drainage')
ON CONFLICT
(name) DO NOTHING;
