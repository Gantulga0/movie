-- AlterEnum
ALTER TYPE "ContentType" ADD VALUE 'NOVEL';

-- AlterTable
ALTER TABLE "Content" ADD COLUMN "freeChapterCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "WatchHistory" ADD COLUMN "chapterId" TEXT;

-- CreateTable
CREATE TABLE "Chapter" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chapter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Chapter_contentId_number_key" ON "Chapter"("contentId", "number");

-- DropIndex
DROP INDEX "WatchHistory_userId_contentId_episodeId_key";

-- CreateIndex
CREATE UNIQUE INDEX "WatchHistory_userId_contentId_episodeId_chapterId_key" ON "WatchHistory"("userId", "contentId", "episodeId", "chapterId");

-- AddForeignKey
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchHistory" ADD CONSTRAINT "WatchHistory_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
