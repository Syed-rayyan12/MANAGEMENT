-- AlterTable
ALTER TABLE "projects" ADD COLUMN "trelloCardId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "projects_trelloCardId_key" ON "projects"("trelloCardId");
