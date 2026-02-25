# ProManage API Documentation

## Base URL
```
http://localhost:5000/api
```

---

## Authentication Required
All endpoints below require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

---

## Dashboard APIs

### 1. Get Dashboard Overview
Get statistics for all workspace types (Logo Design, Web Design, Web Development, Content Writer)

**Endpoint:** `GET /api/dashboard/overview`

**Response:**
```json
{
  "success": true,
  "message": "Dashboard overview retrieved successfully",
  "data": {
    "workspaceStats": {
      "logoDesign": 5,
      "webDesign": 8,
      "webDevelopment": 12,
      "contentWriter": 3
    },
    "statusStats": {
      "todo": 10,
      "inProgress": 12,
      "completed": 5,
      "revisions": 1
    },
    "priorityStats": {
      "low": 3,
      "medium": 15,
      "high": 8,
      "critical": 2
    },
    "totalProjects": 28,
    "recentProjects": [...]
  }
}
```

### 2. Get My Dashboard Stats
Get user-specific statistics (managed and assigned projects)

**Endpoint:** `GET /api/dashboard/my-stats`

**Response:**
```json
{
  "success": true,
  "message": "User dashboard stats retrieved successfully",
  "data": {
    "managedProjects": {
      "total": 5,
      "projects": [...]
    },
    "assignedProjects": {
      "total": 3,
      "projects": [...]
    }
  }
}
```

---

## Project APIs by Workspace Type

### 3. Get Logo Design Projects
**Endpoint:** `GET /api/projects/logo-design`

**Response:**
```json
{
  "success": true,
  "message": "LOGO projects retrieved successfully",
  "data": {
    "projects": [
      {
        "id": "uuid",
        "name": "Company Logo Design",
        "workspace": "LOGO",
        "status": "IN_PROGRESS",
        "priority": "HIGH",
        "description": "Design a modern logo",
        "dueDate": "2026-03-01T00:00:00.000Z",
        "image": "https://example.com/image.jpg",
        "pmId": "uuid",
        "developerId": "uuid",
        "createdAt": "2026-02-19T00:00:00.000Z",
        "updatedAt": "2026-02-19T00:00:00.000Z",
        "pm": {
          "id": "uuid",
          "name": "Azhar Rajput",
          "email": "pm1@company.com",
          "role": "PM"
        },
        "developer": {
          "id": "uuid",
          "name": "Abubakar Siddiqui",
          "email": "prod1@company.com",
          "role": "PRODUCTION"
        }
      }
    ]
  }
}
```

### 4. Get Web Design Projects
**Endpoint:** `GET /api/projects/web-design`

### 5. Get Web Development Projects
**Endpoint:** `GET /api/projects/web-development`

### 6. Get Content Writer Projects
**Endpoint:** `GET /api/projects/content-writer`

---

## Project CRUD Operations

### 7. Get All Projects
**Endpoint:** `GET /api/projects`

**Response:**
```json
{
  "success": true,
  "message": "Projects retrieved successfully",
  "data": {
    "projects": [...]
  }
}
```

### 8. Get Project by ID
**Endpoint:** `GET /api/projects/:id`

Get detailed information about a specific project for viewing in modal or detail page.

**Response:**
```json
{
  "success": true,
  "message": "Project retrieved successfully",
  "data": {
    "project": {
      "id": "uuid",
      "name": "Company Logo Design",
      "workspace": "LOGO",
      "status": "IN_PROGRESS",
      "priority": "HIGH",
      "description": "Design a modern logo",
      "dueDate": "2026-03-01T00:00:00.000Z",
      "image": "https://example.com/image.jpg",
      "pmId": "uuid",
      "developerId": "uuid",
      "createdAt": "2026-02-19T00:00:00.000Z",
      "updatedAt": "2026-02-19T00:00:00.000Z",
      "pm": {
        "id": "uuid",
        "name": "Azhar Rajput",
        "email": "pm1@company.com",
        "role": "PM"
      },
      "developer": {
        "id": "uuid",
        "name": "Abubakar Siddiqui",
        "email": "prod1@company.com",
        "role": "PRODUCTION"
      }
    }
  }
}
```

### 9. Create New Project
**Endpoint:** `POST /api/projects`

**Request Body:**
```json
{
  "name": "New Website Design",
  "workspace": "WEB_DESIGN",
  "description": "Create a modern responsive website",
  "priority": "HIGH",
  "dueDate": "2026-03-15",
  "pmId": "uuid-of-pm",
  "developerId": "uuid-of-developer",
  "image": "https://example.com/image.jpg"
}
```

**Workspace Types:**
- `LOGO` - Logo Design
- `WEB_DESIGN` - Web Design
- `WEB_DEVELOPMENT` - Web Development
- `CONTENT` - Content Writer

**Priority Levels:**
- `LOW`
- `MEDIUM`
- `HIGH`
- `CRITICAL`

**Status Types (auto-set to TODO on creation):**
- `TODO`
- `IN_PROGRESS`
- `COMPLETED`
- `REVISIONS`

**Response:**
```json
{
  "success": true,
  "message": "Project created successfully",
  "data": {
    "project": {...}
  }
}
```

### 10. Update Project
**Endpoint:** `PUT /api/projects/:id`

**Request Body:** (All fields optional)
```json
{
  "name": "Updated Project Name",
  "status": "IN_PROGRESS",
  "priority": "CRITICAL",
  "description": "Updated description",
  "dueDate": "2026-04-01",
  "developerId": "new-developer-uuid",
  "image": "https://example.com/new-image.jpg"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Project updated successfully",
  "data": {
    "project": {...}
  }
}
```

