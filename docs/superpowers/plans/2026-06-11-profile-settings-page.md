# Profile & Settings Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the disabled "Profile (Coming soon)" / "Settings (Coming soon)" dropdown items with a working `/dashboard/profile` page (Profile + Preferences tabs) backed by two new auth endpoints.

**Architecture:** Backend adds `PATCH /api/auth/me` and `POST /api/auth/change-password` to the existing auth controller (no new controller, no migration — every field already exists on `User`). Frontend adds one page with shadcn Tabs plus three small components, and flips the two dropdown items from disabled to links. Login and `GET /me` responses gain `avatar`/`specialization`/`username` fields **additively** (existing consumers ignore extra fields — non-breaking).

**Tech Stack:** Express + Prisma + zod (backend); Next.js 16 App Router, react-hook-form + @hookform/resolvers/zod, sonner toasts, shadcn/ui (Tabs, Input, Select, Avatar, Button), next-themes (frontend).

**Spec:** `docs/superpowers/specs/2026-06-11-profile-settings-page-design.md`

**No test infrastructure exists in this repo** (no test runner in either package.json). Per the spec, verification is TypeScript builds (`npm run build` in both packages) plus curl/manual checks. Do NOT introduce a test framework.

**Critical constraint (user requirement):** zero breakage of existing functionality. All backend changes are new endpoints or additive response fields. Frontend changes are new files plus the two dropdown items.

**Key gotcha discovered during planning:** the frontend `apiFetch` wrapper (`frontend/lib/api-service.ts:34-39`) treats ANY 401 as "session expired" and force-logs-out the user. Therefore the change-password endpoint MUST return **400** (not 401) for a wrong current password, or users would be logged out when they typo their password.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `backend/src/utils/validators.ts` | Add `updateProfileSchema`, `changePasswordSchema` |
| Modify | `backend/src/controllers/auth.controller.ts` | Add `updateMe`, `changePassword`; enrich `getMe` + `login` selects additively |
| Modify | `backend/src/types/index.ts` | Add `avatar`/`specialization` to `AuthResponse` user |
| Modify | `backend/src/routes/auth.routes.ts` | Wire the two new routes |
| Modify | `frontend/lib/api-service.ts` | Add `authAPI.updateMe`, `authAPI.changePassword` |
| Create | `frontend/components/profile/ProfileInfoForm.tsx` | Avatar upload + name/email/specialization form |
| Create | `frontend/components/profile/ChangePasswordForm.tsx` | Password change form |
| Create | `frontend/components/profile/PreferencesTab.tsx` | Theme selector |
| Create | `frontend/app/dashboard/profile/page.tsx` | Page shell: tabs + `?tab=` deep link |
| Modify | `frontend/components/layout/Topbar.tsx:142-149` | Enable Profile/Settings dropdown items |
| Modify | `frontend/components/layout/Navbar.tsx:130-137` | Same (legacy file, currently unreferenced — keep consistent) |

---

### Task 1: Backend validation schemas

**Files:**
- Modify: `backend/src/utils/validators.ts`

- [ ] **Step 1: Add the two schemas**

In `backend/src/utils/validators.ts`, insert after the `loginSchema` block (after line 9, before the `// ─── Projects` section):

```typescript
export const updateProfileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200).optional(),
  email: z.string().email('Invalid email').max(254).optional(),
  specialization: z.enum(['LOGO_DESIGNER', 'FIGMA_DESIGNER', 'DEVELOPER', 'CONTENT_WRITER', 'QA']).optional().nullable(),
  avatar: z.string().url().max(2048).optional().nullable(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field is required',
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required').max(128),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(128),
});
```

Notes for the implementer:
- The `specialization` enum values match `createEmployeeSchema` at `validators.ts:108` and the Prisma `Specialization` enum — do not invent new values.
- `.refine` on key count works because zod omits absent optional keys from the parsed output.

- [ ] **Step 2: Verify backend compiles**

Run: `cd backend; npx tsc --noEmit`
Expected: exits 0, no output.

- [ ] **Step 3: Commit**

```bash
git add backend/src/utils/validators.ts
git commit -m "feat(api): add profile update and change-password validation schemas"
```

---

### Task 2: Backend controller endpoints

**Files:**
- Modify: `backend/src/controllers/auth.controller.ts`
- Modify: `backend/src/types/index.ts`

- [ ] **Step 1: Add `updateMe` and `changePassword` controllers**

