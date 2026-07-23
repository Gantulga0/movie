/*
  Warnings:

  - You are about to drop the `Otp` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "PhoneVerifyPurpose" AS ENUM ('VERIFY', 'RESET');

-- AlterTable
ALTER TABLE "PhoneVerification" ADD COLUMN     "consumedAt" TIMESTAMP(3),
ADD COLUMN     "purpose" "PhoneVerifyPurpose" NOT NULL DEFAULT 'VERIFY';

-- DropTable
DROP TABLE "Otp";

-- DropEnum
DROP TYPE "OtpChannel";

-- DropEnum
DROP TYPE "OtpPurpose";
