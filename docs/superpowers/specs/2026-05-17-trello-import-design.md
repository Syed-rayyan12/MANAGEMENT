# Trello Import Feature — Design Spec

## Overview

Add a permanent Trello import feature to XRM that allows importing projects from a Trello board into XRM. The feature is restricted to a single user (`prod.tahiranwar`) to prevent accidental data corruption.

## Scope

This spec covers:
1. Trello import backend (API endpoint + Trello API integration)
2. Trello import frontend (UI page)
3. Seed data update (single team, real user roster)

---

## Backend

### Schema Change

Add `trelloCardId` to the `Project` model for duplicate detection:

```prisma
model Project {
  // ... existing fields
  trelloCardId String? @unique
}
```

This stores the Trello card's unique ID. On re-import, any card whose ID already exists in the database is skipped.

### New Route: `trello.routes.ts`

```
POST /api/trello/import
```

- Protected by `authenticate` middleware
- Hardcoded authorization: only `prod.tahiranwar` can access (HTTP 403 for all others)

```
GET /api/trello/boards
```

- Same authorization
- Accepts `apiKey` and `token` as query params
- Proxies to Trello API to fetch available boards for the user to select from

### New Controller: `trello.controller.ts`

#### `getTrelloBoards`

1. Accept `apiKey` + `token` from query params
2. Call `GET https://api.trello.com/1/members/me/boards?fields=name,id,url`
3. Return list of boards: `{ success: true, data: { boards: [{ id, name, url }] } }`

#### `importFromTrello`

1. Accept `apiKey`, `token`, `trelloBoardId` from request body
2. Fetch board data from Trello API:
   - `GET /1/boards/{id}?lists=all&cards=all&card_fields=name,desc,labels,due,idList,idMembers,closed`
3. Filter out closed cards
4. For each Trello list, determine the XRM board using keyword matching:

| Trello List Contains | XRM Board (slug) |
|---|---|
| "logo" | logo-design |
| "website design" or "design" (not "logo") | web-design |
| "development" or "dev" | web-development |
| "content" | content |
| "seo" | seo (create if missing) |
| "social media" | social-media (create if missing) |
| "disputed" | skip or assign to detected board from card name prefix |
| "rush revision" | skip or assign to detected board from card name prefix |

5. For ambiguous lists (Disputed, Rush Revision), try to detect board from card name prefix:
   - Card name starts with "Logo:" → logo-design
   - Card name starts with "Website:" → web-development
   - Otherwise → web-design (fallback)

6. Auto-create missing boards (SEO, Social Media) with default columns (Todo, In Progress, Completed, Revisions)

7. For each card:
   - Check if `trelloCardId` exists in DB → skip if yes
   - Create project:
     - `name`: Trello card name
     - `description`: Trello card description (raw, as-is)
     - `status`: "todo"
     - `priority`: "MEDIUM" (default), or "HIGH" if card has "urgent" label
     - `dueDate`: Trello card due date (if set)
     - `boardId`: resolved XRM board ID
     - `teamId`: the single "Xpert Web Studio" team ID
     - `trelloCardId`: Trello card ID
     - No assignments

8. Return summary:
```json
{
  "success": true,
  "message": "Import completed",
  "data": {
    "imported": 45,
    "skipped": 268,
    "failed": 0,
    "newBoards": ["SEO", "Social Media"],
    "details": [
      { "name": "Card Name", "board": "Logo Design", "status": "imported" },
      { "name": "Card Name 2", "board": "Web Design", "status": "skipped" }
    ]
  }
}
```

### Authorization

Hardcoded to `prod.tahiranwar`:

```typescript
if (req.user.username !== 'prod.tahiranwar') {
  return res.status(403).json({ success: false, message: 'Unauthorized' });
}
```

---

## Frontend

### New Page: `/dashboard/import`

Only visible in the sidebar for `prod.tahiranwar`.

#### UI Flow

1. **Connect** — Two input fields: Trello API Key, Trello Token. "Fetch Boards" button.
2. **Select** — Dropdown of Trello boards returned from the API. "Import" button.
3. **Progress** — Loading state during import.
4. **Results** — Summary card showing: imported count, skipped count, any new boards created.

#### Components

- `ImportPage` — the page component at `app/dashboard/import/page.tsx`
- Reuse existing shadcn/ui components (Input, Button, Select, Card)
- No new shared components needed

#### Sidebar Visibility

In `Sidebar.tsx`, conditionally render the "Import" nav item:

```typescript
{currentUser?.username === 'prod.tahiranwar' && (
  <NavItem href="/dashboard/import" icon={Import} label="Trello Import" />
)}
```

---

## Seed Data Update

### Team

Replace Team 1 and Team 2 with a single team:

- **Name**: Xpert Web Studio
- **Slug**: xpert-web-studio

### Users

| Username | Role | Specialization |
|---|---|---|
| tl.ali | TL | - |
| pm.rehan | PM | - |
| pm.mujtaba | PM | - |
| pm.anas | PM | - |
| pm.aqsa | PM | - |
| prod.aqsa | PRODUCTION | LOGO_DESIGNER |
| prod.abubakr | PRODUCTION | LOGO_DESIGNER |
| prod.arshanhasan | PRODUCTION | FIGMA_DESIGNER |
| prod.syedtaha | PRODUCTION | FIGMA_DESIGNER |
| prod.syedrayyan | PRODUCTION | DEVELOPER |
| prod.muslimraza | PRODUCTION | DEVELOPER |
| prod.qasimrizvi | PRODUCTION | DEVELOPER |
| prod.akbar | PRODUCTION | DEVELOPER |
| prod.muhammadbinsaud | PRODUCTION | DEVELOPER |
| prod.tahiranwar | PRODUCTION | - |
| exec.maarijsaud | EXECUTIVE | - |
| exec.khizarfaiz | EXECUTIVE | - |
| exec.babarkhan | EXECUTIVE | - |

All users: password `password123`, added to "Xpert Web Studio" team via TeamMember.

### Boards (unchanged)

- Logo Design (logo-design)
- Web Design (web-design)
- Web Development (web-development)
- Content Creation (content)

Each with default columns: Todo, In Progress, Completed, Revisions.

---

## Non-Goals

- No ongoing Trello sync (one-direction import only, triggered manually)
- No client record creation from Trello data (descriptions imported as-is)
- No assignment mapping from Trello members to XRM users
- No Trello credential storage in database (entered each time in the UI)
- No UI rename from ProManage to XRM (separate task)
