# Smart City Management Platform

<p align="left">
  <img src="https://img.shields.io/badge/Frontend-React%2019-61DAFB?logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-339933?logo=node.js&logoColor=white" alt="Node + Express" />
  <img src="https://img.shields.io/badge/Database-PostgreSQL-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Maps-Leaflet-199900?logo=leaflet&logoColor=white" alt="Leaflet" />
  <img src="https://img.shields.io/badge/Charts-Recharts-FF4B4B" alt="Recharts" />
  <img src="https://img.shields.io/badge/CI-GitHub%20Actions-2088FF?logo=githubactions&logoColor=white" alt="GitHub Actions" />
  <img src="https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel&logoColor=white" alt="Vercel" />
</p>

A production-minded, full-stack civic incident management platform where citizens report municipal issues, departments coordinate responses, and admins manage operations through analytics and role-based workflows.

This project is built as a monorepo with a React frontend and an Express/PostgreSQL backend, designed for real-world delivery standards: secure uploads, role-based access, auditability, CI checks, and cloud deployment.

## Highlights

- Role-aware product design for `citizen`, `staff`, and `admin` users.
- End-to-end incident lifecycle from report -> assignment -> progress updates -> resolution.
- Geospatial workflows with map-based reporting and issue triage context.
- Media-backed updates: citizens and staff can attach photo evidence.
- Security-first backend (validation, rate limiting, CORS allowlist, upload hardening).
- CI-enforced quality gates (lint, migration check, tests, build).

## Architecture

- `frontend/` -> React + Vite SPA
- `backend/` -> Node.js + Express REST API
- `backend/db/schema.sql` -> PostgreSQL schema and idempotent updates
- `.github/workflows/ci.yml` -> CI pipeline

## Tech Stack

- ⚛️ React 19
- ⚡ Vite
- 🗺️ Leaflet
- 📊 Recharts
- 🟢 Node.js + Express
- 🐘 PostgreSQL
- 🧩 Zod
- 🔐 JWT
- 🛡️ Helmet + CORS + Rate Limiting
- ☁️ Vercel + GitHub Actions

### Frontend

- React 19
- Vite
- React Router
- React Leaflet + Leaflet
- Recharts
- CSS (custom responsive system)

### Backend

- Node.js + Express
- PostgreSQL (Neon-compatible)
- Zod (request validation)
- JWT auth + role authorization
- Multer + ImageKit (image uploads)
- Helmet + CORS allowlist + route-specific rate limiting

### Tooling and Ops

- GitHub Actions CI
- Vercel deployment configs for frontend and backend

## Core Features

### Citizen Portal

- Submit issue reports with:
  - title
  - category
  - description
  - map location
  - optional photo evidence
- View personal submitted issues and status.

### Staff Operations

- Access department-scoped issue queue.
- Update issue status (`pending`, `in_progress`, `resolved`).
- Add progress notes and optional progress photos.
- Open issue detail popup to see citizen photo and full update timeline.

### Admin Control Plane

- Manage users and role assignments.
- Create/delete departments.
- Assign/remove staff to/from departments.
- Assign issues to departments.
- View dashboard metrics and issue analytics.
- Review admin audit logs and export CSV.

## Security and Reliability

- Route-level role-based authorization.
- Zod validation on body/query/params.
- Endpoint-specific throttling for auth, uploads, and sensitive mutations.
- Upload hardening:
  - MIME allowlist
  - extension allowlist
  - magic-byte content signature checks
- Environment-based CORS allowlist.
- DB SSL strategy that works in local CI and cloud.

## Local Development

## Prerequisites

- Node.js 20+
- npm 10+
- PostgreSQL (or Neon connection)

## API Surface (High-Level)

### Auth APIs

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET|POST /api/auth/verify-email`

### Issue APIs

- `POST /api/issues` (citizen)
- `POST /api/issues/upload-image` (citizen/staff/admin)
- `GET /api/issues/my` (citizen)
- `GET /api/issues` (staff/admin)
- `GET /api/issues/:id` (staff/admin details + updates)
- `PATCH /api/issues/:id/assign` (admin)
- `PATCH /api/issues/:id/status` (staff/admin)

### Admin APIs

- `GET /api/admin/users`
- `POST /api/admin/users`
- `PATCH /api/admin/users/:id/role`
- `PATCH /api/admin/users/:id/department`
- `POST /api/admin/departments`
- `DELETE /api/admin/departments/:id`
- `GET /api/admin/dashboard`
- `GET /api/admin/audit-logs`

## CI Pipeline

GitHub Actions workflow (`.github/workflows/ci.yml`) runs on push and pull request:

- Backend:
  - install dependencies
  - lint
  - migration check
  - tests (with Postgres service)
- Frontend:
  - install dependencies
  - lint
  - build

## Deployment

The repo includes Vercel configs for split deployment:

- `frontend/vercel.json`
- `backend/vercel.json` + `backend/api/index.js`

Deploy as two Vercel projects:

1. Frontend project root: `frontend`
2. Backend project root: `backend`

Set environment variables in each project (Production + Preview).

### Production Notes

- Set backend `ALLOWED_ORIGINS` to frontend domain(s).
- Set frontend `VITE_API_BASE_URL` to deployed backend URL + `/api`.
- Rotate all secrets before sharing public demos.

## Demo Guidance

If you share demo access publicly:

- use fake data only
- use temporary demo credentials
- rotate passwords periodically
- include a note that demo data resets

## Project Maturity Snapshot

- Completed role-based end-to-end workflows.
- Implemented secure upload path and evidence-backed updates.
- Added operational analytics and audit visibility.
- Added CI quality gates and deployment-ready configuration.

## Future Roadmap

- Sentry integration for frontend/backend monitoring.
- Health/readiness probes for operations.
- Additional integration tests for newest issue-detail flows.
- Mobile-first card rendering for dense admin tables.

---

Built to demonstrate strong full-stack engineering fundamentals: product thinking, API design, data modeling, security controls, operational discipline, and responsive UX delivery.
