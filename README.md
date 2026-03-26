# ProManage — Enterprise Project Management Platform

Internal project management platform built for the company's operations team. Currently focused on **project management with Kanban boards**, with a roadmap to evolve into a full **CRM system**.

## Current Features

- **Dashboard** — Overview cards for 4 workspace types (Logo Design, Web Design, Web Development, Content Writing)
- **Kanban Boards** — Drag-and-drop project cards across dynamic status columns
- **Project Management** — Create, edit, delete, assign projects with priorities and due dates
- **Role-Based Access** — 4 roles (TL, PM, Executive, Production) with scoped visibility
- **Team-Based Scoping** — Projects belong to sales teams; Production role has cross-team visibility
- **Notifications** — In-app notifications for assignments, status changes, new projects
- **File Uploads** — Attach files to projects via Cloudflare R2
- **Comments & Checklists** — Collaborative project details

## Future Roadmap (CRM Evolution)

- 💰 **Salary Management** — Auto-calculate employee salaries
- 📋 **Attendance Tracking** — Employee attendance / presence marking
- 🧾 **Invoicing** — Sales team invoice generation and sending (Stripe integration)
- 📊 **Invoice Tracking** — Track payment status and client invoices

## Tech Stack

| Layer      | Technology                                    |
| ---------- | --------------------------------------------- |
| Frontend   | Next.js 16, React 19, Tailwind CSS, shadcn/ui |
| Backend    | Node.js, Express.js, TypeScript               |
| Database   | PostgreSQL + Prisma ORM                       |
| Auth       | JWT + bcrypt                                  |
| Storage    | Cloudflare R2                                 |
| Deployment | Railway                                       |

## Quick Start

### Prerequisites

- Node.js v18+
- PostgreSQL v14+
- npm

### Backend Setup

```bash
cd backend
npm install
cp .env.example .env           # Fill in your credentials
npx prisma generate            # Generate Prisma client
npx prisma migrate dev         # Run database migrations
npm run seed                   # Seed users, teams, boards
npm run dev                    # Starts on http://localhost:5000
```

### Frontend Setup

```bash
cd frontend
npm install
# Create .env.local with:
#   NEXT_PUBLIC_API_URL="http://localhost:5000/api"
npm run dev                    # Starts on http://localhost:3000
```

## User Roles

| Role       | Prefix  | Count | Description                              |
| ---------- | ------- | ----- | ---------------------------------------- |
| TL         | `tl.`   | 2     | Team Lead — oversees PMs                 |
| PM         | `pm.`   | 3     | Project Manager — manages projects       |
| Production | `prod.` | 11    | Cross-team execution (sees all projects) |
| Executive  | `exec.` | 4     | High-level viewer                        |

**Default password**: `password123` — See [USERS.md](./backend/USERS.md) for the full list.

## Project Structure

```
├── backend/                 # Express + TypeScript API
│   ├── prisma/              # Schema, migrations, seed
│   ├── src/
│   │   ├── controllers/     # Business logic (8 controllers)
│   │   ├── routes/          # API route definitions
│   │   ├── middlewares/     # Auth & authorization
│   │   ├── types/           # TypeScript interfaces
│   │   └── utils/           # JWT, R2, validators, env
│   └── .env.example
├── frontend/                # Next.js web application
│   ├── app/                 # Pages (App Router)
│   ├── components/          # UI components (shadcn + custom)
│   ├── contexts/            # Global state (AppContext)
│   ├── hooks/               # Custom React hooks
│   └── lib/                 # API client, types, utils
├── CLAUDE.md                # AI assistant context
├── ARCHITECTURE.md          # System design documentation
└── README.md                # This file
```

## API Overview

| Endpoint                         | Method | Description               |
| -------------------------------- | ------ | ------------------------- |
| `/api/auth/login`                | POST   | User login                |
| `/api/auth/me`                   | GET    | Current user profile      |
| `/api/dashboard/overview`        | GET    | Dashboard workspace stats |
| `/api/projects`                  | GET    | List all projects         |
| `/api/projects/:id`              | GET    | Get project details       |
| `/api/projects`                  | POST   | Create project            |
| `/api/projects/:id`              | PUT    | Update project            |
| `/api/projects/:id`              | DELETE | Delete project            |
| `/api/projects/:workspace`       | GET    | Projects by workspace     |
| `/api/boards`                    | GET    | List boards               |
| `/api/teams`                     | GET    | List teams                |
| `/api/notifications`             | GET    | User notifications        |
| `/api/upload`                    | POST   | Upload file to R2         |

See [API_DOCUMENTATION.md](./backend/API_DOCUMENTATION.md) for full details.

## Documentation

| File                                                           | Description                  |
| -------------------------------------------------------------- | ---------------------------- |
| [ARCHITECTURE.md](./ARCHITECTURE.md)                           | System design & data model   |
| [Backend README](./backend/README.md)                          | Backend setup & details      |
| [API Documentation](./backend/API_DOCUMENTATION.md)            | Complete API reference        |
| [Workflow Summary](./backend/WORKFLOW_SUMMARY.md)              | Feature workflows             |
| [Users](./backend/USERS.md)                                    | User list & credentials      |
| [CLAUDE.md](./CLAUDE.md)                                       | AI assistant context          |

## License

MIT