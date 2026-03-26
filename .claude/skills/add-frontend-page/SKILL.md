---
name: Add Frontend Page
description: Step-by-step workflow to add a new page or route to the Next.js frontend using App Router, AppContext, and shadcn/ui components.
---

# Add Frontend Page

Follow these steps to add a new page to the ProManage Next.js frontend.

## Steps

### 1. Create the Page Route

Create a new directory and `page.tsx` under `frontend/app/`:

**For a dashboard sub-page:**
```
frontend/app/dashboard/<page-name>/page.tsx
```

**For a dynamic route:**
```
frontend/app/dashboard/<page-name>/[id]/page.tsx
```

### 2. Page Template

```tsx
'use client';

import { useEffect } from 'react';
import { useApp } from '@/contexts/useApp';

export default function NewPage() {
  const { user, token } = useApp();

  // Redirect if not authenticated
  useEffect(() => {
    if (!token) {
      window.location.href = '/';
    }
  }, [token]);

  if (!user) return null;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Page Title</h1>
      {/* Content */}
    </div>
  );
}
```

### 3. Use AppContext for State

Access global state and API data through `useApp()`:

```tsx
const {
  user,          // Current logged-in user
  token,         // JWT token
  projects,      // All projects
  teams,         // All teams
  boards,        // All boards
  notifications, // User notifications
} = useApp();
```

### 4. Make API Calls

Use the centralized API service:

```tsx
import { apiService } from '@/lib/api-service';

// GET request
const data = await apiService.get('/new-endpoint');

// POST request
const result = await apiService.post('/new-endpoint', { field: 'value' });

// PUT request
await apiService.put(`/new-endpoint/${id}`, { field: 'updated' });

// DELETE request
await apiService.delete(`/new-endpoint/${id}`);
```

### 5. Use shadcn/ui Components

Import from the `components/ui/` directory:

```tsx
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
```

### 6. Role-Based UI

Use the permissions hook to conditionally render:

```tsx
import { usePermissions } from '@/hooks/usePermissions';

const { canCreateProject, canDeleteProject } = usePermissions();

return (
  <>
    {canCreateProject && <Button>Create New</Button>}
  </>
);
```

### 7. Add Navigation Link (if needed)

Update the sidebar in `frontend/components/layout/` to add a nav link:

```tsx
{
  title: 'New Page',
  href: '/dashboard/new-page',
  icon: SomeIcon,
}
```

### 8. Add to AppContext (if new state needed)

If the page needs new global state, update `frontend/contexts/AppContext.tsx`:

1. Add state variable to the context type
2. Add state and fetch logic to the provider
3. Expose through the context value

## Common Patterns

### Data Table Page
```tsx
<Card>
  <CardHeader>
    <CardTitle>Items</CardTitle>
  </CardHeader>
  <CardContent>
    <Table>
      <TableHeader>...</TableHeader>
      <TableBody>
        {items.map(item => <TableRow key={item.id}>...</TableRow>)}
      </TableBody>
    </Table>
  </CardContent>
</Card>
```

### Modal Form Page
```tsx
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogTrigger asChild>
    <Button>Add New</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Create Item</DialogTitle>
    </DialogHeader>
    <form onSubmit={handleSubmit}>
      <Input placeholder="Name" {...register('name')} />
      <Button type="submit">Save</Button>
    </form>
  </DialogContent>
</Dialog>
```

## Styling Rules

- Use **Tailwind CSS** classes for all styling
- Use `cn()` from `@/lib/utils` to merge conditional classes
- Support dark mode — use `dark:` prefix for dark mode variants
- Follow existing spacing patterns: `p-6`, `space-y-6`, `gap-4`
- Never install new UI libraries — extend shadcn components

## Checklist

- [ ] Page file created in correct `app/` directory
- [ ] `'use client'` directive added (for interactive pages)
- [ ] Auth guard in place (redirect if no token)
- [ ] Using `useApp()` for global state
- [ ] Using `apiService` for API calls (not raw fetch)
- [ ] Using shadcn/ui components (not custom HTML)
- [ ] Role-based rendering with `usePermissions` (if applicable)
- [ ] Navigation link added in sidebar (if applicable)
- [ ] Dark mode supported
