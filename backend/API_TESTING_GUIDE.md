# API Testing Guide - Workspace Integration

## Step 1: Login to Get Token

**Endpoint:** `POST http://localhost:5000/api/auth/login`

**Headers:**
```json
{
  "Content-Type": "application/json"
}
```

**Body:**
```json
{
  "username": "pm.azharrajput",
  "password": "password123"
}
```

**Note:** All usernames now use role-based prefixes:
- PM: `pm.username`
- TL: `tl.username`
- Executive: `exec.username`
- Production: `prod.username`

**Expected Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "user-id-here",
      "name": "Azhar Rajput",
      "email": "pm1@company.com",
      "role": "PM"
    },
    "token": "your-jwt-token-here"
  }
}
```

**Copy the `token` value for next requests!**

---

## Step 2: Create a Logo Design Project

**Endpoint:** `POST http://localhost:5000/api/projects`

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer YOUR_TOKEN_HERE"
}
```

**Body:**
```json
{
  "name": "Company Logo Design",
  "workspace": "LOGO",
  "description": "Create a modern logo for tech startup",
  "priority": "HIGH",
  "dueDate": "2026-03-01"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Project created successfully in LOGO workspace",
  "data": {
    "project": {
      "id": "project-id-here",
      "name": "Company Logo Design",
      "status": "TODO",
      "priority": "HIGH",
      "description": "Create a modern logo for tech startup",
      "dueDate": "2026-03-01T00:00:00.000Z",
      "pmId": "your-user-id",
      "developerId": null,
      "createdAt": "timestamp",
      "updatedAt": "timestamp"
    }
  }
}
```

---

## Step 3: Get All Logo Design Projects

**Endpoint:** `GET http://localhost:5000/api/projects/logo-design`

**Headers:**
```json
{
  "Authorization": "Bearer YOUR_TOKEN_HERE"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Logo design projects retrieved successfully",
  "data": {
    "projects": [
      {
        "id": "project-id-here",
        "name": "Company Logo Design",
        "status": "TODO",
        "priority": "HIGH",
        "description": "Create a modern logo for tech startup",
        "dueDate": "2026-03-01T00:00:00.000Z",
        "pmId": "your-user-id",
        "developerId": null,
        "createdAt": "timestamp",
        "updatedAt": "timestamp"
      }
    ]
  }
}
```

---

## All Workspace Endpoints

### Logo Design
- **GET** `http://localhost:5000/api/projects/logo-design`

### Web Design
- **GET** `http://localhost:5000/api/projects/web-design`

### Web Development
- **GET** `http://localhost:5000/api/projects/web-development`

### Content Writer
- **GET** `http://localhost:5000/api/projects/content-writer`

---

## Create Projects for Different Workspaces

### Web Design Project
```json
{
  "name": "E-commerce Website UI",
  "workspace": "WEB_DESIGN",
  "description": "Design modern e-commerce interface",
  "priority": "MEDIUM"
}
```

### Web Development Project
```json
{
  "name": "REST API Development",
  "workspace": "WEB_DEVELOPMENT",
  "description": "Build backend API",
  "priority": "HIGH"
}
```

### Content Writer Project
```json
{
  "name": "Blog Post Series",
  "workspace": "CONTENT",
  "description": "Write 10 blog posts about web development",
  "priority": "MEDIUM"
}
```

---

## Dashboard API

**Endpoint:** `GET http://localhost:5000/api/dashboard/overview`

**Headers:**
```json
{
  "Authorization": "Bearer YOUR_TOKEN_HERE"
}
```

**Response:** Shows counts for all 4 workspaces
```json
{
  "success": true,
  "data": {
    "workspaceStats": {
      "logoDesign": 1,
      "webDesign": 0,
      "webDevelopment": 0,
      "contentWriter": 0
    },
    "statusStats": { ... },
    "priorityStats": { ... },
    "totalProjects": 1
  }
}
```

---

## Frontend Integration Example

```typescript
// Login and store token
const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'azharrajput', password: 'password123' })
});
const { data } = await loginResponse.json();
const token = data.token;
localStorage.setItem('token', token);

// Fetch Logo Design projects
const logoProjects = await fetch('http://localhost:5000/api/projects/logo-design', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { data: { projects } } = await logoProjects.json();
console.log('Logo Design Projects:', projects);

// Create a new project
const createResponse = await fetch('http://localhost:5000/api/projects', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    name: 'New Logo Design',
    workspace: 'LOGO',
    description: 'Design a logo',
    priority: 'HIGH'
  })
});
const { data: { project } } = await createResponse.json();
console.log('Created Project:', project);
```

---

## Important Notes

1. **Always include the `Authorization` header** with your JWT token for protected routes
2. **Workspace values must be**: `LOGO`, `WEB_DESIGN`, `WEB_DEVELOPMENT`, or `CONTENT`
3. **Only PM users** can create and delete projects
4. **PM and TL users** can update projects
5. Projects are automatically saved to the correct workspace table based on the `workspace` field
6. Each workspace has its own dedicated database table:
   - `logo_design_projects`
   - `web_design_projects`
   - `web_development_projects`
   - `content_writer_projects`