Append to `backend/src/controllers/auth.controller.ts` (after the existing `verifyPassword` function):

```typescript
/**
 * Update current user's own profile
 * PATCH /api/auth/me
 */
export const updateMe = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    const { name, email, specialization, avatar } = req.body;

    // Email is unique — check for conflicts before updating
    if (email) {
      const existing = await prisma.user.findFirst({
        where: { email, NOT: { id: req.user.id } },
        select: { id: true },
      });
      if (existing) {
        res.status(409).json({ success: false, message: 'Email already in use' });
        return;
      }
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(specialization !== undefined && { specialization }),
        ...(avatar !== undefined && { avatar }),
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        name: true,
        avatar: true,
        specialization: true,
        createdAt: true,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: { user },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Change current user's password
 * POST /api/auth/change-password
 *
 * NOTE: wrong current password returns 400, NOT 401 — the frontend
 * apiFetch interceptor treats 401 as an expired session and force-logs
 * the user out, which must not happen on a typo'd password.
 */
export const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      res.status(400).json({ success: false, message: 'Current password is incorrect' });
      return;
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed },
    });

    res.status(200).json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
```

(`bcrypt` and `prisma` are already imported at the top of this file — no new imports needed.)

- [ ] **Step 2: Enrich `getMe` additively**

In the same file, `getMe` (currently `auth.controller.ts:119-128`) selects only `id, email, role, name, createdAt`. The profile page needs the user's current avatar/specialization/username. Change the `select` to:

```typescript
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        name: true,
        avatar: true,
        specialization: true,
        createdAt: true,
      },
```

This only ADDS fields to the response — no existing consumer breaks.

- [ ] **Step 3: Enrich the login response additively**

In `login` (currently `auth.controller.ts:81-95`), the `data.user` object is built from `id, username, email, role, name, teams`. Add `avatar` and `specialization` so the topbar avatar survives a re-login (the frontend stores this object in localStorage as `currentUser`):

```typescript
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          name: user.name,
          avatar: user.avatar,
          specialization: user.specialization,
          teams,
        },
```

Then update the `AuthResponse` type in `backend/src/types/index.ts` (lines 20-34) to match — add two fields to the `user` object:

```typescript
export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    user: {
      id: string;
      username: string;
      email: string;
      role: string;
      name: string;
      avatar: string | null;
      specialization: string | null;
      teams: { id: string; slug: string; name: string }[];
    };
    token: string;
  };
}
```

- [ ] **Step 4: Verify backend compiles**

Run: `cd backend; npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/auth.controller.ts backend/src/types/index.ts
git commit -m "feat(api): add updateMe and changePassword endpoints, enrich me/login responses"
```

---

### Task 3: Backend routes + smoke test

**Files:**
- Modify: `backend/src/routes/auth.routes.ts`

- [ ] **Step 1: Wire the routes**

In `backend/src/routes/auth.routes.ts`:

Update the imports (lines 2 and 4):

```typescript
import { login, getMe, verifyPassword, updateMe, changePassword } from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate, loginSchema, updateProfileSchema, changePasswordSchema } from '../utils/validators';
```

Insert after the `GET /me` route (after line 20):

```typescript
/**
 * @route   PATCH /api/auth/me
 * @desc    Update current user's own profile (name, email, specialization, avatar)
 * @access  Private (requires authentication)
 */
router.patch('/me', authenticate, validate(updateProfileSchema), updateMe);

/**
 * @route   POST /api/auth/change-password
 * @desc    Change current user's password (requires current password)
 * @access  Private (requires authentication)
 */
router.post('/change-password', authenticate, validate(changePasswordSchema), changePassword);
```

- [ ] **Step 2: Verify backend compiles and builds**

Run: `cd backend; npm run build`
Expected: exits 0, `dist/` produced.

- [ ] **Step 3: Smoke test the endpoints (requires running dev server + DB)**

Start the server if not running: `cd backend; npm run dev` (port 5000).

```bash
# 1. Login, capture token (any seeded user, password123)
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d '{"username":"pm.azharrajput","password":"password123"}' | python -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")

# 2. PATCH name — expect success:true and the new name echoed back
curl -s -X PATCH http://localhost:5000/api/auth/me -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":"Azhar Rajput"}'

# 3. Empty body — expect 400 "At least one field is required"
curl -s -X PATCH http://localhost:5000/api/auth/me -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}'

# 4. Wrong current password — expect 400 "Current password is incorrect" (NOT 401)
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:5000/api/auth/change-password -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"currentPassword":"wrong","newPassword":"password1234"}'

# 5. Correct change + change back (leave seeded data as found)
curl -s -X POST http://localhost:5000/api/auth/change-password -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"currentPassword":"password123","newPassword":"password1234"}'
curl -s -X POST http://localhost:5000/api/auth/change-password -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"currentPassword":"password1234","newPassword":"password123"}'
```

