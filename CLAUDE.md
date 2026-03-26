# CLAUDE.md — ProManage

This file provides context for Claude Code when working on this repository.

## Project Overview

**ProManage** is an internal company management platform. It currently serves as a **Project Management Module** with Kanban boards and role-based access. The long-term roadmap is to evolve this into a full **CRM system** with:

- Employee salary auto-calculation
- Attendance / presence tracking
- Sales invoicing (Stripe or similar payment processor)
- Invoice tracking and client management

## Repository Structure

```
MANAGEMENT-main/
├── backend/          # Node.js + Express + TypeScript API server
├── frontend/         # Next.js 16 + React 19 web application
├── CLAUDE.md         # This file (repo-wide guidance)
├── ARCHITECTURE.md   # System design & data model overview
└── README.md         # Project overview & setup instructions
```

Each sub-project has its own `CLAUDE.md` with more specific guidance.

## Tech Stack

| Layer      | Technology                                         |
| ---------- | -------------------------------------------------- |
| Frontend   | Next.js 16, React 19, Tailwind CSS, shadcn/ui      |
| Backend    | Node.js, Express.js, TypeScript                    |
| Database   | PostgreSQL (via Prisma ORM)                        |
| Auth       | JWT (jsonwebtoken + bcryptjs)                      |
| Storage    | Cloudflare R2 (S3-compatible)                      |
| Deployment | Railway (backend + DB), Railway (frontend)         |
| DnD        | @dnd-kit (drag-and-drop for Kanban)                |
| Forms      | react-hook-form + zod validation                   |

## User Roles (4 fixed roles)

| Role         | Prefix   | Description                                    |
| ------------ | -------- | ---------------------------------------------- |
| `TL`         | `tl.`    | Team Lead — oversees PMs within their team     |
| `PM`         | `pm.`    | Project Manager — manages projects and tasks   |
| `PRODUCTION` | `prod.`  | Cross-team execution; can see ALL team projects |
| `EXECUTIVE`  | `exec.`  | High-level viewer                              |

> **IMPORTANT**: The `PRODUCTION` role has cross-team visibility — they can see projects across ALL teams, not just their own. This is intentional and must be preserved in any data-fetching logic.

## Key Conventions

### Code Style
- **TypeScript** everywhere — no plain JS files
- **Prisma** for all database access — never raw SQL without good reason
- API responses follow `{ success: boolean, message: string, data?: ... }` pattern
- Use `express-validator` / `zod` for input validation
- Controllers handle business logic; routes are thin wrappers

### Naming
- Usernames use role-based prefixes: `pm.azharrajput`, `tl.mustufa`, `exec.tahaanwar`, `prod.syedrayyan`
- Database tables use snake_case via Prisma `@@map()`
- TypeScript files use camelCase filenames: `auth.controller.ts`, `project.routes.ts`
- Prisma enums use UPPER_CASE: `UserRole`, `ProjectPriority`

### Data Model Concepts
- **Organization** → has many **Teams** and **Boards**
- **Board** = a service category (Logo Design, Web Design, Web Development, Content Writing)
- **Team** = a sales team that owns projects
- **Project** belongs to a Board + Team, has a PM and optional developer (Production user)
- **BoardColumn** = workflow stages (dynamic, per board) — project `status` references `BoardColumn.key`

### Authentication
- JWT-based, token in `Authorization: Bearer <token>` header
- `authenticate` middleware extracts user from token
- `authorizeRoles('PM', 'TL')` middleware for role-based access
- All passwords default to `password123` in dev (seeded users)

## Commands

### Backend
```bash
cd backend
npm install
npx prisma generate        # Generate Prisma client
npx prisma migrate dev     # Run migrations
npm run seed               # Seed database with users
npm run dev                # Start dev server (port 5000)
```

### Frontend
```bash
cd frontend
npm install
npm run dev                # Start Next.js dev server (port 3000)
```

## Environment Variables

- **Backend**: `backend/.env` — see `backend/.env.example` for required variables
- **Frontend**: `frontend/.env.local` — needs `NEXT_PUBLIC_API_URL`

> **SECURITY**: Never commit real secrets. Use `.env.example` files as templates.

## Common Gotchas

1. **Board columns are dynamic** — project status is a string key referencing `BoardColumn.key`, NOT a fixed enum
2. **Production role visibility** — PRODUCTION users must always see ALL projects across all teams
3. **Username normalization** — the login system strips spaces, lowercases, and matches against stored username
4. **Prisma client generation** — run `npx prisma generate` after any schema change before the code can use new models
5. **Team-scoped data** — most data queries (for non-PRODUCTION roles) are scoped to the user's team membership
