/*
  Warnings:

  - You are about to drop the column `isVerified` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "isVerified",
ADD COLUMN     "isEmailVerified" BOOLEAN NOT NULL DEFAULT false;
