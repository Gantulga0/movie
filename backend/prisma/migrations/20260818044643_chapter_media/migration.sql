-- AlterTable
ALTER TABLE "Chapter" ADD COLUMN     "mediaMimeType" TEXT,
ADD COLUMN     "mediaR2Key" TEXT,
ADD COLUMN     "mediaUrl" TEXT,
ALTER COLUMN "body" SET DEFAULT '';
