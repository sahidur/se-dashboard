# SE360 — Development Conventions

## Stack
- **Backend**: NestJS (Node.js), TypeORM, PostgreSQL
- **Frontend**: Next.js (App Router, Turbopack), React, TanStack Query
- **Auth**: httpOnly cookies (`se360_at` / `se360_rt`), JWT, Zustand (client state)
- **Deployment**: DigitalOcean droplet, systemd services, nginx reverse proxy

## Project Structure
```
backend/src/
  auth/          — JWT strategy, login/register/refresh
  users/         — User CRUD, profile management
  roles/         — RBAC roles and permissions
  surveys/       — Survey CRUD, responses, categories
  data-collection/ — School data collection forms
  school-monitoring/ — Monitoring feedback
  geo-locations/ — Division/district/thana/area hierarchy
  files/         — S3/local upload handling
  common/audit/  — Audit logging
  common/health/ — Health check endpoint (/api/health)

frontend/src/
  app/(dashboard)/ — All dashboard pages (App Router)
  components/     — Reusable UI components
  lib/api.ts      — Axios instance with interceptors
  store/          — Zustand stores
  types/          — TypeScript interfaces
```

## Backend Conventions
- All API routes prefixed with `/api`
- Auth: `JwtAuthGuard` + `AccessGuard` (permission-based)
- Rate limiting: 100 req/60s global (via `@nestjs/throttler`)
- Validation: `class-validator` + `class-transformer` (whitelist + forbidNonWhitelisted)
- DB: TypeORM with PostgreSQL, schema `bep`
- Seed: `npm run seed` (requires `SEED_ADMIN_PASSWORD` env var)

## Frontend Conventions
- Pages use `'use client'` directive
- API calls via `api` instance from `@/lib/api`
- Error handling: use `getErrorMessage(error, fallback)` from `@/lib/api`
- State management: Zustand for auth, TanStack Query for server state
- UI: shadcn-style components in `@/components/ui/`
- Forms: controlled components with local state

## Security
- CSRF: SameSite cookies + CORS origin validation
- XSS: CSP headers, helmet.js, input sanitization
- Auth: JWT in httpOnly cookies, not localStorage
- RBAC: Permission-based access control with `resource` scoping
- Deploy: `chmod 600` on env files, `chmod 750` on uploads

## Git
- Branch: `main` (production)
- Commits: Conventional format (`feat:`, `fix:`, `security:`, `chore:`)
- Never commit secrets, env files, or CA certificates
