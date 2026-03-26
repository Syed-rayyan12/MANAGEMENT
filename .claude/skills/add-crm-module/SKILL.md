---
name: Add CRM Module
description: Comprehensive workflow to add a new CRM module (HR, Sales, Finance, etc.) including database models, backend API, frontend pages, and navigation.
---

# Add CRM Module

ProManage is evolving from a project management tool into a full CRM. Use this skill when adding a new module such as:

- **HR Module** — Salary calculation, attendance tracking
- **Sales Module** — Client invoicing, Stripe payments, invoice tracking
- **Finance Module** — Payment reports, revenue dashboards

## Architecture for New Modules

Each CRM module should follow the same layered architecture:

```
backend/
  prisma/schema.prisma          ← Add models here
  src/controllers/<module>.controller.ts
  src/routes/<module>.routes.ts
  src/utils/validators.ts       ← Add validation schemas

frontend/
  app/dashboard/<module>/page.tsx
  app/dashboard/<module>/[subpage]/page.tsx
  components/<module>/           ← Module-specific components
  lib/types.ts                  ← Add TypeScript types
```

## Step-by-Step

### 1. Design the Data Model

Plan which Prisma models you need. All modules share the core entities:

- `Organization` — top-level tenant
- `Team` — department/team grouping
- `User` — employees (with `UserRole` enum)

**Example: HR Module models**
```prisma
model Attendance {
  id        String   @id @default(uuid())
  date      DateTime
  checkIn   DateTime
  checkOut  DateTime?
  status    AttendanceStatus @default(PRESENT)
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  createdAt DateTime @default(now())

  @@unique([userId, date])
  @@map("attendance")
}

model SalaryRecord {
  id          String   @id @default(uuid())
  month       Int
  year        Int
  baseSalary  Float
  deductions  Float    @default(0)
  bonus       Float    @default(0)
  netSalary   Float
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  paidAt      DateTime?
  createdAt   DateTime @default(now())

  @@unique([userId, month, year])
  @@map("salary_records")
}

enum AttendanceStatus {
  PRESENT
  ABSENT
  LATE
  HALF_DAY
  LEAVE
}
```

**Example: Sales Module models**
```prisma
model Client {
  id        String    @id @default(uuid())
  name      String
  email     String    @unique
  company   String?
  phone     String?
  invoices  Invoice[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  @@map("clients")
}

model Invoice {
  id          String        @id @default(uuid())
  number      String        @unique
  amount      Float
  currency    String        @default("USD")
  status      InvoiceStatus @default(DRAFT)
  dueDate     DateTime
  paidAt      DateTime?
  stripeId    String?       // Stripe payment intent ID
  clientId    String
  client      Client        @relation(fields: [clientId], references: [id])
  createdById String
  createdBy   User          @relation(fields: [createdById], references: [id])
  items       InvoiceItem[]
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  @@map("invoices")
}

enum InvoiceStatus {
  DRAFT
  SENT
  PAID
  OVERDUE
  CANCELLED
}
```

### 2. Add Models and Migrate

1. Add models to `backend/prisma/schema.prisma`
2. Add reverse relations on `User` model
3. Run: `npx prisma migrate dev --name add_<module>_module`
4. Run: `npx prisma generate`
5. Optionally add new enum to `UserRole` if the module needs new roles

### 3. Add Validation Schemas

Add Zod schemas in `backend/src/utils/validators.ts`:

```typescript
export const createAttendanceSchema = z.object({
  date: z.string().datetime(),
  checkIn: z.string().datetime(),
  checkOut: z.string().datetime().optional(),
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'LEAVE']).optional(),
});
```

### 4. Create Backend Controller and Routes

Follow the `add-api-endpoint` skill for each endpoint in the module.

**Typical module endpoints:**
```
GET    /api/<module>           — List all
GET    /api/<module>/:id       — Get by ID
POST   /api/<module>           — Create
PUT    /api/<module>/:id       — Update
DELETE /api/<module>/:id       — Delete
GET    /api/<module>/stats     — Module dashboard stats
```

### 5. Register Routes in app.ts

```typescript
import moduleRoutes from './routes/<module>.routes';
app.use('/api/<module>', moduleRoutes);
```

### 6. Add Frontend Types

Update `frontend/lib/types.ts` with TypeScript interfaces:

```typescript
export interface Attendance {
  id: string;
  date: string;
  checkIn: string;
  checkOut?: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY' | 'LEAVE';
  user: { id: string; name: string; role: string };
}
```

### 7. Add API Service Methods

Update `frontend/lib/api-service.ts` if needed, or use existing generic methods:

```typescript
// Typically just use the existing apiService
const attendance = await apiService.get('/attendance');
const result = await apiService.post('/attendance', data);
```

### 8. Create Frontend Pages

Follow the `add-frontend-page` skill. Typical module pages:

```
app/dashboard/<module>/page.tsx          — Module dashboard/list
app/dashboard/<module>/[id]/page.tsx     — Detail view
```

### 9. Create Module Components

```
components/<module>/
  ├── <Module>Table.tsx      — Data table for listing
  ├── <Module>Form.tsx       — Create/edit form
  ├── <Module>Stats.tsx      — Dashboard stat cards
  └── <Module>Modal.tsx      — Detail/edit modal
```

### 10. Add Navigation

Update sidebar navigation in `frontend/components/layout/` to include the new module link.

### 11. Add Role Permissions

Update `frontend/hooks/usePermissions.ts` with module-specific permissions:

```typescript
const canManageAttendance = user?.role === 'TL' || user?.role === 'PM';
const canViewSalary = user?.role === 'TL' || user?.role === 'EXECUTIVE';
```

## Integration Points (Future)

### Stripe (for Sales Module)
- Install: `npm install stripe` (backend)
- Create a `backend/src/utils/stripe.ts` utility
- Use Stripe Checkout or Payment Intents for invoice payments
- Store `stripeId` on Invoice model for tracking

### Email Notifications
- Consider adding email support for invoice sending
- Create a `backend/src/utils/email.ts` utility

## Checklist

- [ ] Data models designed and added to `schema.prisma`
- [ ] Reverse relations added on existing models (User, Team, etc.)
- [ ] Migration run and Prisma client regenerated
- [ ] Validation schemas added
- [ ] Backend controller created with PRODUCTION role handling
- [ ] Routes created and registered in `app.ts`
- [ ] Frontend types defined
- [ ] Frontend pages created
- [ ] Module components built with shadcn/ui
- [ ] Navigation updated
- [ ] Role permissions defined
- [ ] Seed data added (if needed)
