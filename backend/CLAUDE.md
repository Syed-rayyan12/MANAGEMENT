# CLAUDE.md — Backend

Backend-specific guidance for Claude Code. See the root `CLAUDE.md` for project-wide context.

## Architecture

```
backend/
├── prisma/
│   ├── schema.prisma          # Data model (source of truth)
│   ├── seed.ts                # Database seeding (users, teams, boards)
│   └── migrations/            # Auto-generated migration files
├── src/
│   ├── app.ts                 # Express app setup (middleware, routes)
│   ├── server.ts              # Entry point (starts HTTP server)
│   ├── controllers/           # Business logic handlers
│   │   ├── auth.controller.ts
│   │   ├── board.controller.ts
│   │   ├── dashboard.controller.ts
│   │   ├── notification.controller.ts
│   │   ├── project.controller.ts
│   │   ├── team.controller.ts
│   │   ├── upload.controller.ts
│   │   └── user.controller.ts
│   ├── routes/                # Express route definitions (thin)
│   ├── middlewares/
│   │   └── auth.middleware.ts # JWT auth + role authorization
│   ├── types/
│   │   └── index.ts           # Shared TypeScript interfaces
│   └── utils/
│       ├── env.ts             # Environment variable validation
│       ├── jwt.ts             # Token sign/verify helpers
│       ├── r2.ts              # Cloudflare R2 (S3) client
│       └── validators.ts      # Input validation schemas (zod)
├── .env                       # Environment variables (DO NOT COMMIT)
├── .env.example               # Template for env vars
├── package.json
└── tsconfig.json
```

## Commands

```bash
npm run dev              # Start with nodemon (hot reload)
npm run build            # Compile TypeScript to dist/
npm run start            # Run compiled JS (production)
npm run seed             # Seed DB with users/teams/boards
npm run prisma:generate  # Regenerate Prisma client
npm run prisma:migrate   # Create and apply migrations
npm run prisma:studio    # Open Prisma Studio GUI
```

## Key Patterns

### Controller Pattern
All controllers follow this pattern:
```typescript
export const getProjects = async (req: AuthRequest, res: Response) => {
  try {
    // 1. Extract user from req.user (set by auth middleware)
    // 2. Query with Prisma
    // 3. Return { success: true, data: ... }
  } catch (error) {
    // Return { success: false, message: ... }
  }
};
```

### Route Pattern
Routes are thin — they just wire middleware to controllers:
```typescript
router.get('/', authenticate, controller.getAll);
router.post('/', authenticate, authorizeRoles('PM', 'TL'), controller.create);
```

### Auth Middleware
- `authenticate` — verifies JWT, attaches `req.user`
- `authorizeRoles(...roles)` — checks `req.user.role` against allowed roles

### Response Format
Always return:
```json
{ "success": true, "message": "...", "data": { ... } }
{ "success": false, "message": "Error description" }
```

## Database

### Prisma Schema Key Points
- All models use `@@map("snake_case_table")` for PostgreSQL table names
- IDs are UUIDs via `@default(uuid())`
- `Project.status` is a **string** (references `BoardColumn.key`), not an enum
- `User.username` is unique and follows `role.name` format
- Relations use explicit foreign key fields (e.g., `pmId` + `pm`)

### Adding a New Model
1. Add model to `prisma/schema.prisma`
2. Run `npx prisma migrate dev --name description_of_change`
3. Run `npx prisma generate`
4. Create controller in `src/controllers/`
5. Create route file in `src/routes/`
6. Register route in `src/app.ts`

## PRODUCTION Role Data Access

When querying projects or other team-scoped data, **PRODUCTION** users must see data from ALL teams:

```typescript
// Pattern used in controllers:
if (user.role === 'PRODUCTION') {
  // No team filter — return all projects
} else {
  // Filter by user's team membership
}
```

This logic exists in `project.controller.ts` and `dashboard.controller.ts`. Any new data endpoints that are team-scoped must follow this same pattern.

## Validation

Input validation uses **Zod** schemas defined in `src/utils/validators.ts`. Always validate request bodies before processing.

## File Uploads

Files are uploaded to **Cloudflare R2** (S3-compatible). The R2 client is in `src/utils/r2.ts`. Upload flow:
1. Frontend sends file to `/api/upload`
2. Backend uploads to R2 bucket
3. Returns public URL for the file
