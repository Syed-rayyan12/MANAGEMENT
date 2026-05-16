# Mobile Responsiveness — Design Spec

## Goal

Make the existing webapp fully usable on mobile phones (375px–430px) for 10-15 power users who need quick access away from their desks. No new pages or libraries — refactor existing components with responsive Tailwind classes and the existing `useIsMobile()` hook.

## Context

- 10-15 office employees, 9+ hours daily, Railway paid plan
- Existing stack: Next.js 16, React 19, Tailwind CSS, shadcn/ui, @dnd-kit
- Mobile detection hook (`useIsMobile()` at 768px breakpoint) already exists
- Sidebar already has a proper mobile drawer pattern
- Dashboard grids already responsive
- Login page already responsive

## What's Broken on Mobile

- **Kanban columns:** Fixed 300px width, no scroll-snap, unusable on <768px
- **ProjectModal:** Fixed `w-96` sidebar, two-column layout doesn't stack, tabs overflow
- **Search:** Hidden entirely on mobile
- **Card quick-edit:** Hover-only, inaccessible on touch devices
- **CreateProjectModal:** Not full-screen on mobile
- **Font sizes:** 10-11px instances too small for mobile

---

## Kanban Board (Mobile)

### Column Layout

On mobile (`<768px`), columns change from `w-[300px]` to `w-[85vw]`. The scroll container gets CSS scroll-snap: `snap-x snap-mandatory` on the parent, `snap-center` on each column. This creates the Trello-style feel — one column fills most of the viewport, the next column peeks ~15% from the right edge. User swipes horizontally to move between columns. On desktop, nothing changes.

### Column Indicator Bar

A horizontal pill bar appears above the board on mobile only. Each pill shows the column name with its color dot. The currently visible column is highlighted (detected via `IntersectionObserver` or scroll position). Tapping a pill scrolls to that column. Hidden on desktop since all columns are visible simultaneously.

### Cards

The quick-edit pencil button gets `opacity-100` on mobile (always visible, no hover dependency). Touch targets on card action buttons get `min-h-[44px]`. Card text stays the same — 85vw columns are actually wider than 300px on most phones, so content has more room.

### Drag-and-Drop

No changes needed. `@dnd-kit` uses `PointerSensor` which handles touch natively.

---

## Project Modal (Mobile)

### Container

On mobile, the modal becomes full-screen: `h-[100dvh] w-full max-w-full rounded-none`. Uses `dvh` (dynamic viewport height) to handle mobile browser chrome. On desktop, stays `max-w-7xl h-[90vh]`.

### Layout

The two-column layout (left sidebar `w-96` + right content) stacks vertically on mobile. The left "sidebar" becomes a compact header section at the top — project name, status, priority, due date, assignments, labels. Scrollable if content exceeds available space, but most fits in ~200px.

### Tabs

The `grid-cols-4` tab layout becomes a scrollable horizontal row on mobile: `flex overflow-x-auto` with `whitespace-nowrap` on each tab button. This handles any number of tabs without overflow.

### Close Button

Larger touch target on mobile, positioned top-right with adequate padding.

### Comments

The comment input stays fixed at the bottom of the comments tab on mobile (like a chat app input bar), so users don't scroll past all comments to type.

---

## Mobile Search

A search icon button in the navbar, visible only on mobile (`sm:hidden`). Tapping opens a full-width search overlay that slides down from the top — an absolute-positioned div with an auto-focused input and close button. Uses the existing `searchQuery` state from the dashboard layout. Tapping close or pressing Escape dismisses it.

No new routes or state management.

---

## Create Project Modal (Mobile)

Full-screen on mobile (`h-[100dvh] w-full`). The form is already vertically stacked. Submit/cancel buttons become sticky at the bottom so they're always reachable without scrolling.

On desktop, no changes.

---

## Minor Fixes

### Touch Targets

All interactive elements (buttons, dropdown triggers, tab buttons, card click areas) get `min-h-[44px]` on mobile — Apple's Human Interface guideline minimum.

### Font Sizes

`text-[11px]` and `text-[10px]` instances in cards and sidebar get bumped to `text-xs` (12px) on mobile.

### Workspace Page Header

Filter/sort/action buttons use `w-full sm:w-auto` so they stack cleanly on very small screens instead of overflowing horizontally.

### Delete Confirmation Modal

Gets `max-w-[calc(100vw-2rem)]` on mobile to prevent edge overflow.

---

## What Stays Unchanged

- Sidebar drawer (already works on mobile)
- Dashboard layout shell (already handles mobile state)
- Dashboard stat cards and board cards (already responsive grids)
- Login page (already responsive)
- Trash page (tab layout works)
- Admin page (works adequately)
- My Work page (list/phase view works)
- All backend code (no changes)
- No new libraries or dependencies

## What Changes

| File | Change |
|------|--------|
| `frontend/components/kanban/Board.tsx` | Scroll-snap container, column indicator bar on mobile |
| `frontend/components/kanban/Column.tsx` | Responsive width: 85vw on mobile, 300px on desktop |
| `frontend/components/kanban/Card.tsx` | Always-visible quick-edit on mobile, touch targets |
| `frontend/components/project/ProjectModal.tsx` | Full-screen on mobile, vertical stack, scrollable tabs, sticky comment input |
| `frontend/components/project/CreateProjectModal.tsx` | Full-screen on mobile, sticky buttons |
| `frontend/components/layout/Navbar.tsx` | Mobile search icon + overlay |
| `frontend/app/dashboard/[workspace]/page.tsx` | Responsive filter/button layout |
| `frontend/components/shared/DeleteConfirmation.tsx` | Mobile max-width |

## Out of Scope

- PWA / service worker
- Offline support
- Native app shell
- Responsive admin sub-pages (adequate as-is)
- Tablet-specific layouts (768px+ already works)
