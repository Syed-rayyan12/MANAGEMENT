# Kanban Board UX Cleanup — Design Spec

**Date:** 2026-05-15
**Goal:** Declutter the Kanban board cards and columns to feel clean and smooth like Trello, while keeping all functionality accessible.

## Problem

Cards display too much information (8 stacked sections), use excessive borders/containers, and the columns feel rigid. The result is a cluttered, noisy board that lacks the visual calm of tools like Trello.

## Changes

### 1. Slim Down Cards

**Remove from card surface:**
- Latest comment preview (accessible in modal)
- Explicit drag handle bar (make entire card draggable)
- Inline "add member" button (move to modal only)

**Keep on card surface:**
- Cover image (optional, when present)
- Title
- Member avatars (overlapping, no add button)
- Compact footer row: priority dot + due date + comment count + attachment count

**Card anatomy (new):**
```
┌─────────────────────────┐
│ [cover image, optional] │
│                         │
│ Project Title Here      │
│                         │
│ 👤👤👤                   │
│                         │
│ 🔴 Medium  📅 May 20  💬3 📎1 │
│ ██████░░░░ 4/7          │  ← checklist bar, only if checklist exists
└─────────────────────────┘
```

### 2. Simplify Card Styling

**Before:** `border border-zinc-200 border-l-2 border-l-[#e05c29]` + inner comment box with its own border
**After:** No left accent border. Use `shadow-sm hover:shadow-md` on white/dark bg. Clean single surface.

- Drop `border-l-2 border-l-[#e05c29]`
- Use `shadow-sm` for default state, `shadow-md` on hover
- Keep `rounded-xl`
- Remove `space-y-3` between sections, use tighter `space-y-2`
- Priority becomes a small colored dot + text, not a full badge with background

### 3. Improve Columns

- Gap between columns: `gap-4` → `gap-5`
- Column background: more distinct from cards — `bg-zinc-100 dark:bg-zinc-900/70`
- Column width stays at 320px (good for content)
- Column header: simpler, just label + count
- Card gap within column: `space-y-2` → `space-y-2.5`

### 4. Quick Edit → Popover

Replace the full-card overlay (`absolute inset-0`) with a small dropdown popover that appears next to the pencil button. Card content stays visible underneath.

- Use shadcn `Popover` component
- Contains: name input, priority buttons, status buttons, save
- Positioned top-right, aligned to pencil button
- Click outside or Escape closes

## What Does NOT Change

- All existing functionality (drag-and-drop, permissions, modals, filters)
- The project modal (separate improvement later)
- Dark mode support (all changes include dark variants)
- Mobile responsiveness

## Files Modified

1. `frontend/components/kanban/Card.tsx` — major restructure
2. `frontend/components/kanban/Column.tsx` — spacing and background tweaks
3. `frontend/components/kanban/Board.tsx` — column gap adjustment

## Success Criteria

- Cards show max 4-5 visual elements (title, avatars, footer icons, optional image, optional checklist)
- No nested bordered containers within cards
- Board feels spacious, cards "pop" off column backgrounds
- Quick edit doesn't obscure card content
