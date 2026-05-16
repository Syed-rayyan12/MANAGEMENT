# Mobile Responsiveness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing webapp fully usable on mobile phones (375px–430px) by refactoring existing components with responsive Tailwind classes and the existing `useIsMobile()` hook.

**Architecture:** Pure frontend CSS/Tailwind changes plus the `useIsMobile()` hook (768px breakpoint) for conditional rendering. No new libraries, no backend changes. CSS scroll-snap for Trello-style Kanban swiping, `dvh` units for full-screen modals, 44px minimum touch targets per Apple HIG.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS, shadcn/ui, @dnd-kit, existing `useIsMobile()` hook

---

## File Structure

| File | Responsibility |
|------|---------------|
| `frontend/components/kanban/Board.tsx` | Scroll-snap container, column indicator pill bar on mobile |
| `frontend/components/kanban/Column.tsx` | Responsive width: 85vw on mobile, 300px on desktop |
| `frontend/components/kanban/Card.tsx` | Always-visible quick-edit on mobile, touch targets, font bump |
| `frontend/components/project/ProjectModal.tsx` | Full-screen on mobile, vertical stack layout, scrollable tabs |
| `frontend/components/project/CommentsSection.tsx` | Sticky comment input at bottom on mobile |
| `frontend/components/project/CreateProjectModal.tsx` | Full-screen on mobile, sticky submit buttons |
| `frontend/components/layout/Navbar.tsx` | Mobile search icon + full-width overlay |
| `frontend/app/dashboard/[workspace]/page.tsx` | Responsive filter/button layout |
| `frontend/components/shared/DeleteConfirmation.tsx` | Mobile max-width safety |

---

### Task 1: Kanban Column — Responsive Width

**Files:**
- Modify: `frontend/components/kanban/Column.tsx:63-69`

**Context:** The Column component currently has hard-coded `w-[300px] min-w-[300px] max-w-[300px]`. On mobile (<768px), columns need to be `w-[85vw]` so one column fills most of the viewport with the next column peeking from the right edge.

- [ ] **Step 1: Add useIsMobile import and hook**

In `frontend/components/kanban/Column.tsx`, add the import at the top with the other imports:

```tsx
import { useIsMobile } from '@/hooks/use-mobile';
```

Inside the `Column` component function, add:

```tsx
const isMobile = useIsMobile();
```

- [ ] **Step 2: Replace fixed width classes with responsive width**

Replace the column container's className. Find:

