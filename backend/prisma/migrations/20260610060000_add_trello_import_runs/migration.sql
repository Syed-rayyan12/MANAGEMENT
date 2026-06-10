-- CreateEnum
CREATE TYPE "TrelloImportStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN "trelloLastActivity" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "trello_import_runs" (
    "id" TEXT NOT NULL,
    "status" "TrelloImportStatus" NOT NULL DEFAULT 'RUNNING',
    "trelloBoardId" TEXT NOT NULL,
    "totalCards" INTEGER NOT NULL DEFAULT 0,
    "processedCards" INTEGER NOT NULL DEFAULT 0,
    "imported" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "commentsImported" INTEGER NOT NULL DEFAULT 0,
    "commentsFailed" INTEGER NOT NULL DEFAULT 0,
    "attachmentsImported" INTEGER NOT NULL DEFAULT 0,
    "attachmentsFailed" INTEGER NOT NULL DEFAULT 0,
    "newBoards" JSONB NOT NULL DEFAULT '[]',
    "details" JSONB NOT NULL DEFAULT '[]',
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "createdById" TEXT,

    CONSTRAINT "trello_import_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trello_import_runs_status_idx" ON "trello_import_runs"("status");

-- AddForeignKey
ALTER TABLE "trello_import_runs" ADD CONSTRAINT "trello_import_runs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
