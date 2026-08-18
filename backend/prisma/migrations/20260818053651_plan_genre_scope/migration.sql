-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "genreSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[];
