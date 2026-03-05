# ProManage - Predefined Users

All users have the same password: **`password123`**

## Username Format
All usernames now use role-based prefixes for clarity and uniqueness:
- PM users: `pm.username`
- TL users: `tl.username`
- Executive users: `exec.username`
- Production users: `prod.username`

## 🔹 Project Managers (3 Fixed)
- **pm.azharrajput** - Azhar Rajput (pm1@company.com)
- **pm.aqsarathore** - Aqsa Rathore (pm2@company.com)
- **pm.muhammadhuzafa** - Muhammad Huzafa (pm3@company.com)

## 🔹 Team Leads (2 Fixed)
- **tl.mustufa** - Mustufa (tl1@company.com)
- **tl.ali** - Ali (tl2@company.com)

## 🔹 Executives (Can add more in seed.ts)
- **exec.muhammadmarij** - Muhammad Marij (exec1@company.com)
- **exec.tahaanwar** - Taha Anwar (exec2@company.com)
- **exec.khizerkhan** - Khizer Khan (exec3@company.com)
- **exec.babarkhan** - Babar Khan (exec4@company.com)

## 🔹 Production (Can add more in seed.ts)
- **prod.abubakarsiddiqui** - Abubakar Siddiqui (prod1@company.com)
- **prod.arshanhasan** - Arshan Hasan (prod2@company.com)
- **prod.syedtaha** - Syed Taha (prod3@company.com)
- **prod.syedmuslim** - Syed Muslim (prod4@company.com)
- **prod.syedrayyan** - Syed Rayyan (prod5@company.com)
- **prod.tahiranwar** - Tahir Anwar (prod6@company.com)
- **prod.muhammadbinsaud** - Muhammad Bin Saud (prod7@company.com)
- **prod.qasimrizvi** - Qasim Rizvi (prod8@company.com)
- **prod.syedakbar** - Syed Akbar (prod9@company.com)
- **prod.anaskhan** - Anas Khan (prod10@company.com)
- **prod.shakeebkhan** - Shakeeb Khan (prod11@company.com)

---

## Adding More Users

To add more Executive or Production users:

1. Open `prisma/seed.ts`
2. Add new users to `executiveUsers` or `productionUsers` array
3. Run: `npm run seed`

Example:
```typescript
const executiveUsers = [
  // ... existing users
  {
    email: 'exec3@company.com',
    password,
    role: 'EXECUTIVE',
    name: 'New Executive',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=NewExec',
  },
];
```

## Login API

**Endpoint:** `POST http://localhost:5000/api/auth/login`

**Body:**
```json
{
  "username": "pm.azharrajput",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid",
      "email": "pm1@company.com",
      "role": "PM",
      "name": "Azhar Rajput"
    },
    "token": "jwt_token_here"
  }
}
```

Use the token in Authorization header:
```
Authorization: Bearer <token>
```
