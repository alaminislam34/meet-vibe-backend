import Stripe from "stripe";
import { env } from "../config/env.js";

export const stripe = new Stripe(env.STRIPE_SECRET_KEY || "sk_test_placeholder", {
  apiVersion: "2023-10-16" as any, // Use standard stable API version
});

/**
 * Creates a Stripe Identity VerificationSession linking the specific userId in metadata.
 */
export const createIdentitySession = async (userId: string) => {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe secret key is not configured.");
  }
  return stripe.identity.verificationSessions.create({
    type: "document",
    metadata: { userId },
    options: {
      document: {
        allowed_types: ["driving_license", "id_card", "passport"],
        require_matching_selfie: true,
        require_live_capture: true,
      },
    },
  });
};

/**
 * Retrieves the verification report associated with a verification session.
 */
export const retrieveIdentityReport = async (reportId: string) => {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe secret key is not configured.");
  }
  return stripe.identity.verificationReports.retrieve(reportId);
};

/**
 * Creates or retrieves a Stripe Customer for a given user.
 */
export const getOrCreateCustomer = async (userId: string, email: string, name: string) => {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe secret key is not configured.");
  }
  
  // Find customer in our database first
  const { prisma } = await import("../config/db.js");
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });

  if (user?.stripeCustomerId) {
    // Verify customer still exists in Stripe
    try {
      const customer = await stripe.customers.retrieve(user.stripeCustomerId);
      if (!customer.deleted) {
        return customer as Stripe.Customer;
      }
    } catch (err) {
      // If customer was deleted in Stripe, we will create a new one below
    }
  }

  // Create new customer in Stripe
  const customer = await stripe.customers.create({
    email,
    name,
    metadata: { userId },
  });

  // Save stripeCustomerId to database
  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  });

  return customer;
};

/**
 * Creates a Stripe Checkout Session for a recurring subscription plan.
 */
export const createSubscriptionCheckoutSession = async (
  customerId: string,
  priceId: string,
  userId: string,
  successUrl: string,
  cancelUrl: string
) => {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe secret key is not configured.");
  }

  return stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"], // Card includes Apple/Google Pay automatically on Stripe's side
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    metadata: { userId },
    subscription_data: {
      metadata: { userId },
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
};
