-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "stripeSubscriptionId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "stripeCustomerId" TEXT;
