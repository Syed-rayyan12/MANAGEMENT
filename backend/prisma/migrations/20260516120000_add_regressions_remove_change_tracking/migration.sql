-- Migration: add_regressions_remove_change_tracking
-- Removes legacy change tracking fields from projects table
-- Adds regressions table for tracking backward column moves

-- Remove legacy change tracking columns from projects
ALTER TABLE "projects" DROP COLUMN IF EXISTS "minorChanges";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "majorChanges";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "majorChangeReason";

-- Create regressions table
CREATE TABLE "regressions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "causedById" TEXT NOT NULL,
    "fromColumn" TEXT NOT NULL,
    "toColumn" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "regressions_pkey" PRIMARY KEY ("id")
);

-- Create indexes on regressions
CREATE INDEX "regressions_userId_idx" ON "regressions"("userId");
CREATE INDEX "regressions_projectId_idx" ON "regressions"("projectId");

-- Add foreign key constraints
ALTER TABLE "regressions" ADD CONSTRAINT "regressions_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "regressions" ADD CONSTRAINT "regressions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "regressions" ADD CONSTRAINT "regressions_causedById_fkey"
    FOREIGN KEY ("causedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
