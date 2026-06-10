# Trello Import — Background Job Redesign

## Problem

The current import is driven by the browser: the frontend loops over batches and each
`POST /api/trello/import-batch` request stays open while the backend spends minutes
downloading Trello attachments and uploading them to R2, writing zero response bytes
until the end. Long silent connections get dropped by proxies (Railway edge), surfacing
in the client as a generic "Network error". One dropped batch aborts the entire import
with no retry or resume, and re-runs are as expensive as the first run because the
update path deletes and re-imports all comments/attachments for every card.

## Goal

Move the import server-side as a background job so no long-lived HTTP request exists,
make progress observable via polling, and make re-runs cheap via incremental sync.
No scheduled/daily runs (explicitly out of scope for now).

## Schema Changes

### `Project.trelloLastActivity DateTime?`

Stores the Trello card's `dateLastActivity` at the time it was last synced. On
subsequent runs, a card whose `dateLastActivity` has not advanced is skipped entirely
(no overwrite, no comment/attachment churn, no R2 ops).

### New model: `TrelloImportRun`

```prisma
enum TrelloImportStatus {
  RUNNING
  COMPLETED
  FAILED
}

model TrelloImportRun {
  id                  String             @id @default(uuid())
  status              TrelloImportStatus @default(RUNNING)
  trelloBoardId       String
  totalCards          Int                @default(0)
  processedCards      Int                @default(0)
  imported            Int                @default(0)
  updated             Int                @default(0)
  skipped             Int                @default(0)
  failed              Int                @default(0)
  commentsImported    Int                @default(0)
  commentsFailed      Int                @default(0)
  attachmentsImported Int                @default(0)
  attachmentsFailed   Int                @default(0)
  newBoards           Json               @default("[]")
  details             Json               @default("[]")
  error               String?
  startedAt           DateTime           @default(now())
  finishedAt          DateTime?
  createdById         String?
  createdBy           User?              @relation(fields: [createdById], references: [id], onDelete: SetNull)

  @@map("trello_import_runs")
}
```

`details` holds the per-card result list (`{ cardName, status, reason? }`) so the
summary survives page reloads. Trello credentials are **never persisted** — they live
only in process memory for the duration of the run.

## Backend

### New service: `src/services/trelloImport.service.ts`

All import logic moves here from the controller.

- `startImportRun({ apiKey, token, trelloBoardId, userId })` — creates the run row,
  fires the async processor (not awaited), returns the run id. Enforces a single
  active run via an in-process flag; callers get an error if a run is already active.
- `failInterruptedRuns()` — called once at app startup (same pattern as
  `purgeExpiredTrash()`): marks any `RUNNING` rows as `FAILED` with
  "Interrupted by server restart". Since credentials are not persisted, a restarted
  run cannot resume; incremental sync makes the manual re-run cheap.
- The processor:
  1. Fetches board lists + cards from Trello (now including `dateLastActivity`).
  2. Updates the run with `totalCards`.
  3. Processes cards **sequentially**. Per card:
     - If a project with this `trelloCardId` exists and the card's
       `dateLastActivity <= project.trelloLastActivity` → count as `skipped`, continue.
     - Otherwise create/update the project (same mapping logic as today: board slug
       detection, priority from labels, auto-create boards with default columns),
       re-import comments and attachments (existing destructive-replace semantics,
       now only for cards that actually changed), and store `trelloLastActivity`.
     - One retry on per-card failure (transient network errors), then count `failed`
       with the reason in `details`.
     - Update the run row counters after each card so polling sees live progress.
  4. On completion sets `COMPLETED` + `finishedAt`; a fatal error (e.g. board fetch
     failed) sets `FAILED` + `error`.

### Controller / routes

`trello.controller.ts` becomes thin:

- `GET  /api/trello/boards` — unchanged.
- `POST /api/trello/import` — body `{ apiKey, token, trelloBoardId }`. Returns
  `202 { data: { runId } }`. `409` if a run is already active.
- `GET  /api/trello/import/latest` — most recent run (or `data: null`).
- `GET  /api/trello/import/:runId` — run status/progress/summary.
- `POST /api/trello/prepare` and `POST /api/trello/import-batch` are **removed**.

All endpoints keep the hardcoded `prod.tahiranwar` authorization.

Rate limiting: `/api/trello` moves off the shared 200-req/15-min limiter onto its own
more permissive limiter (600/15 min) so status polling (every 5 s, ~180 req/15 min)
cannot exhaust the shared budget and break the rest of the app. The route is
authenticated and restricted to a single user, so the looser limit is safe.

## Frontend

`lib/api-service.ts` — `trelloAPI` becomes `getBoards`, `startImport`, `getRun`,
`getLatestRun` (prepare/importBatch removed).

`app/dashboard/import/page.tsx`:

- "Import Projects" calls `startImport`, then polls `getRun(runId)` every 5 seconds
  until status is `COMPLETED` or `FAILED`.
- On page load, fetches `getLatestRun`; if it is `RUNNING`, resumes polling — the
  import survives tab closes, navigation, and laptop sleep.
- Progress bar uses `processedCards / totalCards`; the summary cards and detail table
  render from the run row (same shapes as today).
- UI notes that the import runs on the server and the page can be closed.

## Error handling

- Browser/network blips now only affect polling, which simply retries on the next tick.
- Per-card failures are retried once, then recorded in `details` without aborting the run.
- A failed run shows its `error`; re-running is cheap because unchanged cards skip.

## Testing / verification

No test framework exists in either package. Verification: `tsc` builds for backend and
frontend, `prisma generate` + migration, and a manual smoke run against a real Trello
board.

## Non-goals

- No daily/scheduled sync (explicitly deferred).
- No credential storage.
- No change to the single-user authorization.
- No streaming/websocket progress (polling is sufficient).
