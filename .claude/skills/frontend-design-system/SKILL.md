---
name: CRM Frontend Design System
description: Comprehensive design system and UI rules for the ProManage CRM. Apply these rules to EVERY frontend component, page, and layout. Brand color is #e05c29. Stack is Next.js + Tailwind CSS + shadcn/ui.
---

# CRM Frontend Design System

**This is the single source of truth for all frontend UI decisions.** Every component, page, modal, table, and layout must follow these rules exactly. No exceptions, no improvisation.

## Brand Foundation

**Primary color:** `#e05c29` — warm burnt orange. This is the only accent color. Never introduce competing accent colors (no blue, teal, or purple accents).

**Design language:** Minimal, modern, soft, professional. Think Linear meets Notion meets a premium SaaS dashboard — with a warm, human undertone driven by the brand orange.

---

## Color Palette

### Surfaces

| Context | Light Mode | Dark Mode |
|---------|-----------|-----------|
| Page background | `bg-zinc-50` | `bg-zinc-950` |
| Card / panel | `bg-white` | `bg-zinc-900` |
| Elevated surface | `bg-white` | `bg-zinc-800` |
| Inset / input bg | `bg-white` | `bg-zinc-800` |

### Text

| Context | Class |
|---------|-------|
| Primary text | `text-zinc-900 dark:text-zinc-100` |
| Secondary text | `text-zinc-500 dark:text-zinc-400` |
| Placeholder | `text-zinc-400 dark:text-zinc-500` |
| Labels / table headers | `text-xs font-medium uppercase tracking-wide text-zinc-400` |

> **Never** use pure black (`text-black`). Always use `text-zinc-900` at most.

### Status Colors (always muted, never full saturation)

```
Success:  bg-emerald-500/15 text-emerald-600 dark:text-emerald-400
Warning:  bg-amber-500/15   text-amber-600   dark:text-amber-400
Danger:   bg-red-500/15     text-red-600     dark:text-red-400
Neutral:  bg-zinc-500/15    text-zinc-600    dark:text-zinc-400
```

### Brand Accent Neighbors

Only use these warm colors alongside `#e05c29`:
- `orange-400` — lighter warm
- `amber-400` — golden warm
- `rose-500` — hover energy shift

**Forbidden accent colors:** blue, teal, purple, cyan, indigo, violet — they fight the brand.

---

## Gradient System

Gradients are mood lighting, not decoration. Use sparingly and precisely.

### Page / Hero Backgrounds
```html
<!-- Extremely subtle warm wash — makes page feel alive -->
<div class="bg-gradient-to-br from-[#e05c29]/8 via-orange-400/4 to-transparent">
```
Applied as a fixed radial or top-left diagonal on dashboard backgrounds.

### Sidebar Active Nav Item
```html
<a class="bg-gradient-to-r from-[#e05c29]/20 to-[#e05c29]/5 border-l-2 border-[#e05c29]">
```

### Primary Buttons
```html
<!-- Default -->
<button class="bg-gradient-to-r from-[#e05c29] to-orange-400 shadow-[0_4px_20px_rgba(224,92,41,0.35)]">

<!-- Hover shift -->
<button class="bg-gradient-to-r from-[#e05c29] to-orange-400 hover:to-rose-500 shadow-[0_4px_20px_rgba(224,92,41,0.35)]">
```

### Card Highlights / Featured Rows
```html
<!-- Barely-there warm tint for pinned items, priority records -->
<div class="bg-gradient-to-r from-[#e05c29]/6 to-amber-300/4">
```

### KPI / Stat Card Top Border
```html
<div class="relative overflow-hidden rounded-xl">
  <div class="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#e05c29] to-amber-400"></div>
  <!-- card content -->
</div>
```

### Dark Mode Surfaces
```html
<!-- Base dark surface with warm glow layered on top -->
<div class="bg-gradient-to-br from-zinc-900 to-zinc-950">
```
Layer orange gradients on top at very low opacity so they glow softly in dark mode.

### Gradient Rules
- ✅ Warm-to-warm gradients only
- ✅ Neutral-to-neutral for backgrounds is fine
- ❌ Never use cool-colored gradients (blue, teal, purple)
- In dark mode, orange gradients can be slightly higher opacity — the brand pops more against dark surfaces

---

## Glassmorphism

Apply to: modals, floating panels, command palette, dropdown menus, sidebar.

```html
<div class="
  backdrop-blur-md
  bg-white/60 dark:bg-zinc-900/60
  border border-zinc-200/50 dark:border-white/10
  shadow-xl shadow-black/5
">
```

