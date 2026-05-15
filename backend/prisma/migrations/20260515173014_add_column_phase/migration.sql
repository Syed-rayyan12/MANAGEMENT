-- CreateEnum
CREATE TYPE "ColumnPhase" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'DONE', 'ON_HOLD');

-- AlterTable
ALTER TABLE "board_columns" ADD COLUMN     "phase" "ColumnPhase" NOT NULL DEFAULT 'NOT_STARTED';
