-- CreateEnum
CREATE TYPE "PublishStatus" AS ENUM ('QUEUED', 'PROCESSING', 'PUBLISHED', 'FAILED');

-- CreateTable
CREATE TABLE "publishing_jobs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "socialAccountId" TEXT,
    "status" "PublishStatus" NOT NULL DEFAULT 'QUEUED',
    "platformPostId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "privacyStatus" TEXT NOT NULL,
    "fileName" TEXT,
    "fileSizeBytes" BIGINT,
    "error" TEXT,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "publishing_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "publishing_jobs_userId_createdAt_idx" ON "publishing_jobs"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "publishing_jobs" ADD CONSTRAINT "publishing_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishing_jobs" ADD CONSTRAINT "publishing_jobs_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "social_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
