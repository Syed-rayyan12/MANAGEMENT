---
name: Add API Endpoint
description: Step-by-step workflow to create a new backend API endpoint with controller, route, validation, and registration in Express app.
---

# Add API Endpoint

Follow these steps to add a new REST API endpoint to the ProManage backend.

## Steps

### 1. Create or Update Validation Schema

If the endpoint accepts a request body, add a Zod schema in `backend/src/utils/validators.ts`:

```typescript
export const createThingSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  // ... other fields
});
```

### 2. Create the Controller

Create a new file `backend/src/controllers/<name>.controller.ts` or add to an existing one:

```typescript
import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../types';

const prisma = new PrismaClient();

export const getAll = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    
    // IMPORTANT: If data is team-scoped, handle PRODUCTION role cross-team visibility
    if (user.role === 'PRODUCTION') {
      // No team filter — return ALL data
    } else {
      // Filter by user's team membership
    }

    return res.json({ success: true, message: 'Fetched successfully', data: result });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const create = async (req: AuthRequest, res: Response) => {
  try {
    // Validate input with zod
    // Create with Prisma
    // Return { success: true, data: created }
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
```

### 3. Create the Route File

Create `backend/src/routes/<name>.routes.ts`:

```typescript
import { Router } from 'express';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';
import * as controller from '../controllers/<name>.controller';

const router = Router();

router.get('/', authenticate, controller.getAll);
router.get('/:id', authenticate, controller.getById);
router.post('/', authenticate, authorizeRoles('PM', 'TL'), controller.create);
router.put('/:id', authenticate, authorizeRoles('PM', 'TL'), controller.update);
router.delete('/:id', authenticate, authorizeRoles('PM', 'TL'), controller.remove);

export default router;
```

### 4. Register in app.ts

Add the route import and registration in `backend/src/app.ts`:

```typescript
import nameRoutes from './routes/<name>.routes';
// ...
app.use('/api/<name>', nameRoutes);
```

### 5. Test

Test the endpoint with curl or Postman:
```bash
# Login first to get token
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "pm.azharrajput", "password": "password123"}'

# Use the token
curl http://localhost:5000/api/<name> \
  -H "Authorization: Bearer <token>"
```

## Checklist

- [ ] Validation schema added (if needed)
- [ ] Controller created with try/catch and standard response format
- [ ] PRODUCTION role cross-team visibility handled (if team-scoped)
- [ ] Route file created with proper middleware (authenticate + authorizeRoles)
- [ ] Route registered in `app.ts`
- [ ] Tested with valid and invalid inputs

## Common Mistakes

1. **Forgetting PRODUCTION role** — always check if data should be visible cross-team
2. **Missing authentication** — always use `authenticate` middleware
3. **Inconsistent response format** — always return `{ success, message, data }`
4. **Not validating input** — use Zod schemas for all request bodies
