-- AlterTable
ALTER TABLE "boards" ADD COLUMN "deleted_at" TIMESTAMP(3),
                     ADD COLUMN "deleted_by_id" TEXT;

-- AlterTable
ALTER TABLE "board_columns" ADD COLUMN "deleted_at" TIMESTAMP(3),
                             ADD COLUMN "deleted_by_id" TEXT;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN "deleted_at" TIMESTAMP(3),
                       ADD COLUMN "deleted_by_id" TEXT;

-- AddForeignKey
ALTER TABLE "boards" ADD CONSTRAINT "boards_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_columns" ADD CONSTRAINT "board_columns_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