```tsx
className={`flex flex-col rounded-xl p-3 w-[300px] min-w-[300px] max-w-[300px] h-[calc(100vh-200px)] transition-colors ${
```

Replace with:

```tsx
className={`flex flex-col rounded-xl p-3 ${isMobile ? 'w-[85vw] min-w-[85vw] max-w-[85vw] snap-center' : 'w-[300px] min-w-[300px] max-w-[300px]'} h-[calc(100vh-200px)] transition-colors ${
```

The `snap-center` class on each column works with the scroll-snap container added in Task 2.

- [ ] **Step 3: Bump touch targets on mobile for column header buttons**

Find the column delete dropdown trigger button (line ~84):

```tsx
<button className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50 transition-colors">
```

Replace with:

```tsx
<button className={`${isMobile ? 'w-10 h-10' : 'w-6 h-6'} rounded-md flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50 transition-colors`}>
```

Find the add card plus button (line ~101):

```tsx
<button
  onClick={() => setShowForm(true)}
  className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-orange-500 dark:hover:text-orange-400 hover:bg-orange-500/10 transition-colors"
  title="Add a card"
>
```

Replace with:

```tsx
<button
  onClick={() => setShowForm(true)}
  className={`${isMobile ? 'w-10 h-10' : 'w-6 h-6'} rounded-md flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-orange-500 dark:hover:text-orange-400 hover:bg-orange-500/10 transition-colors`}
  title="Add a card"
>
```

- [ ] **Step 4: Verify the build compiles**

Run:
```bash
cd frontend && npx next build
```
Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/kanban/Column.tsx
git commit -m "feat(mobile): responsive Kanban column width — 85vw on mobile, 300px on desktop"
```

---

### Task 2: Kanban Board — Scroll-Snap Container + Column Indicator Bar

**Files:**
- Modify: `frontend/components/kanban/Board.tsx:433-470`

**Context:** Board.tsx wraps columns in a `flex gap-5 min-w-max` div inside an `overflow-x-auto` div. On mobile, we add CSS scroll-snap for Trello-style swiping, and a pill bar above the board showing column names with color dots. Tapping a pill scrolls to that column.

- [ ] **Step 1: Add useIsMobile and useRef imports**

In `frontend/components/kanban/Board.tsx`, add import:

```tsx
import { useIsMobile } from '@/hooks/use-mobile';
```

Inside the `Board` function, add:

```tsx
const isMobile = useIsMobile();
const scrollContainerRef = useRef<HTMLDivElement>(null);
```

- [ ] **Step 2: Add the column indicator pill bar**

Inside the return, right before the `<DndContext>` block (after the filter feedback div), add:

```tsx
{/* Mobile Column Indicator Bar */}
{isMobile && allColumns.length > 0 && (
  <div className="flex gap-2 overflow-x-auto pb-2 mb-2 scrollbar-hide">
    {allColumns.map((col, index) => (
      <button
        key={col.status}
        onClick={() => {
          const container = scrollContainerRef.current;
          if (container) {
            const columnWidth = container.scrollWidth / allColumns.length;
            container.scrollTo({ left: columnWidth * index, behavior: 'smooth' });
          }
        }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:border-orange-500/50 transition-colors flex-shrink-0"
      >
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: col.color }} />
        {col.label}
        <span className="text-zinc-400 dark:text-zinc-500">({(projectsByStatus[col.status] || []).length})</span>
      </button>
    ))}
  </div>
)}
```

- [ ] **Step 3: Add scroll-snap classes to the scroll container**

Find the outer scroll container div:

```tsx
<div className="overflow-x-auto pb-4">
  <div className="flex gap-5 min-w-max">
```

Replace with:

```tsx
<div ref={scrollContainerRef} className={`overflow-x-auto pb-4 ${isMobile ? 'snap-x snap-mandatory scroll-smooth' : ''}`}>
  <div className={`flex gap-5 ${isMobile ? '' : 'min-w-max'}`}>
```

On mobile, `snap-x snap-mandatory` enables scroll-snap. We remove `min-w-max` on mobile so columns don't force a minimum width that prevents snap behavior.

- [ ] **Step 4: Verify the build compiles**

Run:
```bash
cd frontend && npx next build
```
Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/kanban/Board.tsx
git commit -m "feat(mobile): scroll-snap Kanban board with column indicator pill bar"
```

---

### Task 3: Kanban Card — Always-Visible Quick-Edit + Touch Targets + Font Bump

**Files:**
- Modify: `frontend/components/kanban/Card.tsx:309-320, 244, 294`

**Context:** The quick-edit pencil button is hover-only (`opacity-0 group-hover/card:opacity-100`). On mobile, hover doesn't exist, so the button must always be visible. Card footer uses `text-[11px]` which is too small on mobile. Touch targets on interactive elements need `min-h-[44px]`.

- [ ] **Step 1: Add useIsMobile import and hook**

In `frontend/components/kanban/Card.tsx`, add:

```tsx
import { useIsMobile } from '@/hooks/use-mobile';
```

Inside the `ProjectCard` component, add:

```tsx
const isMobile = useIsMobile();
```

- [ ] **Step 2: Make quick-edit pencil always visible on mobile**

Find the pencil button (line ~316):

```tsx
className="absolute top-2 right-2 z-20 opacity-0 group-hover/card:opacity-100 transition-opacity w-6 h-6 rounded-md bg-white/90 dark:bg-zinc-800/90 hover:bg-orange-500 hover:text-white flex items-center justify-center shadow-sm backdrop-blur-sm"
```

Replace with:

```tsx
className={`absolute top-2 right-2 z-20 ${isMobile ? 'opacity-100 w-8 h-8' : 'opacity-0 group-hover/card:opacity-100 w-6 h-6'} transition-opacity rounded-md bg-white/90 dark:bg-zinc-800/90 hover:bg-orange-500 hover:text-white flex items-center justify-center shadow-sm backdrop-blur-sm`}
```

On mobile: always visible (opacity-100), larger touch target (w-8 h-8). On desktop: unchanged hover behavior.

- [ ] **Step 3: Bump card footer font size on mobile**

Find the footer div (line ~244):

```tsx
<div className="flex items-center gap-2 text-[11px] text-zinc-400 dark:text-zinc-500 pt-0.5">
```

Replace with:

```tsx
<div className={`flex items-center gap-2 ${isMobile ? 'text-xs' : 'text-[11px]'} text-zinc-400 dark:text-zinc-500 pt-0.5`}>
```

- [ ] **Step 4: Bump checklist progress text on mobile**

Find the checklist progress line (line ~294):

```tsx
<div className="flex items-center gap-2 text-[11px]">
```

Replace with:

```tsx
<div className={`flex items-center gap-2 ${isMobile ? 'text-xs' : 'text-[11px]'}`}>
```

- [ ] **Step 5: Verify the build compiles**

Run:
```bash
cd frontend && npx next build
```
Expected: Build succeeds with no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/kanban/Card.tsx
git commit -m "feat(mobile): always-visible quick-edit, touch targets, font bump on cards"
```

---

### Task 4: ProjectModal — Full-Screen Mobile Layout

**Files:**
- Modify: `frontend/components/project/ProjectModal.tsx:454-772`

**Context:** The ProjectModal uses a fixed two-column layout: left sidebar `w-96` + right content area. On mobile, this must become full-screen (`h-[100dvh] w-full`) with the sidebar stacking vertically as a compact header section. Tabs need to be horizontally scrollable instead of `grid-cols-4`.

- [ ] **Step 1: Add useIsMobile import and hook**

In `frontend/components/project/ProjectModal.tsx`, add:

```tsx
import { useIsMobile } from '@/hooks/use-mobile';
```

Inside the `ProjectModal` function (after the permissions hook), add:

```tsx
const isMobile = useIsMobile();
```

- [ ] **Step 2: Make DialogContent full-screen on mobile**

Find the DialogContent (line ~457):

```tsx
<DialogContent className="max-w-7xl h-[90vh] overflow-hidden p-0 gap-0 flex flex-col rounded-2xl backdrop-blur-md bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/50 dark:border-white/10 ring-1 ring-[#e05c29]/10 shadow-2xl">
```

Replace with:

```tsx
<DialogContent className={`${isMobile ? 'h-[100dvh] w-full max-w-full rounded-none' : 'max-w-7xl h-[90vh] rounded-2xl'} overflow-hidden p-0 gap-0 flex flex-col backdrop-blur-md bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/50 dark:border-white/10 ring-1 ring-[#e05c29]/10 shadow-2xl`}>
```

- [ ] **Step 3: Stack layout vertically on mobile**

Find the left-right layout wrapper (line ~461):

```tsx
<div className="flex flex-1 min-h-0">
```

Replace with:

```tsx
<div className={`${isMobile ? 'flex flex-col' : 'flex'} flex-1 min-h-0`}>
```

- [ ] **Step 4: Convert sidebar to compact header on mobile**

Find the left sidebar div (line ~464):

```tsx
<div className="w-96 border-r border-zinc-200 dark:border-zinc-800 flex flex-col min-h-0">
```

Replace with:

```tsx
<div className={`${isMobile ? 'w-full border-b max-h-[40vh] overflow-y-auto' : 'w-96 border-r'} border-zinc-200 dark:border-zinc-800 flex flex-col min-h-0`}>
```

On mobile: full width, bottom border instead of right, scrollable if content exceeds 40vh, but most fits.

- [ ] **Step 5: Hide cover photo section on mobile to save space**

Find the cover photo section (line ~466):

```tsx
<div className="relative group flex-shrink-0">
```

Replace with:

```tsx
<div className={`relative group flex-shrink-0 ${isMobile ? 'hidden' : ''}`}>
```

The cover photo takes 128-192px of vertical space. On mobile full-screen, the sidebar is a compact header — hiding the cover photo saves critical viewport space.

- [ ] **Step 6: Make sidebar padding compact on mobile**

Find the sidebar content wrapper (line ~502):

```tsx
<div className="flex-1 overflow-y-auto p-6 space-y-6">
```

Replace with:

```tsx
<div className={`flex-1 overflow-y-auto ${isMobile ? 'p-4 space-y-3' : 'p-6 space-y-6'}`}>
```

- [ ] **Step 7: Make tabs horizontally scrollable on mobile**

Find the TabsList (line ~708):

```tsx
<TabsList className="grid w-full grid-cols-4">
```

Replace with:

```tsx
<TabsList className={`${isMobile ? 'flex overflow-x-auto w-full' : 'grid w-full grid-cols-4'}`}>
```

On mobile, tabs become a horizontal scrollable flex row. Each TabsTrigger naturally sizes to its content.

- [ ] **Step 8: Make tab triggers non-shrinkable on mobile**

Find each `TabsTrigger` in the tabs section. Wrap the comments, attachments, and activity triggers to add `whitespace-nowrap` on mobile. Find:

```tsx
<TabsTrigger value="details">Details</TabsTrigger>
<TabsTrigger value="comments">
  <MessageSquare className="w-4 h-4 mr-2" />
  Comments ({project.comments.length})
</TabsTrigger>
<TabsTrigger value="attachments">
  <Paperclip className="w-4 h-4 mr-2" />
  Files ({project.attachments.length})
</TabsTrigger>
<TabsTrigger value="activity">
  <Activity className="w-4 h-4 mr-2" />
  Activity
</TabsTrigger>
```

Replace with:

```tsx
<TabsTrigger value="details" className={isMobile ? 'whitespace-nowrap flex-shrink-0' : ''}>Details</TabsTrigger>
<TabsTrigger value="comments" className={isMobile ? 'whitespace-nowrap flex-shrink-0' : ''}>
  <MessageSquare className="w-4 h-4 mr-2" />
  Comments ({project.comments.length})
</TabsTrigger>
<TabsTrigger value="attachments" className={isMobile ? 'whitespace-nowrap flex-shrink-0' : ''}>
  <Paperclip className="w-4 h-4 mr-2" />
  Files ({project.attachments.length})
</TabsTrigger>
<TabsTrigger value="activity" className={isMobile ? 'whitespace-nowrap flex-shrink-0' : ''}>
  <Activity className="w-4 h-4 mr-2" />
  Activity
</TabsTrigger>
```

- [ ] **Step 9: Make right content area padding compact on mobile**

Find the right content wrapper (line ~702):

```tsx
<div className="p-6">
```

Replace with:

```tsx
<div className={isMobile ? 'p-4' : 'p-6'}>
```

- [ ] **Step 10: Verify the build compiles**

Run:
```bash
cd frontend && npx next build
```
Expected: Build succeeds with no errors.

- [ ] **Step 11: Commit**

```bash
git add frontend/components/project/ProjectModal.tsx
git commit -m "feat(mobile): full-screen ProjectModal with vertical stack layout and scrollable tabs"
```

---

### Task 5: CommentsSection — Sticky Comment Input on Mobile

**Files:**
- Modify: `frontend/components/project/CommentsSection.tsx:259-280`

**Context:** The comment input sits at the bottom of the comments list. On mobile, when scrolling through many comments, the user has to scroll all the way down to type. The input should be sticky at the bottom on mobile, like a chat app input bar.

- [ ] **Step 1: Add useIsMobile import and hook**

In `frontend/components/project/CommentsSection.tsx`, add:

```tsx
import { useIsMobile } from '@/hooks/use-mobile';
```

Inside the `CommentsSection` function, add:

```tsx
const isMobile = useIsMobile();
```

- [ ] **Step 2: Make the comment input area sticky on mobile**

Find the comment input wrapper (line ~259):

```tsx
<div className="border-t pt-4 space-y-2">
```

Replace with:

```tsx
<div className={`border-t pt-4 space-y-2 ${isMobile ? 'sticky bottom-0 bg-white dark:bg-zinc-900 pb-2 z-10' : ''}`}>
```

On mobile: sticks to the bottom of the scrollable area with a solid background so comments don't show through.

- [ ] **Step 3: Make the Post Comment button full-width on mobile**

Find the button wrapper div (line ~270):

```tsx
<div className="flex items-center justify-between">
```

Replace with:

```tsx
<div className={`flex ${isMobile ? 'flex-col gap-2' : 'items-center justify-between'}`}>
```

On mobile: stack the mention hint and button vertically, button takes full width naturally.

- [ ] **Step 4: Verify the build compiles**

Run:
```bash
cd frontend && npx next build
```
Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/project/CommentsSection.tsx
git commit -m "feat(mobile): sticky comment input at bottom like chat app"
```

---

### Task 6: CreateProjectModal — Full-Screen on Mobile + Sticky Buttons

**Files:**
- Modify: `frontend/components/project/CreateProjectModal.tsx:174, 387-394`

**Context:** The CreateProjectModal uses `max-w-lg max-h-[90vh]`. On mobile, it should be full-screen with sticky submit/cancel buttons so they're always reachable.

- [ ] **Step 1: Add useIsMobile import and hook**

In `frontend/components/project/CreateProjectModal.tsx`, add:

```tsx
import { useIsMobile } from '@/hooks/use-mobile';
```

Inside the `CreateProjectModal` function, add:

```tsx
const isMobile = useIsMobile();
```

- [ ] **Step 2: Make DialogContent full-screen on mobile**

Find the DialogContent (line ~174):

```tsx
<DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl backdrop-blur-md bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/50 dark:border-white/10 ring-1 ring-[#e05c29]/10 shadow-2xl">
```

Replace with:

```tsx
<DialogContent className={`${isMobile ? 'h-[100dvh] w-full max-w-full rounded-none' : 'max-w-lg max-h-[90vh] rounded-2xl'} overflow-y-auto backdrop-blur-md bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/50 dark:border-white/10 ring-1 ring-[#e05c29]/10 shadow-2xl`}>
```

- [ ] **Step 3: Make submit/cancel buttons sticky on mobile**

Find the action buttons wrapper (line ~387):

```tsx
<div className="flex gap-2 pt-4">
```

Replace with:

```tsx
<div className={`flex gap-2 pt-4 ${isMobile ? 'sticky bottom-0 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md pb-4 -mx-6 px-6' : ''}`}>
```

On mobile: buttons stick to the bottom, with backdrop-blur so they look integrated. The negative margin + padding extends the background to the dialog edges.

- [ ] **Step 4: Verify the build compiles**

Run:
```bash
cd frontend && npx next build
```
Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/project/CreateProjectModal.tsx
git commit -m "feat(mobile): full-screen CreateProjectModal with sticky action buttons"
```

---

### Task 7: Navbar — Mobile Search Icon + Overlay

**Files:**
- Modify: `frontend/components/layout/Navbar.tsx:59-139`

**Context:** The search bar is hidden on mobile (`hidden sm:block`). A search icon button needs to appear on mobile. Tapping it opens a full-width search overlay that slides down from the navbar with an auto-focused input and close button.

- [ ] **Step 1: Add useState for search overlay**

In `frontend/components/layout/Navbar.tsx`, the component already imports `useState`. Add state for the mobile search overlay inside the `Navbar` function:

```tsx
const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
```

- [ ] **Step 2: Add mobile search icon button**

Find the right actions section (line ~89):

```tsx
<div className="flex items-center gap-4">
```

Add a mobile search button right after this opening div:

```tsx
<div className="flex items-center gap-4">
  {/* Mobile Search Button */}
  <Button
    variant="ghost"
    size="icon"
    onClick={() => setMobileSearchOpen(true)}
    className="sm:hidden"
  >
    <Search className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
  </Button>
```

- [ ] **Step 3: Add mobile search overlay**

Right before the closing `</header>` tag, add the overlay:

```tsx
{/* Mobile Search Overlay */}
{mobileSearchOpen && (
  <div className="absolute top-full left-0 right-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-3 shadow-lg sm:hidden z-50">
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400 w-4 h-4" />
        <Input
          placeholder="Search projects..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setMobileSearchOpen(false);
            }
          }}
        />
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setMobileSearchOpen(false)}
        className="flex-shrink-0"
      >
        <X className="w-5 h-5" />
      </Button>
    </div>
  </div>
)}
```

- [ ] **Step 4: Add X import**

The `X` icon is not currently imported in Navbar.tsx. Add it to the existing lucide-react import. Find:

```tsx
import { Search, LogOut, Settings, User, Moon, Sun, Menu } from 'lucide-react';
```

Replace with:

```tsx
import { Search, LogOut, Settings, User, Moon, Sun, Menu, X } from 'lucide-react';
```

- [ ] **Step 5: Verify the build compiles**

Run:
```bash
cd frontend && npx next build
```
Expected: Build succeeds with no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/layout/Navbar.tsx
git commit -m "feat(mobile): search icon + full-width search overlay on mobile"
```

---

### Task 8: Workspace Page — Responsive Filters + DeleteConfirmation Mobile Safety

**Files:**
- Modify: `frontend/app/dashboard/[workspace]/page.tsx:175-278`
- Modify: `frontend/components/shared/DeleteConfirmation.tsx:67`

**Context:** The workspace page header has filter/sort/action buttons that can overflow on narrow screens. They need `w-full sm:w-auto` stacking. The DeleteConfirmation modal needs `max-w-[calc(100vw-2rem)]` on mobile to prevent edge clipping.

- [ ] **Step 1: Make filter buttons stack on very narrow screens**

In `frontend/app/dashboard/[workspace]/page.tsx`, find the button group wrapper (line ~175):

```tsx
<div className="flex flex-wrap items-center gap-2 md:gap-5">
```

Replace with:

```tsx
<div className="flex flex-wrap items-center gap-2 md:gap-5 w-full md:w-auto">
```

Then find the inner filter wrapper (line ~176):

```tsx
<div className="flex flex-wrap items-center gap-2">
```

Replace with:

```tsx
<div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
```

- [ ] **Step 2: Make action buttons full-width on narrow mobile**

Find the "Delete Workspace" button (line ~241):

```tsx
<Button
  onClick={() => setDeleteTarget({
```

Add responsive width. The button's parent flex-wrap already handles wrapping. Find the three action buttons (Delete Workspace, Add Column, New Project) and add `w-full sm:w-auto` to each.

Find the Delete Workspace button:
```tsx
className="border-red-500/30 hover:bg-red-500/10 text-red-500 hover:text-red-600"
```
Replace with:
```tsx
className="border-red-500/30 hover:bg-red-500/10 text-red-500 hover:text-red-600 w-full sm:w-auto"
```

Find the Add Column button:
```tsx
className="border-orange-500/50 hover:bg-orange-500/10 dark:border-orange-500/50 dark:hover:bg-orange-500/10"
```
Replace with:
```tsx
className="border-orange-500/50 hover:bg-orange-500/10 dark:border-orange-500/50 dark:hover:bg-orange-500/10 w-full sm:w-auto"
```

Find the New Project button:
```tsx
className="bg-orange-500 hover:bg-orange-600 dark:bg-orange-500 dark:hover:bg-orange-600 dark:shadow-lg dark:shadow-orange-500/50"
```
Replace with:
```tsx
className="bg-orange-500 hover:bg-orange-600 dark:bg-orange-500 dark:hover:bg-orange-600 dark:shadow-lg dark:shadow-orange-500/50 w-full sm:w-auto"
```

- [ ] **Step 3: Add mobile max-width to DeleteConfirmation**

In `frontend/components/shared/DeleteConfirmation.tsx`, find the DialogContent (line ~67):

```tsx
<DialogContent className="max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
```

Replace with:

```tsx
<DialogContent className="max-w-md max-w-[calc(100vw-2rem)] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
```

This ensures the dialog never overflows past 1rem from each screen edge on narrow viewports.

- [ ] **Step 4: Verify the build compiles**

Run:
```bash
cd frontend && npx next build
```
Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/dashboard/[workspace]/page.tsx frontend/components/shared/DeleteConfirmation.tsx
git commit -m "feat(mobile): responsive workspace filters and mobile-safe delete confirmation"
```