### 11. Delete Project
**Endpoint:** `DELETE /api/projects/:id`

**Response:**
```json
{
  "success": true,
  "message": "Project deleted successfully"
}
```

---

## Example Usage with cURL

### Get Dashboard Overview
```bash
curl -X GET http://localhost:5000/api/dashboard/overview \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Create Logo Design Project
```bash
curl -X POST http://localhost:5000/api/dashboard/projects \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Modern Logo",
    "workspace": "LOGO",
    "description": "Create a sleek modern logo",
    "priority": "HIGH",
    "pmId": "your-pm-id",
    "developerId": "your-developer-id"
  }'
```

### Get Web Development Projects
```bash
curl -X GET http://localhost:5000/api/projects/web-development \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Name, workspace, and PM ID are required"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "User not authenticated"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Internal server error"
}
```

---

## Database Schema

### Project Model
```prisma
model Project {
  id          String          @id @default(uuid())
  name        String
  workspace   WorkspaceType   // LOGO, WEB_DESIGN, WEB_DEVELOPMENT, CONTENT
  status      ProjectStatus   @default(TODO)
  priority    ProjectPriority @default(MEDIUM)
  description String?
  dueDate     DateTime?
  image       String?
  pmId        String
  developerId String?
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt
  
  pm          User            @relation("ProjectManager")
  developer   User?           @relation("AssignedDeveloper")
}
```

---

## Integration with Kanban Board

When you create a project through the API, it will automatically be categorized by its workspace type:
- **Logo Design projects** → `workspace: "LOGO"`
- **Web Design projects** → `workspace: "WEB_DESIGN"`
- **Web Development projects** → `workspace: "WEB_DEVELOPMENT"`
- **Content Writer projects** → `workspace: "CONTENT"`

Fetch projects for your kanban board using the workspace-specific endpoints to display them in the correct column/board.

---

## Dashboard to Kanban Board Workflow

### Step 1: Display Dashboard Cards
Call `GET /api/dashboard/overview` to display 4 cards:
- **Logo Design** - Shows count of logo design projects
- **Web Design** - Shows count of web design projects
- **Web Development** - Shows count of web development projects
- **Content Writer** - Shows count of content writer projects

### Step 2: Click Card to Open Kanban Board
When user clicks any of the 4 cards:
- **Logo Design Card** → Call `GET /api/projects/logo-design`
- **Web Design Card** → Call `GET /api/projects/web-design`
- **Web Development Card** → Call `GET /api/projects/web-development`
- **Content Writer Card** → Call `GET /api/projects/content-writer`

### Step 3: Display Projects in Kanban Board
The response will contain all projects for that workspace type. Group them by status:
- **TODO Column** → Projects with `status: "TODO"`
- **IN_PROGRESS Column** → Projects with `status: "IN_PROGRESS"`
- **COMPLETED Column** → Projects with `status: "COMPLETED"`
- **REVISIONS Column** → Projects with `status: "REVISIONS"`

### Step 4: View Project Details
When user clicks on a project card in the kanban board:
- Call `GET /api/projects/:id` with the project ID
- Display project information including:
  - Project name
  - Description
  - Workspace type
  - Status
  - Priority
  - Due date
  - Image
  - Project Manager (PM) details
  - Developer details
  - Created and updated timestamps

### Step 5: Add New Project from Modal
When user clicks "Add Project" button:
- Show modal/form with fields:
  - Name (required)
  - Workspace (required) - Select from: LOGO, WEB_DESIGN, WEB_DEVELOPMENT, CONTENT
  - Description
  - Priority (default: MEDIUM)
  - Due Date
  - PM ID (required)
  - Developer ID
  - Image URL

- On submit, call `POST /api/projects` with the form data
- New project will appear in the kanban board

### Step 6: Update Project
When user edits a project:
- Call `PUT /api/projects/:id` with updated fields
- Update the kanban board to reflect changes
- If status is changed, move the card to the appropriate column

### Step 7: Delete Project
When user deletes a project:
- Call `DELETE /api/projects/:id`
- Remove the card from the kanban board

---

## Example Frontend Flow

```javascript
// 1. Get dashboard overview
const dashboardData = await fetch('/api/dashboard/overview', {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(res => res.json());

// Display 4 cards with counts
console.log(dashboardData.data.workspaceStats);
// { logoDesign: 5, webDesign: 8, webDevelopment: 12, contentWriter: 3 }

// 2. User clicks "Web Development" card
const webDevProjects = await fetch('/api/projects/web-development', {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(res => res.json());

// 3. Organize projects by status for kanban columns
const todoProjects = webDevProjects.data.projects.filter(p => p.status === 'TODO');
const inProgressProjects = webDevProjects.data.projects.filter(p => p.status === 'IN_PROGRESS');
const completedProjects = webDevProjects.data.projects.filter(p => p.status === 'COMPLETED');
const revisionsProjects = webDevProjects.data.projects.filter(p => p.status === 'REVISIONS');

// 4. User clicks a project card - Show project details
const projectDetails = await fetch(`/api/projects/${projectId}`, {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(res => res.json());

console.log(projectDetails.data.project);
// Full project info with PM and developer details

// 5. User creates new project
const newProject = await fetch('/api/projects', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'E-commerce Website',
    workspace: 'WEB_DEVELOPMENT',
    description: 'Build an online store',
    priority: 'HIGH',
    pmId: 'pm-user-id',
    developerId: 'dev-user-id'
  })
}).then(res => res.json());

// 6. User updates project status (drag & drop on kanban)
await fetch(`/api/projects/${projectId}`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ status: 'IN_PROGRESS' })
});
```

