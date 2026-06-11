# Profile & Settings Page — Design Spec

**Date:** 2026-06-11
**Status:** Approved

## Problem

The user dropdown in the topbar shows **Profile (Coming soon)** and **Settings (Coming soon)** as disabled items (`frontend/components/layout/Topbar.tsx:142-149`, same in the legacy `Navbar.tsx`). No pages exist behind them, and users have no way to:

- Change their own password (all seeded accounts still use `password123`)
- Set an avatar, update their display name, email, or specialization
- Manage preferences outside the cramped dropdown (theme toggle)

The `User` model already has every needed field (`name`, `email`, `avatar`, `password`, `specialization`) — no schema changes required.

## Scope Decisions

- **One page, two tabs** — a single `/dashboard/profile` page with **Profile** and **Preferences** tabs. Both dropdown items link to it (Settings deep-links to the Preferences tab). This avoids shipping a near-empty Settings page.
- **Self-editable fields:** name, avatar, email, specialization. Username and role stay read-only (login identity, admin-managed).
- **Password change** requires the current password.
- **Notification preferences are out of scope** — no preference storage exists, and adding it would require a new model plus filtering at every notification-creation site. The Preferences tab gives future settings a home.

## Backend

Two new endpoints on the existing auth controller (`backend/src/controllers/auth.controller.ts`), following the established `/me` + `/verify-password` pattern. **No new controller, no migration.**

### `PATCH /api/auth/me`

- Auth: `authenticate` middleware (any role).
- Body (zod schema in `src/utils/validators.ts`, all fields optional, at least one required):
  - `name` — non-empty string, trimmed, max length consistent with existing validators
  - `email` — valid email
  - `specialization` — one of the `Specialization` enum values, or `null` to clear
  - `avatar` — URL string, or `null` to clear
- Behavior: updates only provided fields on `req.user.id`. On email uniqueness conflict, return `409`-style failure with the standard `{ success: false, message: "Email already in use" }` shape.
- Response: `{ success: true, message, data: { user } }` with the same user shape as `GET /api/auth/me` (no password).

### `POST /api/auth/change-password`

- Auth: `authenticate` middleware.
- Body: `{ currentPassword: string, newPassword: string }` — `newPassword` min 8 chars (zod).
- Behavior: bcrypt-compare `currentPassword` against the stored hash (same logic as existing `verifyPassword`); on mismatch return `{ success: false, message: "Current password is incorrect" }`. On success, bcrypt-hash and save `newPassword`.
- Existing JWTs remain valid after a password change (consistent with current stateless-JWT behavior; no token invalidation in scope).

## Frontend

### New page: `frontend/app/dashboard/profile/page.tsx`

shadcn Tabs with two tabs, tab selected via `?tab=` query param (`profile` default, `preferences`):

**Profile tab**
- Avatar uploader: reuses the existing R2 presign upload flow (`POST /api/upload/presign` → direct PUT → save public URL via `PATCH /api/auth/me`). Shows current avatar with fallback initials, consistent with the topbar Avatar component.
- Editable fields: name, email; specialization select shown **only for PRODUCTION users**.
- Read-only: username and role (rendered as a badge), with a hint that these are admin-managed.
- Change-password section: current password, new password, confirm new password. Client-side confirm-match validation; server errors (wrong current password) shown inline on the field.
- Forms use react-hook-form + zod mirroring the server schemas; submit via the existing API client; success/failure via the existing toast pattern.

**Preferences tab**
- Theme selector (Light / Dark / System) using `next-themes` — same mechanism as the current dropdown toggle, which stays in the dropdown unchanged.
- Section framing leaves room for future preferences (e.g., notification settings).

### Dropdown changes (`Topbar.tsx` and `Navbar.tsx`)

- **Profile** item: enabled, navigates to `/dashboard/profile`. Remove `(Coming soon)`, `disabled`, and the dimmed styling.
- **Settings** item: enabled, navigates to `/dashboard/profile?tab=preferences`. Same cleanup.

### State refresh

After a successful profile save, refresh `currentUser` in AppContext (re-fetch `/api/auth/me` or merge the returned user) so the topbar avatar/name update immediately without a reload.

## Backward Compatibility (explicit requirement)

No existing behavior may change:

- New endpoints only — no modification to existing route handlers, middleware, or response shapes.
- No Prisma schema changes, no migration, no seed changes.
- The dropdown's theme toggle and logout behavior are untouched.
- `GET /api/auth/me` response shape unchanged; the PATCH endpoint returns the same shape.
- Username-based login and normalization are unaffected (username is not editable).

## Error Handling

- Server: zod validation failures → standard validation error response; email conflict and wrong current password → `{ success: false, message }` with appropriate status codes.
- Client: field-level errors inline; transport/server errors via toast.

## Testing

Manual verification checklist:

1. Edit name → topbar updates immediately; persists after reload.
2. Upload avatar → renders in topbar and page; persists.
3. Change email → success; attempt a duplicate email → inline conflict error.
4. PRODUCTION user can set specialization; other roles don't see the field.
5. Change password with wrong current password → inline error; with correct → success, re-login works with the new password and fails with the old one.
6. Settings dropdown item lands on the Preferences tab; theme selector works and matches the dropdown toggle.
7. Regression pass: login, logout, theme toggle in dropdown, notifications panel — all unchanged.