On modals, add a faint warm inner glow:
```html
<div class="ring-1 ring-[#e05c29]/10">
```

---

## Border Radius

| Element | Radius |
|---------|--------|
| Cards, panels | `rounded-xl` |
| Inputs, buttons | `rounded-lg` |
| Badges, avatars | `rounded-full` |
| Modals | `rounded-2xl` |

**Consistency rule:** Never mix sharp and round corners on the same component level.

---

## Typography

**Font:** Inter or Geist (loaded via Next.js font optimization).

| Context | Rules |
|---------|-------|
| Headings | `font-semibold` (NOT `font-bold` — it's softer) |
| Body | `font-normal` |
| Labels / table headers | `text-xs font-medium uppercase tracking-wide text-zinc-400` |
| Numbers / stats | `text-3xl font-semibold` for KPI values |

---

## Spacing

Generous and breathable. Whitespace is a feature, not waste.

| Context | Spacing |
|---------|---------|
| Card padding | `p-5` or `p-6` |
| Table row padding | `py-3` (not cramped) |
| Sidebar items | `px-3 py-2` |
| Section separation | Use whitespace (`space-y-6`), not dividers |

Use dividers sparingly. Prefer whitespace to separate sections.

---

## Shadows

Soft and layered. Never harsh or dark.

| Element | Shadow |
|---------|--------|
| Cards | `shadow-sm` |
| Dropdowns | `shadow-lg shadow-black/10` |
| Modals | `shadow-2xl` |
| Primary buttons | `shadow-[0_4px_20px_rgba(224,92,41,0.35)]` |

---

## Component Specifications

### Buttons

**Primary** — brand gradient + warm shadow, white text:
```html
<button class="
  inline-flex items-center justify-center
  rounded-lg px-4 py-2 text-sm font-medium text-white
  bg-gradient-to-r from-[#e05c29] to-orange-400
  hover:to-rose-500
  shadow-[0_4px_20px_rgba(224,92,41,0.35)]
  transition-all duration-200 ease-out
  disabled:opacity-50 disabled:cursor-not-allowed
">
```

**Secondary:**
```html
<button class="
  rounded-lg px-4 py-2 text-sm font-medium
  bg-zinc-100 dark:bg-zinc-800
  text-zinc-700 dark:text-zinc-300
  hover:bg-zinc-200 dark:hover:bg-zinc-700
  transition-all duration-200 ease-out
">
```

**Ghost:**
```html
<button class="
  rounded-lg px-4 py-2 text-sm font-medium
  text-zinc-600 dark:text-zinc-400
  hover:text-[#e05c29] hover:border hover:border-[#e05c29]/30
  transition-all duration-200 ease-out
">
```

**Destructive:**
```html
<button class="
  rounded-lg px-4 py-2 text-sm font-medium
  bg-red-500/10 text-red-600 dark:text-red-400
  hover:bg-red-500/20
  transition-all duration-200 ease-out
">
```

---

### Forms & Inputs

**Input field:**
```html
<input class="
  w-full rounded-lg px-3 py-2 text-sm
  border border-zinc-200 dark:border-zinc-700
  bg-white dark:bg-zinc-800
  text-zinc-900 dark:text-zinc-100
  placeholder:text-zinc-400
  focus:outline-none focus:ring-2 focus:ring-[#e05c29]/30 focus:border-[#e05c29]
  transition-all duration-200 ease-out
" />
```

**Label:**
```html
<label class="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
```

**Error state:**
```html
<input class="border-red-400 ring-red-400/20 focus:ring-red-400/30 focus:border-red-400" />
<p class="mt-1 text-xs text-red-500">Error message here</p>
```

All selects, date pickers, and multi-selects must match this exact input styling.

---

### Tables (critical — heavily used across CRM)

```html
<table class="w-full text-sm">
  <!-- Header -->
  <thead>
    <tr class="bg-zinc-50 dark:bg-zinc-800/50">
      <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-400">
        Column Name
      </th>
    </tr>
  </thead>

  <!-- Body -->
  <tbody>
    <tr class="
      bg-white dark:bg-zinc-900
      border-b border-zinc-100 dark:border-zinc-800
      hover:bg-[#e05c29]/4 dark:hover:bg-[#e05c29]/6
      transition-colors duration-150
      group
    ">
      <td class="px-4 py-3">Cell content</td>

      <!-- Actions: hidden, revealed on hover -->
      <td class="px-4 py-3">
        <div class="opacity-0 group-hover:opacity-100 transition-opacity">
          <!-- icon buttons -->
        </div>
      </td>
    </tr>

    <!-- Selected row -->
    <tr class="bg-[#e05c29]/8 border-l-2 border-[#e05c29]">
      <td class="px-4 py-3">Selected cell</td>
    </tr>
  </tbody>
</table>

<!-- Pagination: minimal, right-aligned -->
<div class="flex justify-end items-center gap-2 mt-4">
  <button class="px-3 py-1 rounded-lg text-sm text-zinc-500">Previous</button>
  <button class="px-3 py-1 rounded-lg text-sm bg-[#e05c29] text-white">1</button>
  <button class="px-3 py-1 rounded-lg text-sm text-zinc-500 hover:bg-zinc-100">2</button>
  <button class="px-3 py-1 rounded-lg text-sm text-zinc-500">Next</button>
</div>
```

**Table requirements:**
- Sortable column headers: show sort icon only on hover or when active
- Search bar above the table
- Column visibility toggle
- Filter chips above the table
- Bulk select with floating action bar

---

### Sidebar Navigation

```html
<aside class="
  w-60 data-[collapsed=true]:w-16
  h-screen flex flex-col
  bg-white dark:bg-zinc-900
  border-r border-zinc-200 dark:border-zinc-800
  transition-all duration-300 ease-out
">
  <!-- Logo area -->
  <div class="p-4 flex items-center gap-2">
    <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-[#e05c29] to-orange-400 flex items-center justify-center text-white font-semibold text-sm">P</div>
    <span class="font-semibold text-zinc-900 dark:text-zinc-100">ProManage</span>
  </div>

  <!-- Section label -->
  <p class="px-4 pt-4 pb-1 text-[10px] font-medium uppercase tracking-widest text-zinc-400">
    Main Menu
  </p>

  <!-- Nav items -->
  <!-- Default state -->
  <a class="mx-2 px-3 py-2 rounded-lg flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all duration-200">
    <Icon class="w-4 h-4" />
    <span>Dashboard</span>
  </a>

  <!-- Active state -->
  <a class="mx-2 px-3 py-2 rounded-lg flex items-center gap-3 text-sm font-medium text-[#e05c29] bg-gradient-to-r from-[#e05c29]/15 to-[#e05c29]/5 border-l-2 border-[#e05c29]">
    <Icon class="w-4 h-4" />
    <span>Projects</span>
  </a>

  <!-- Bottom area: user -->
  <div class="mt-auto p-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-3">
    <div class="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700"></div>
    <div>
      <p class="text-sm font-medium text-zinc-900 dark:text-zinc-100">Username</p>
      <p class="text-xs text-zinc-400">Role</p>
    </div>
  </div>
</aside>
```

---

### Modals

```html
<!-- Overlay -->
<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
  <!-- Modal -->
  <div class="
    w-full max-w-lg
    rounded-2xl
    bg-white/80 dark:bg-zinc-900/80
    backdrop-blur-md
    border border-zinc-200/50 dark:border-white/10
    ring-1 ring-[#e05c29]/10
    shadow-2xl
    animate-in fade-in zoom-in-95 duration-200
  ">
    <!-- Header -->
    <div class="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
      <h2 class="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Modal Title</h2>
      <button class="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800">
        <XIcon class="w-4 h-4" />
      </button>
    </div>

    <!-- Body -->
    <div class="px-6 py-4">
      <!-- Content -->
    </div>

    <!-- Footer -->
    <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-100 dark:border-zinc-800">
      <button class="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800">
        Cancel
      </button>
      <button class="rounded-lg px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-[#e05c29] to-orange-400 shadow-[0_4px_20px_rgba(224,92,41,0.35)]">
        Confirm
      </button>
    </div>
  </div>
</div>
```

**Modal sizes:** `max-w-lg` for simple forms, `max-w-2xl` for complex content.

---

### Badges / Status Pills

```html
<!-- Success -->
<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
  Active
</span>

<!-- Warning -->
<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400">
  Pending
</span>

<!-- Danger -->
<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-500/15 text-red-600 dark:text-red-400">
  Overdue
</span>

<!-- Brand -->
<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-[#e05c29]/15 text-[#e05c29]">
  Priority
</span>
```

Never use filled solid-color badges. Always soft background + matching text.

---

### KPI / Stat Cards

```html
<div class="relative overflow-hidden rounded-xl bg-white dark:bg-zinc-900 p-5 shadow-sm">
  <!-- Top gradient border accent -->
  <div class="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#e05c29] to-amber-400"></div>

  <p class="text-sm font-medium text-zinc-500 dark:text-zinc-400">Total Revenue</p>
  <p class="mt-1 text-3xl font-semibold text-zinc-900 dark:text-zinc-100">$54,230</p>

  <!-- Trend indicator -->
  <div class="mt-2 flex items-center gap-1 text-xs">
    <span class="text-emerald-600 dark:text-emerald-400">↑ 12.5%</span>
    <span class="text-zinc-400">vs last month</span>
  </div>
</div>
```

---

### Kanban Board

**Column:**
```html
<div class="flex-1 min-w-[280px] max-w-[340px] flex flex-col rounded-xl bg-zinc-50 dark:bg-zinc-900/50">
  <!-- Column header -->
  <div class="px-4 py-3 flex items-center justify-between">
    <div class="flex items-center gap-2">
      <h3 class="text-sm font-semibold text-zinc-700 dark:text-zinc-300">In Progress</h3>
      <span class="rounded-full bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 text-xs font-medium text-zinc-500">4</span>
    </div>
  </div>

  <!-- Cards container -->
  <div class="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
    <!-- Kanban card -->
    <div class="
      rounded-xl bg-white dark:bg-zinc-900 p-4 shadow-sm
      border-l-2 border-[#e05c29]
      hover:shadow-md hover:-translate-y-0.5
      transition-all duration-200 ease-out
      cursor-grab active:cursor-grabbing
    ">
      <!-- Priority tags -->
      <div class="flex gap-1.5 mb-2">
        <span class="rounded-full px-2 py-0.5 text-[10px] font-medium bg-red-500/15 text-red-600">High</span>
      </div>

      <h4 class="text-sm font-medium text-zinc-900 dark:text-zinc-100">Task title</h4>
      <p class="mt-1 text-xs text-zinc-500 line-clamp-2">Description preview...</p>

      <!-- Footer -->
      <div class="mt-3 flex items-center justify-between">
        <div class="flex -space-x-1.5">
          <!-- Avatar stack -->
          <div class="w-6 h-6 rounded-full border-2 border-white dark:border-zinc-900 bg-zinc-200"></div>
        </div>
        <span class="text-[10px] text-zinc-400">Mar 26</span>
      </div>
    </div>
  </div>

  <!-- Add card button -->
  <div class="px-3 pb-3">
    <button class="
      w-full rounded-lg py-2 text-sm font-medium
      border border-dashed border-zinc-300 dark:border-zinc-700
      text-zinc-400 hover:text-[#e05c29] hover:border-[#e05c29]/40
      transition-all duration-200
    ">
      + Add Card
    </button>
  </div>
</div>
```

**Drag states:**
- Active card: slight rotation (`rotate-2`), increased shadow (`shadow-lg`), slight opacity (`opacity-90`)
- Drop placeholder: dashed border with brand color tint
- Column highlight on dragover: very subtle top gradient in brand color

---

## Interaction & Motion

**Default transition for everything:**
```
transition-all duration-200 ease-out
```

| Interaction | Behavior |
|------------|----------|
| Every hover state | Visible but never jarring |
| Sidebar collapse | Smooth width transition (`duration-300`) |
| Modal open/close | Fade + scale from 95% to 100% |
| Table row hover | Instant, no delay |
| Kanban drag | Fluid, card follows cursor naturally |
| Page transitions | Subtle fade between routes |

**Forbidden:** Bouncy or springy animations. This is a professional tool.

---

## Dark Mode

Full dark mode is **required** on every component. Not optional, not "later."

**Dark mode rules:**
- Use `dark:` variant on every element that changes between modes
- Surfaces: `white → zinc-900`, backgrounds: `zinc-50 → zinc-950`
- Borders: `zinc-200 → zinc-800`
- Text: `zinc-900 → zinc-100`
- Brand orange `#e05c29` stays **exactly the same** — it pops more in dark mode
- Orange gradients can be slightly higher opacity in dark mode (they glow softly)

---

## AI Output Rules

When generating code using this design system, **always:**

1. Use Tailwind utility classes exclusively — **no inline styles**
2. Use `dark:` variants on every element that changes between modes
3. Follow the exact component rules above for the respective component type
4. **Never invent new patterns** — stick to this system
5. Always generate **full components**, not fragments
6. Use semantic HTML — `<table>`, `<nav>`, `<main>`, `<aside>`, `<section>`
7. Include hover, focus, active, and disabled states on all interactive elements
8. Reference `#e05c29` directly in Tailwind arbitrary value brackets: `text-[#e05c29]`, `bg-[#e05c29]`, etc.
9. Never use competing accent colors — everything traces back to `#e05c29`
10. Every generated card, table, modal, and input must match the specifications above exactly
