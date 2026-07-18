-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "isDepositModel" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "refundPenaltyRate" DECIMAL(65,30) NOT NULL DEFAULT 0.10;

-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "attended" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
ADD COLUMN     "stripePaymentIntentId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "stripeConnectedAccountId" TEXT;
