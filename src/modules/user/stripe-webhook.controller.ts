import { Request, Response } from "express";
import { stripe, retrieveIdentityReport } from "../../utils/stripe.js";
import { env } from "../../config/env.js";
import { prisma } from "../../config/db.js";

/**
 * Handle Stripe Webhook Events to process Identity Verification asynchronously.
 */
export const handleStripeWebhook = async (req: Request, res: Response): Promise<void> => {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    res.status(400).send("Webhook signature or secret missing");
    return;
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      (req as any).rawBody,
      sig,
      webhookSecret
    );
  } catch (err: any) {
    console.error("⚠️  Webhook signature verification failed:", err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  try {
    // Handle the event
    switch (event.type) {
      case "identity.verification_session.verified": {
        const session = event.data.object as any;
        const userId = session.metadata?.userId;

        if (!userId) {
          console.error("Missing userId in session metadata:", session.id);
          break;
        }

        // Fetch the verification report
        const reportId = session.last_verification_report;
        if (!reportId) {
          console.error("Missing last_verification_report in session:", session.id);
          break;
        }

        const report = await retrieveIdentityReport(reportId);

        let is18Plus = false;
        const dob = report.document?.dob;
        if (dob && dob.year && dob.month && dob.day) {
          const birthDate = new Date(`${dob.year}-${dob.month}-${dob.day}`);
          const today = new Date();
          let age = today.getFullYear() - birthDate.getFullYear();
          const m = today.getMonth() - birthDate.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }
          is18Plus = age >= 18;
        }

        // Since the app only allows 18+ users, reject if they are under 18
        const verificationStatus = is18Plus ? "VERIFIED" : "REJECTED";

        await prisma.user.update({
          where: { id: userId },
          data: {
            verificationStatus,
            is18Plus,
            isHuman: true, // Passed selfie comparison & liveness checks
            govIdUrl: session.id, // Save Stripe session reference for debugging/auditing
          },
        });

        console.log(`User ${userId} verification updated to ${verificationStatus}. 18+: ${is18Plus}`);
        break;
      }

      case "identity.verification_session.requires_input":
      case "identity.verification_session.canceled": {
        const session = event.data.object as any;
        const userId = session.metadata?.userId;

        if (userId) {
          await prisma.user.update({
            where: { id: userId },
            data: {
              verificationStatus: "REJECTED",
            },
          });
          console.log(`User ${userId} verification status set to REJECTED due to session cancellation/input requirement.`);
        }
        break;
      }

      case "checkout.session.completed": {
        const session = event.data.object as any;
        if (session.mode === "subscription") {
          const userId = session.metadata?.userId;
          const subscriptionId = session.subscription as string;

          if (!userId || !subscriptionId) {
            break;
          }

          // Retrieve subscription details from Stripe
          const subscription = (await stripe.subscriptions.retrieve(subscriptionId)) as any;
          const priceId = subscription.items.data[0].price.id;

          // Map priceId to our SUB_PLANS
          let plan = "FREE";
          if (priceId === env.STRIPE_PREMIUM_PRICE_ID) {
            plan = "PREMIUM";
          }

          const startDate = new Date(subscription.current_period_start * 1000);
          const endDate = new Date(subscription.current_period_end * 1000);

          await prisma.subscription.upsert({
            where: { userId },
            update: {
              plan,
              status: "ACTIVE",
              stripeSubscriptionId: subscriptionId,
              startDate,
              endDate,
            },
            create: {
              userId,
              plan,
              status: "ACTIVE",
              stripeSubscriptionId: subscriptionId,
              startDate,
              endDate,
            },
          });

          console.log(`Subscription created/updated for user ${userId} to plan ${plan}`);
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as any;
        const userId = subscription.metadata?.userId;
        const subscriptionId = subscription.id;

        if (!userId) {
          break;
        }

        const status = subscription.status === "active" ? "ACTIVE" : "CANCELLED";
        const priceId = subscription.items.data[0].price.id;
        let plan = "FREE";
        if (priceId === env.STRIPE_PREMIUM_PRICE_ID) {
          plan = "PREMIUM";
        }

        const startDate = new Date(subscription.current_period_start * 1000);
        const endDate = new Date(subscription.current_period_end * 1000);

        await prisma.subscription.upsert({
          where: { userId },
          update: {
            plan,
            status,
            stripeSubscriptionId: subscriptionId,
            startDate,
            endDate,
          },
          create: {
            userId,
            plan,
            status,
            stripeSubscriptionId: subscriptionId,
            startDate,
            endDate,
          },
        });
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as any;
        const userId = subscription.metadata?.userId;

        if (userId) {
          await prisma.subscription.updateMany({
            where: { userId },
            data: {
              status: "EXPIRED",
            },
          });
          console.log(`Subscription cancelled/expired for user ${userId}`);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error("Error processing Stripe webhook:", error);
    res.status(500).send("Internal Server Error");
  }
};
