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

/**
 * Creates a Stripe Express Connect Account for event hosts.
 */
export const createConnectAccount = async (userId: string, email: string) => {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe secret key is not configured.");
  }
  return stripe.accounts.create({
    type: "express",
    email,
    metadata: { userId },
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  });
};

/**
 * Creates an onboarding account link for a Stripe Connect account.
 */
export const createAccountLink = async (
  accountId: string,
  returnUrl: string,
  refreshUrl: string
) => {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe secret key is not configured.");
  }
  return stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: "account_onboarding",
  });
};

/**
 * Retrieves the status details of a Stripe Connect Account.
 */
export const retrieveAccount = async (accountId: string) => {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe secret key is not configured.");
  }
  return stripe.accounts.retrieve(accountId);
};

/**
 * Creates a Stripe Checkout Session for registering/paying for an event.
 */
export const createCheckoutSessionForEvent = async (
  customerId: string,
  priceAmount: number, // in USD / currency unit
  eventId: string,
  userId: string,
  successUrl: string,
  cancelUrl: string
) => {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe secret key is not configured.");
  }

  // Convert amount to cents (integer)
  const amountInCents = Math.round(priceAmount * 100);

  return stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Event Ticket/Deposit Registration`,
            metadata: { eventId },
          },
          unit_amount: amountInCents,
        },
        quantity: 1,
      },
    ],
    metadata: { userId, eventId },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
};

/**
 * Transfers funds from the platform account to the host's Stripe Connected account.
 */
export const createTransferToConnectedAccount = async (
  amountInCents: number,
  destinationAccountId: string,
  transferGroup: string
) => {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe secret key is not configured.");
  }

  return stripe.transfers.create({
    amount: amountInCents,
    currency: "usd",
    destination: destinationAccountId,
    transfer_group: transferGroup,
  });
};

/**
 * Refunds a specific PaymentIntent (fully or partially).
 */
export const refundPaymentIntent = async (paymentIntentId: string, amountInCents?: number) => {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe secret key is not configured.");
  }

  return stripe.refunds.create({
    payment_intent: paymentIntentId,
    ...(amountInCents && { amount: amountInCents }),
  });
};

