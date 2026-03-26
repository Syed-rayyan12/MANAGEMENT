---
name: Manage Seed Data
description: Workflow for adding, modifying, or resetting seed data including users, teams, boards, board columns, and initial projects.
---

# Manage Seed Data

The database is seeded with predefined users, teams, boards, and board columns via `backend/prisma/seed.ts`. Use this skill when adding new users, teams, or modifying the initial dataset.

## Seed File Location

`backend/prisma/seed.ts`

## Run Seed

```bash
cd backend
npm run seed
```

This runs `ts-node prisma/seed.ts`, which uses Prisma's `upsert` to create or update records.

## User Structure

### Fixed Roles (do not add more users to these)
- **PM (Project Managers)**: 3 users — `pm.azharrajput`, `pm.aqsarathore`, `pm.muhammadhuzafa`
- **TL (Team Leads)**: 2 users — `tl.mustufa`, `tl.ali`

### Expandable Roles (can add more)
- **Executive**: Currently 4 users (`exec.` prefix)
- **Production**: Currently 11 users (`prod.` prefix)

### Username Convention
All usernames follow the pattern: `<role_prefix>.<lowercasefullname>`

| Role       | Prefix  | Example              |
| ---------- | ------- | -------------------- |
| PM         | `pm.`   | `pm.azharrajput`     |
| TL         | `tl.`   | `tl.mustufa`         |
| Executive  | `exec.` | `exec.tahaanwar`     |
| Production | `prod.` | `prod.syedrayyan`    |

### Default Password
All users: `password123` (hashed with bcrypt, 10 rounds)

## Adding a New User

Add to the appropriate array in `seed.ts`:

```typescript
const productionUsers = [
  // ... existing users
  {
    email: 'prod12@company.com',
    password,                          // bcrypt-hashed 'password123'
    role: 'PRODUCTION' as const,
    name: 'New User Name',
    username: 'prod.newusername',      // lowercase, no spaces
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=NewUser',
  },
];
```

## Adding a New Team

```typescript
const teams = [
  // ... existing teams
  {
    name: 'New Team',
    slug: 'new-team',                  // URL-friendly, unique
    organizationId: org.id,
  },
];
```

Then assign members to the team in the `TeamMember` creation section.

## Adding a New Board

Boards represent service/workspace categories:

```typescript
const boards = [
  // ... existing boards
  {
    name: 'New Service',
    slug: 'new-service',               // URL-friendly, unique
    organizationId: org.id,
  },
];
```

## Adding Board Columns

Each board has its own workflow columns:

```typescript
const columns = [
  { name: 'To Do',        key: 'todo',        color: '#6B7280', position: 0 },
  { name: 'In Progress',  key: 'in_progress',  color: '#3B82F6', position: 1 },
  { name: 'Completed',    key: 'completed',    color: '#10B981', position: 2 },
  { name: 'Revisions',    key: 'revisions',    color: '#F59E0B', position: 3 },
];
```

Note: `Project.status` references `BoardColumn.key`, so column keys should be lowercase/snake_case and stable.

## Reset Database

To completely reset and re-seed:

```bash
cd backend
npx prisma migrate reset    # Drops DB, re-runs all migrations, runs seed
```

⚠️ **This deletes ALL data** — only use in development.

## Checklist

- [ ] User added with correct prefix, email, role, and username format
- [ ] Password uses the shared bcrypt hash variable
- [ ] Avatar URL uses dicebear with a unique seed
- [ ] Email is unique (incrementing pattern: `prod12@company.com`)
- [ ] If adding team: slug is unique and URL-friendly
- [ ] If adding board: slug is unique
- [ ] Seed runs without errors: `npm run seed`
