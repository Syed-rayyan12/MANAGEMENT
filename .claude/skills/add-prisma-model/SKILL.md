---
name: Add Prisma Model
description: Step-by-step workflow to add a new Prisma model, run migrations, generate the client, and wire it into the backend.
---

# Add Prisma Model

Follow these steps to add a new database model to the ProManage system.

## Steps

### 1. Define the Model in schema.prisma

Edit `backend/prisma/schema.prisma`. Follow existing conventions:

```prisma
model NewModel {
  id        String   @id @default(uuid())
  name      String
  // ... fields

  // Foreign keys (explicit field + relation)
  userId    String
  user      User     @relation(fields: [userId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("new_models")   // Always snake_case table name
}
```

### 2. Add Reverse Relations

If you reference existing models (User, Project, Team, etc.), add the reverse relation on the other model:

```prisma
model User {
  // ... existing fields
  newModels  NewModel[]   // Add this line
}
```

### 3. Run Migration

```bash
cd backend
npx prisma migrate dev --name add_new_model
```

This will:
- Generate a SQL migration file in `prisma/migrations/`
- Apply it to your local database
- Regenerate the Prisma client

### 4. Regenerate Client (if migration didn't)

```bash
npx prisma generate
```

### 5. Use in Controller

```typescript
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Create
const item = await prisma.newModel.create({ data: { ... } });

// Find with relations
const items = await prisma.newModel.findMany({
  include: { user: { select: { id: true, name: true, role: true } } }
});
```

## Conventions

| Convention | Example |
|-----------|---------|
| Model name | `PascalCase` — `ChecklistItem` |
| Table mapping | `snake_case` — `@@map("checklist_items")` |
| ID field | `String @id @default(uuid())` |
| Timestamps | `createdAt DateTime @default(now())` + `updatedAt DateTime @updatedAt` |
| Foreign keys | Explicit field: `userId String` + relation: `user User @relation(...)` |
| Enums | `UPPER_CASE` values — `enum ProjectPriority { LOW MEDIUM HIGH CRITICAL }` |

## Existing Enums (reuse these)

- `UserRole` — `TL`, `PM`, `PRODUCTION`, `EXECUTIVE`
- `ProjectPriority` — `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`

## Key Rules

1. **Project.status is a string**, not an enum — it references `BoardColumn.key`
2. Always use `@@map()` to define the PostgreSQL table name
3. Use `onDelete: Cascade` for child relations that should be deleted with the parent
4. Use `onDelete: SetNull` for optional references (like `ActivityLog.projectId`)
5. Always add both sides of a relation
6. Run `npx prisma generate` after ANY schema change before using new types

## Adding to Seed Data

If the new model needs seed data, update `backend/prisma/seed.ts`:

```typescript
// Add after existing seed logic
await prisma.newModel.createMany({
  data: [
    { name: 'Example', userId: someUser.id },
  ],
});
```

Then run: `npm run seed`

## Checklist

- [ ] Model defined in `schema.prisma` with proper conventions
- [ ] Reverse relations added on referenced models
- [ ] Migration run successfully (`npx prisma migrate dev`)
- [ ] Prisma client regenerated
- [ ] Seed data added (if applicable)
- [ ] Controller and routes created (use `add-api-endpoint` skill)
