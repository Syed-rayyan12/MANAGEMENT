# CLAUDE.md — Frontend

Frontend-specific guidance for Claude Code. See the root `CLAUDE.md` for project-wide context.

## Architecture

```
frontend/
├── app/                       # Next.js App Router pages
│   ├── layout.tsx             # Root layout (fonts, providers)
│   ├── page.tsx               # Login page (root route)
│   ├── globals.css            # Global styles + Tailwind directives
│   └── dashboard/
│       ├── layout.tsx         # Dashboard shell (sidebar, header)
│       ├── page.tsx           # Main dashboard with workspace cards
│       ├── [workspace]/       # Dynamic workspace routes (Kanban boards)
│       └── my-work/           # User-specific work view
├── components/
│   ├── auth/                  # Login form components
│   ├── dashboard/             # Dashboard stat cards
│   ├── kanban/                # Kanban board, column, card components
│   │   ├── Board.tsx          # Main Kanban board layout
│   │   ├── Column.tsx         # Status column (droppable)
│   │   └── Card.tsx           # Project card (draggable)
│   ├── project/               # Project modals
│   │   ├── CreateProjectModal.tsx
│   │   └── ProjectModal.tsx   # View/edit project details
│   ├── layout/                # Sidebar, header, nav components
│   ├── ui/                    # shadcn/ui primitives (Button, Dialog, etc.)
│   └── theme-provider.tsx     # Dark/light mode provider
├── contexts/
│   ├── AppContext.tsx          # Global state (auth, projects, teams, etc.)
│   └── useApp.ts              # Hook to access AppContext
├── hooks/
│   ├── use-mobile.tsx         # Mobile breakpoint detection
│   ├── use-toast.ts           # Toast notification hook
│   └── usePermissions.ts     # Role-based permission checks
├── lib/
│   ├── api-service.ts         # Centralized API client (fetch wrapper)
│   ├── constants.ts           # App-wide constants
│   ├── types.ts               # TypeScript type definitions
│   └── utils.ts               # Utility functions (cn, etc.)
├── styles/                    # Additional stylesheets
├── tailwind.config.ts         # Tailwind configuration
├── next.config.mjs            # Next.js configuration
└── package.json
```

## Commands

```bash
npm run dev       # Start dev server with Turbopack (port 3000)
npm run build     # Production build
npm run start     # Start production server
npm run lint      # Run ESLint
```

## Key Patterns

### State Management
All global state lives in `contexts/AppContext.tsx`:
- Auth state (user, token, login/logout)
- Projects, teams, boards data
- Notifications
- Loading/error states

Access via:
```tsx
import { useApp } from '@/contexts/useApp';
const { user, projects, teams } = useApp();
```

### API Calls
All API calls go through `lib/api-service.ts`:
```typescript
import { apiService } from '@/lib/api-service';
const data = await apiService.get('/projects');
const result = await apiService.post('/projects', body);
```

The service auto-includes the JWT token from localStorage and prepends `NEXT_PUBLIC_API_URL`.

### Component Patterns
- **shadcn/ui** for all base UI components (`components/ui/`)
- Never install new UI component libraries — extend shadcn components instead
- Use `cn()` from `lib/utils.ts` to merge Tailwind classes
- All modals use Radix Dialog via shadcn's `Dialog` component

### Drag & Drop (Kanban)
Uses `@dnd-kit`:
- `Board.tsx` — sets up `DndContext` and `SortableContext`
- `Column.tsx` — droppable column per status
- `Card.tsx` — draggable project card
- Status changes via drag trigger a `PUT /api/projects/:id` call

### Role-Based UI
Use `hooks/usePermissions.ts` to conditionally render UI based on user role:
```tsx
const { canCreateProject, canDeleteProject } = usePermissions();
{canCreateProject && <CreateButton />}
```

### Routing
- `/` — Login page
- `/dashboard` — Main dashboard with workspace cards
- `/dashboard/[workspace]` — Kanban board for a specific workspace (e.g., `web-development`)
- `/dashboard/my-work` — User's assigned projects

## Styling

- **Tailwind CSS v3** with `tailwindcss-animate` for animations
- Custom theme in `tailwind.config.ts`
- Dark mode supported via `next-themes`
- Use `class-variance-authority` (cva) for component variants

## Environment Variables

```bash
NEXT_PUBLIC_API_URL="http://localhost:5000/api"   # Backend API base URL
```

## Important Notes

1. **No SSR for authenticated pages** — dashboard pages rely on client-side auth context
2. **Token in localStorage** — JWT is stored/read from `localStorage`, not cookies
3. **React 19 + Next.js 16** — use latest React patterns (no legacy context API)
4. **Turbopack** — dev server uses `--turbo` flag for faster builds
