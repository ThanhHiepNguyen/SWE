/*
  Warnings:

  - The `status` column on the `CodeSession` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'TIMEOUT');

-- AlterTable
ALTER TABLE "CodeSession" ALTER COLUMN "sourceCode" SET DEFAULT '',
DROP COLUMN "status",
ADD COLUMN     "status" "SessionStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "Execution" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "status" "ExecutionStatus" NOT NULL DEFAULT 'QUEUED',
    "stdout" TEXT,
    "stderr" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "executionTimeMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Execution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Execution_sessionId_idx" ON "Execution"("sessionId");

-- CreateIndex
CREATE INDEX "Execution_status_idx" ON "Execution"("status");

-- AddForeignKey
ALTER TABLE "Execution" ADD CONSTRAINT "Execution_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CodeSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
