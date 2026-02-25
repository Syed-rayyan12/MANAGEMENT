# ProManage Backend API

Backend server for ProManage - Enterprise Project Management System built with Node.js, TypeScript, PostgreSQL, and Prisma.

## Features

- ✅ **Authentication System** with JWT (Login Only)
- ✅ **Predefined Users**: 3 PM, 2 TL, Executives & Production (expandable)
- ✅ **4 User Roles**: PM (Project Manager), TL (Team Lead), Executive, Production
- ✅ **TypeScript** for type safety
- ✅ **Prisma ORM** for database management
- ✅ **PostgreSQL** database
- ✅ **Role-based Access Control**

## Tech Stack

- **Runtime**: Node.js
- **Language**: TypeScript
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: JWT + bcrypt
- **Framework**: Express.js

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v14 or higher)
- pnpm (or npm/yarn)

### Installation

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

4. Update `.env` with your database credentials:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/promanage_db?schema=public"
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
JWT_EXPIRES_IN="7d"
PORT=5000
NODE_ENV="development"
CLIENT_URL="http://localhost:3000"
```

5. Generate Prisma client:
```bash
pnpm prisma:generate
```

6. Run database migrations:
```bash
pnpm prisma:migrate
```

7. Seed database with predefined users:
```bash
npm run seed
```

8. Start the development server:
```bash
pnpm dev
```

The server will run on `http://localhost:5000`

## Username Format

All users now have role-based username prefixes for better organization and uniqueness:
- PM: `pm.username` (e.g., pm.azharrajput)
- TL: `tl.username` (e.g., tl.mustufa)
- Executive: `exec.username` (e.g., exec.muhammadmarij)
- Production: `prod.username` (e.g., prod.abubakarsiddiqui)

## API Endpoints

### Authentication

#### 1. Login
- **POST** `/api/auth/login`
- **Body**:
```json
{
  "username": "pm.azharrajput",
  "password": "password123"
}
```

**Available Users:**
- **PM (3)**: pm.azharrajput, pm.aqsarathore, pm.muhammadhuzafa
- **TL (2)**: tl.mustufa, tl.ali
- **Executive**: exec.muhammadmarij, exec.tahaanwar, exec.khizerkhan, exec.babarkhan
- **Production**: prod.abubakarsiddiqui, prod.arshanhasan, prod.syedtaha, and more

**All passwords**: `password123`

See [USERS.md](./USERS.md) for complete list.

#### 2il": "user@example.com",
  "password": "password123"
}
```

#### 3. Get Current User
- **GET** `/api/auth/me`
- **Headers**: `Authorization: Bearer <token>`

### Health Check
- **GET** `/health`

## Database Schema

### User Model
```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  password  String
  role      UserRole
  name      String?
  avatar    String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

enum UserRole {
  PM          // Project Manager
  TL          // Team Lead
  EXECUTIVE   // Executive
  PRODUCTION  // Production
}
```

## Available Scripts

- `pnpm dev` - Start development server with hot reload
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm prisma:generate` - Generate Prisma client
- `pnpm prisma:migrate` - Run database migrations
- `pnpm prisma:studio` - Open Prisma Studio (GUI for database)

## Project Structure

- `npm run seed` - Seed database with predefined users
```
backend/
├── prisma/
│   └── schema.prisma         # Database schema
├── src/
│   ├── controllers/
│   │   └── auth.controller.ts   # Authentication logic
│   ├── middlewares/
│   │   └── auth.middleware.ts   # JWT authentication & authorization
│   ├── routes/
│   │   └── auth.routes.ts       # API routes
│   ├── types/
│   │   └── index.ts             # TypeScript interfaces
│   ├── utils/
│   │   └── jwt.ts               # JWT utilities
│   ├── app.ts                   # Express app configuration
│   └── server.ts                # Server entry point
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## Authentication Flow

1. **Signup**: User registers with email, password, and role
2. **Password Hashing**: Password is hashed using bcrypt (10 rounds)
3. **Predefined Users**: Database is seeded with fixed users (3 PM, 2 TL, + others)
2. **Login**: User logs in with email and password
3. **Password Verification**: Password is verified using bcrypt
4. **JWT Generation**: Upon successful login, a JWT token is generated
5. **Token Storage**: Client stores the token (localStorage/cookies)
6. **Protected Routes**: Client sends token in Authorization header for protected routes
7. **Token Verification**: Server verifies the token and extracts user info

## Adding More Users

PM and TL users are **fixed** (3 and 2 respectively).

To add more **Executive** or **Production** users:

1. Edit `prisma/seed.ts`
2. Add new users to the respective array
3. Run `npm run seed`

Example:
```typescript
const productionUsers = [
  // ... existing users
  {
    email: 'prod4@company.com',
    password,
    role: 'PRODUCTION',
    name: 'New Production User',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=NewProd',
  },
];
```

Use the `authorizeRoles` middleware to restrict routes:

```typescript
import { authenticate, authorizeRoles } from './middlewares/auth.middleware';

// Only PM and TL can access
router.get('/admin', authenticate, authorizeRoles('PM', 'TL'), controller);
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | - |
| `JWT_SECRET` | Secret key for JWT signing | - |
| `JWT_EXPIRES_IN` | JWT expiration time | `7d` |
| `PORT` | Server port | `5000` |
| `NODE_ENV` | Environment | `development` |
| `CLIENT_URL` | Frontend URL for CORS | `http://localhost:3000` |

## Error Handling

All API responses follow this format:

**Success**:
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

**Error**:
```json
{
  "success": false,
  "message": "Error description"
}
```

## Development Tips

1. **Database GUI**: Use `pnpm prisma:studio` to view/edit database
2. **Migration**: After schema changes, run `pnpm prisma:migrate`
3. **Type Safety**: Prisma auto-generates types - use them!
4. **Logging**: Check console for detailed error logs in development

## Security Best Practices

- ✅ Passwords are hashed with bcrypt
- ✅ JWT tokens for stateless authentication
- ✅ CORS configured for specific origins
- ✅ Input validation on all endpoints
- ✅ Unique email constraint
- ✅ Role-based authorization

## License

MIT