Expected: step 4 prints `400`; steps 2 and 5 return `{"success":true,...}`.
If no local DB is available, skip this step and rely on the build + final manual verification.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/auth.routes.ts
git commit -m "feat(api): register profile update and change-password routes"
```

---

### Task 4: Frontend API client methods

**Files:**
- Modify: `frontend/lib/api-service.ts`

- [ ] **Step 1: Add methods to `authAPI`**

In `frontend/lib/api-service.ts`, inside the `authAPI` object (after `verifyPassword`, around line 98), add:

```typescript
  updateMe: async (data: {
    name?: string;
    email?: string;
    specialization?: string | null;
    avatar?: string | null;
  }) => {
    const response = await apiFetch(`${API_BASE_URL}/auth/me`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return await response.json();
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    const response = await apiFetch(`${API_BASE_URL}/auth/change-password`, {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    return await response.json();
  },
```

(`apiFetch` only intercepts 401/403/500+; our 400 and 409 error responses flow through to `response.json()` so callers read `success: false` + `message`.)

- [ ] **Step 2: Verify frontend typechecks**

Run: `cd frontend; npx tsc --noEmit`
Expected: exits 0 (warnings about pre-existing issues are acceptable only if they exist on a clean checkout — they don't today).

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/api-service.ts
git commit -m "feat(frontend): add updateMe and changePassword API methods"
```

---

### Task 5: ProfileInfoForm component

**Files:**
- Create: `frontend/components/profile/ProfileInfoForm.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import React, { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useApp } from '@/contexts/useApp';
import { authAPI, uploadAPI } from '@/lib/api-service';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Camera } from 'lucide-react';

const SPECIALIZATIONS = [
  { value: 'LOGO_DESIGNER', label: 'Logo Designer' },
  { value: 'FIGMA_DESIGNER', label: 'Figma Designer' },
  { value: 'DEVELOPER', label: 'Developer' },
  { value: 'CONTENT_WRITER', label: 'Content Writer' },
  { value: 'QA', label: 'QA' },
];

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email('Invalid email').max(254),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export function ProfileInfoForm() {
  const { state, dispatch } = useApp();
  const user = state.currentUser;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [specialization, setSpecialization] = useState<string>(user?.specialization || '');

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name || '', email: user?.email || '' },
  });

  if (!user) return null;

  const mergeUser = (updated: Record<string, unknown>) => {
    // SET_USER also persists to localStorage; keep teams from the existing user
    dispatch({ type: 'SET_USER', payload: { ...user, ...updated } });
  };

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }
    setUploading(true);
    try {
      const uploaded = await uploadAPI.uploadFile(file, 'avatars');
      if (!uploaded) {
        toast.error('Avatar upload failed');
        return;
      }
      const result = await authAPI.updateMe({ avatar: uploaded.publicUrl });
      if (result.success) {
        mergeUser({ avatar: uploaded.publicUrl });
        toast.success('Avatar updated');
      } else {
        toast.error(result.message || 'Failed to save avatar');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Avatar upload failed');
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (values: ProfileFormValues) => {
    try {
      const payload: Record<string, unknown> = { name: values.name, email: values.email };
      if (user.role === 'PRODUCTION') {
        payload.specialization = specialization || null;
      }
      const result = await authAPI.updateMe(payload);
      if (result.success) {
        mergeUser({
          name: values.name,
          email: values.email,
          ...(user.role === 'PRODUCTION' && { specialization: specialization || undefined }),
        });
        toast.success('Profile updated');
      } else if (result.message === 'Email already in use') {
        setError('email', { message: result.message });
      } else {
        toast.error(result.message || 'Failed to update profile');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update profile');
    }
  };

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-6">
      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <Avatar className="w-16 h-16">
            <AvatarImage src={user.avatar} alt={user.name} />
            <AvatarFallback className="text-lg bg-[#e05c29]/15 text-[#e05c29] font-medium">
              {user.name.split(' ')[0][0]}
            </AvatarFallback>
          </Avatar>
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
              <Loader2 className="w-5 h-5 animate-spin text-white" />
            </div>
          )}
        </div>
        <div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all duration-200 ease-out disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Camera className="w-3.5 h-3.5" />
            Change photo
          </button>
          <p className="mt-1 text-xs text-zinc-400">PNG or JPG, max 5MB</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarSelect}
          />
        </div>
      </div>

      {/* Read-only identity */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-zinc-700 dark:text-zinc-300">Username</Label>
          <Input value={user.username} disabled className="mt-1.5" />
        </div>
        <div>
          <Label className="text-zinc-700 dark:text-zinc-300">Role</Label>
          <div className="mt-1.5">
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-[#e05c29]/15 text-[#e05c29]">
              {user.role}
            </span>
          </div>
        </div>
      </div>
      <p className="text-xs text-zinc-400 -mt-3">Username and role are managed by your admin.</p>

      {/* Editable fields */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="profile-name" className="text-zinc-700 dark:text-zinc-300">Name</Label>
          <Input id="profile-name" {...register('name')} className="mt-1.5" />
          {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
        </div>
        <div>
          <Label htmlFor="profile-email" className="text-zinc-700 dark:text-zinc-300">Email</Label>
          <Input id="profile-email" type="email" {...register('email')} className="mt-1.5" />
          {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
        </div>
        {user.role === 'PRODUCTION' && (
          <div>
            <Label className="text-zinc-700 dark:text-zinc-300">Specialization</Label>
            <Select value={specialization} onValueChange={setSpecialization}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Select specialization" />
              </SelectTrigger>
              <SelectContent>
                {SPECIALIZATIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-gradient-to-r from-[#e05c29] to-orange-400 hover:to-rose-500 text-white shadow-[0_4px_20px_rgba(224,92,41,0.35)]"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save changes
          </Button>
        </div>
      </form>
    </div>
  );
}
```

Implementation notes:
- `state.currentUser` (type `CurrentUser`, `frontend/lib/types.ts:130-139`) already has optional `avatar`, `specialization`, `username` fields.
- `SET_USER` (AppContext reducer) persists to localStorage. Dispatching it re-triggers AppContext data fetches (they depend on `state.currentUser`); that's acceptable on an explicit save.
- Specialization is intentionally NOT in the zod schema — it's a controlled Select with separate state, only sent for PRODUCTION users.

- [ ] **Step 2: Verify typecheck**

Run: `cd frontend; npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/profile/ProfileInfoForm.tsx
git commit -m "feat(frontend): profile info form with avatar upload"
```

---

### Task 6: ChangePasswordForm component

**Files:**
- Create: `frontend/components/profile/ChangePasswordForm.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { authAPI } from '@/lib/api-service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'Must be at least 8 characters').max(128),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type PasswordFormValues = z.infer<typeof passwordSchema>;

export function ChangePasswordForm() {
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async (values: PasswordFormValues) => {
    try {
      const result = await authAPI.changePassword(values.currentPassword, values.newPassword);
      if (result.success) {
        toast.success('Password changed successfully');
        reset();
      } else if (result.message === 'Current password is incorrect') {
        setError('currentPassword', { message: result.message });
      } else {
        toast.error(result.message || 'Failed to change password');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to change password');
    }
  };

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Change password</h3>
      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
        You&apos;ll keep your current session after changing it.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4 max-w-sm">
        <div>
          <Label htmlFor="current-password" className="text-zinc-700 dark:text-zinc-300">Current password</Label>
          <Input id="current-password" type="password" autoComplete="current-password" {...register('currentPassword')} className="mt-1.5" />
          {errors.currentPassword && <p className="mt-1 text-xs text-red-500">{errors.currentPassword.message}</p>}
        </div>
        <div>
          <Label htmlFor="new-password" className="text-zinc-700 dark:text-zinc-300">New password</Label>
          <Input id="new-password" type="password" autoComplete="new-password" {...register('newPassword')} className="mt-1.5" />
          {errors.newPassword && <p className="mt-1 text-xs text-red-500">{errors.newPassword.message}</p>}
        </div>
        <div>
          <Label htmlFor="confirm-password" className="text-zinc-700 dark:text-zinc-300">Confirm new password</Label>
          <Input id="confirm-password" type="password" autoComplete="new-password" {...register('confirmPassword')} className="mt-1.5" />
          {errors.confirmPassword && <p className="mt-1 text-xs text-red-500">{errors.confirmPassword.message}</p>}
        </div>
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-gradient-to-r from-[#e05c29] to-orange-400 hover:to-rose-500 text-white shadow-[0_4px_20px_rgba(224,92,41,0.35)]"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Update password
          </Button>
        </div>
      </form>
    </div>
  );
}
```

The `result.message === 'Current password is incorrect'` string match pairs with the exact message defined in Task 2 — if you change one, change both.

- [ ] **Step 2: Verify typecheck**

Run: `cd frontend; npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/profile/ChangePasswordForm.tsx
git commit -m "feat(frontend): change password form"
```

---

### Task 7: PreferencesTab component

**Files:**
- Create: `frontend/components/profile/PreferencesTab.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export function PreferencesTab() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // next-themes is undefined on the server — render options only after mount
  useEffect(() => setMounted(true), []);

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Appearance</h3>
      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
        Choose how XRM looks for you.
      </p>
      <div className="mt-4 grid grid-cols-3 gap-3 max-w-sm">
        {THEME_OPTIONS.map((option) => {
          const Icon = option.icon;
          const active = mounted && theme === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setTheme(option.value)}
              aria-pressed={active}
              className={cn(
                'flex flex-col items-center gap-2 rounded-lg border px-3 py-4 text-sm font-medium transition-all duration-200 ease-out',
                active
                  ? 'border-[#e05c29] bg-[#e05c29]/8 text-[#e05c29]'
                  : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-[#e05c29]/40 hover:text-[#e05c29]'
              )}
            >
              <Icon className="w-4 h-4" />
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd frontend; npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/profile/PreferencesTab.tsx
git commit -m "feat(frontend): preferences tab with theme selector"
```

---

### Task 8: Profile page shell

**Files:**
- Create: `frontend/app/dashboard/profile/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
'use client';

import React, { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '@/contexts/useApp';
import { authAPI } from '@/lib/api-service';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProfileInfoForm } from '@/components/profile/ProfileInfoForm';
import { ChangePasswordForm } from '@/components/profile/ChangePasswordForm';
import { PreferencesTab } from '@/components/profile/PreferencesTab';
import { Loader2 } from 'lucide-react';

function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state, dispatch } = useApp();
  const user = state.currentUser;

  const tab = searchParams.get('tab') === 'preferences' ? 'preferences' : 'profile';

  // Hydrate avatar/specialization/username from the server — the localStorage
  // copy of currentUser may predate these fields being included in login.
  useEffect(() => {
    if (!user) return;
    authAPI
      .getMe()
      .then((res) => {
        if (!res.success || !res.data?.user) return;
        const fresh = res.data.user;
        const changed =
          fresh.name !== user.name ||
          fresh.email !== user.email ||
          (fresh.avatar || undefined) !== user.avatar ||
          (fresh.specialization || undefined) !== user.specialization;
        if (changed) {
          dispatch({
            type: 'SET_USER',
            payload: {
              ...user,
              name: fresh.name,
              email: fresh.email,
              avatar: fresh.avatar || undefined,
              specialization: fresh.specialization || undefined,
            },
          });
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto p-5 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">My Account</h1>
        <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
          Manage your profile and preferences.
        </p>
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) =>
          router.replace(value === 'preferences' ? '/dashboard/profile?tab=preferences' : '/dashboard/profile')
        }
      >
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>
        <TabsContent value="profile" className="mt-4 space-y-6">
          <ProfileInfoForm />
          <ChangePasswordForm />
        </TabsContent>
        <TabsContent value="preferences" className="mt-4">
          <PreferencesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
        </div>
      }
    >
      <ProfileContent />
    </Suspense>
  );
}
```

Implementation notes:
- The `Suspense` wrapper is REQUIRED — `useSearchParams()` in a client page must be inside a Suspense boundary or `next build` fails the prerender pass.
- The hydration effect compares fields before dispatching `SET_USER` to avoid pointlessly re-triggering AppContext's data-fetch effects (they depend on `state.currentUser` identity).
- The topbar breadcrumb automatically renders "Studio › Profile" from the pathname — no breadcrumb work needed.

- [ ] **Step 2: Verify typecheck**

Run: `cd frontend; npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/dashboard/profile/page.tsx
git commit -m "feat(frontend): profile page with profile and preferences tabs"
```

---

### Task 9: Enable the dropdown items

**Files:**
- Modify: `frontend/components/layout/Topbar.tsx:142-149`
- Modify: `frontend/components/layout/Navbar.tsx:130-137`

- [ ] **Step 1: Topbar**

Replace lines 142-149 of `frontend/components/layout/Topbar.tsx`:

```tsx
            <DropdownMenuItem className="gap-2 opacity-50 cursor-not-allowed" disabled>
              <User className="w-3.5 h-3.5" />
              <span className="text-[12px]">Profile <span className="text-[10px] text-fg-4">(Coming soon)</span></span>
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 opacity-50 cursor-not-allowed" disabled>
              <Settings className="w-3.5 h-3.5" />
              <span className="text-[12px]">Settings <span className="text-[10px] text-fg-4">(Coming soon)</span></span>
            </DropdownMenuItem>
```

with:

```tsx
            <DropdownMenuItem onClick={() => router.push('/dashboard/profile')} className="gap-2">
              <User className="w-3.5 h-3.5" />
              <span className="text-[12px]">Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/dashboard/profile?tab=preferences')} className="gap-2">
              <Settings className="w-3.5 h-3.5" />
              <span className="text-[12px]">Settings</span>
            </DropdownMenuItem>
```

(`router` already exists in this component — `Topbar.tsx:26`.)

- [ ] **Step 2: Navbar (legacy, currently unreferenced — updated for consistency)**

Replace lines 130-137 of `frontend/components/layout/Navbar.tsx`:

```tsx
              <DropdownMenuItem className="gap-2 opacity-50 cursor-not-allowed" disabled>
                <User className="w-4 h-4 text-[#e05c29]" />
                <span className="text-zinc-700 dark:text-zinc-300 text-[12px]">Profile <span className="text-[10px] text-zinc-400">(Coming soon)</span></span>
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 opacity-50 cursor-not-allowed" disabled>
                <Settings className="w-4 h-4 text-[#e05c29]" />
                <span className="text-zinc-700 dark:text-zinc-300 text-[12px]">Settings <span className="text-[10px] text-zinc-400">(Coming soon)</span></span>
              </DropdownMenuItem>
```

with:

```tsx
              <DropdownMenuItem onClick={() => router.push('/dashboard/profile')} className="gap-2">
                <User className="w-4 h-4 text-[#e05c29]" />
                <span className="text-zinc-700 dark:text-zinc-300 text-[12px]">Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/dashboard/profile?tab=preferences')} className="gap-2">
                <Settings className="w-4 h-4 text-[#e05c29]" />
                <span className="text-zinc-700 dark:text-zinc-300 text-[12px]">Settings</span>
              </DropdownMenuItem>
```

(`router` already exists — `Navbar.tsx:30`.)

- [ ] **Step 3: Verify typecheck**

Run: `cd frontend; npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/layout/Topbar.tsx frontend/components/layout/Navbar.tsx
git commit -m "feat(frontend): enable Profile and Settings dropdown items"
```

---

### Task 10: Full build + manual verification

- [ ] **Step 1: Build both packages**

Run: `cd backend; npm run build`
Expected: exits 0.

Run: `cd frontend; npm run build`
Expected: exits 0, `/dashboard/profile` appears in the route list.

- [ ] **Step 2: Manual verification (requires both dev servers + DB)**

Start `cd backend; npm run dev` and `cd frontend; npm run dev`, log in as a seeded user (`password123`), then walk the spec checklist:

1. Avatar dropdown → **Profile** lands on `/dashboard/profile`, Profile tab active.
2. Avatar dropdown → **Settings** lands on the Preferences tab (`?tab=preferences`).
3. Edit name → save → topbar name/avatar-fallback updates without reload; survives a page refresh.
4. Upload an avatar image → shows in the form and the topbar; survives refresh.
5. Change email to one already used by another user → inline "Email already in use" on the email field.
6. Log in as a `prod.*` user → Specialization select visible; as `pm.*` → hidden.
7. Change password with a wrong current password → inline error, **user stays logged in**.
8. Change password correctly → success toast; log out, old password fails, new password works. (Change it back if using shared seed data.)
9. Theme cards in Preferences switch light/dark/system; the dropdown's quick toggle still works.
10. Regression pass: login, logout, notifications panel, Kanban board navigation — all behave as before.

- [ ] **Step 3: Final commit (if any fixups)**

```bash
git add -A
git commit -m "fix: address manual verification findings for profile page"
```

Only commit if fixups were needed.
