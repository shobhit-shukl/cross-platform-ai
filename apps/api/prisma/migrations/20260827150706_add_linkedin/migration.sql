-- AlterEnum
ALTER TYPE "Platform" ADD VALUE 'LINKEDIN';

-- CreateTable
CREATE TABLE "linkedin_posts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "socialAccountId" TEXT,
    "linkedinPostUrn" TEXT NOT NULL,
    "commentary" TEXT NOT NULL,
    "visibility" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "linkedin_posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "linkedin_posts_userId_createdAt_idx" ON "linkedin_posts"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "linkedin_posts" ADD CONSTRAINT "linkedin_posts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linkedin_posts" ADD CONSTRAINT "linkedin_posts_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "social_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
