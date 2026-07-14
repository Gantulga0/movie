-- CreateEnum
CREATE TYPE "ReleaseStatus" AS ENUM ('RELEASING', 'COMPLETED');

-- AlterTable
ALTER TABLE "Content" ADD COLUMN     "director" TEXT,
ADD COLUMN     "isRentable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "originalTitle" TEXT,
ADD COLUMN     "releaseStatus" "ReleaseStatus" NOT NULL DEFAULT 'COMPLETED',
ADD COLUMN     "rentalDurationHours" INTEGER NOT NULL DEFAULT 48,
ADD COLUMN     "rentalPrice" INTEGER,
ADD COLUMN     "subscriptionIncluded" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "contentId" TEXT;

-- CreateTable
CREATE TABLE "Rental" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "paymentId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rental_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Rental_paymentId_key" ON "Rental"("paymentId");

-- CreateIndex
CREATE INDEX "Rental_userId_endsAt_idx" ON "Rental"("userId", "endsAt");

-- CreateIndex
CREATE INDEX "Rental_contentId_idx" ON "Rental"("contentId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rental" ADD CONSTRAINT "Rental_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rental" ADD CONSTRAINT "Rental_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rental" ADD CONSTRAINT "Rental_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
