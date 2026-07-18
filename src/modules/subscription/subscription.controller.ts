import { Response, NextFunction } from "express";
import { prisma } from "../../config/db.js";
import { AppError } from "../../utils/errors.js";
import { HTTP_STATUS, SUB_PLANS, SUB_STATUS } from "../../constants/index.js";
import { AuthenticatedRequest } from "../../middlewares/auth.js";
import { getOrCreateCustomer, createSubscriptionCheckoutSession } from "../../utils/stripe.js";
import { env } from "../../config/env.js";

export const purchaseSubscription = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { plan } = req.body;

    if (!plan || !Object.values(SUB_PLANS).includes(plan)) {
      throw new AppError(
        `Invalid subscription plan. Allowed values: ${Object.values(
          SUB_PLANS
        ).join(", ")}`,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const priceId = env.STRIPE_PREMIUM_PRICE_ID;
    if (!priceId) {
      throw new AppError(
        "STRIPE_PREMIUM_PRICE_ID is not configured in environment variables.",
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }

    // Get user details
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    if (!user) {
      throw new AppError("User not found", HTTP_STATUS.NOT_FOUND);
    }

    // Get or create Stripe Customer
    const customer = await getOrCreateCustomer(userId, user.email, user.name);

    // Create Checkout Session
    const successUrl = `${env.FRONTEND_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${env.FRONTEND_URL}/subscription/cancel`;

    const session = await createSubscriptionCheckoutSession(
      customer.id,
      priceId,
      userId,
      successUrl,
      cancelUrl
    );

    res.status(HTTP_STATUS.OK).json({
      status: "success",
      message: "Stripe Checkout Session created successfully.",
      data: {
        sessionId: session.id,
        url: session.url,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getSubscriptionStatus = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { userId: req.user!.id },
    });

    if (!subscription) {
      res.status(HTTP_STATUS.OK).json({
        status: "success",
        data: {
          hasActiveSubscription: false,
          subscription: null,
        },
      });
      return;
    }

    // Check if status is ACTIVE and current date is before expiry date
    const isActive =
      subscription.status === SUB_STATUS.ACTIVE &&
      new Date(subscription.endDate) > new Date();

    res.status(HTTP_STATUS.OK).json({
      status: "success",
      data: {
        hasActiveSubscription: isActive,
        subscription,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Mock Subscription Activation (Development Only) ─────────────────────────

export const mockSubscribe = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (env.NODE_ENV !== "development") {
      throw new AppError(
        "This endpoint is only available in development mode.",
        HTTP_STATUS.FORBIDDEN
      );
    }

    const { plan } = req.body;

    if (!plan || !Object.values(SUB_PLANS).includes(plan)) {
      throw new AppError(
        `Invalid subscription plan. Allowed values: ${Object.values(
          SUB_PLANS
        ).join(", ")}`,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30); // 30 days premium access

    const subscription = await prisma.subscription.upsert({
      where: { userId: req.user!.id },
      update: {
        plan,
        status: SUB_STATUS.ACTIVE,
        stripeSubscriptionId: "sub_mock_stripe_subscription",
        startDate,
        endDate,
      },
      create: {
        userId: req.user!.id,
        plan,
        status: SUB_STATUS.ACTIVE,
        stripeSubscriptionId: "sub_mock_stripe_subscription",
        startDate,
        endDate,
      },
    });

    res.status(HTTP_STATUS.OK).json({
      status: "success",
      message: `Plan ${plan} activated successfully (MOCKED).`,
      data: { subscription },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Record In-App Purchase Subscription (Apple / Google) ───────────────────

export const recordIAPSubscription = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { plan, platform, transactionId, purchaseToken, endDate } = req.body;

    if (!plan || !Object.values(SUB_PLANS).includes(plan)) {
      throw new AppError(
        `Invalid subscription plan. Allowed values: ${Object.values(SUB_PLANS).join(", ")}`,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    if (!platform || !["APPLE", "GOOGLE"].includes(platform)) {
      throw new AppError(
        "Invalid platform. Must be 'APPLE' or 'GOOGLE'.",
        HTTP_STATUS.BAD_REQUEST
      );
    }

    if (!transactionId) {
      throw new AppError(
        "transactionId is required to record the purchase.",
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const startDate = new Date();
    const calculatedEndDate = endDate ? new Date(endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const subscription = await prisma.subscription.upsert({
      where: { userId: req.user!.id },
      update: {
        plan,
        status: SUB_STATUS.ACTIVE,
        platform,
        transactionId,
        purchaseToken: purchaseToken || null,
        startDate,
        endDate: calculatedEndDate,
      },
      create: {
        userId: req.user!.id,
        plan,
        status: SUB_STATUS.ACTIVE,
        platform,
        transactionId,
        purchaseToken: purchaseToken || null,
        startDate,
        endDate: calculatedEndDate,
      },
    });

    res.status(HTTP_STATUS.OK).json({
      status: "success",
      message: `In-app purchase for ${plan} recorded successfully.`,
      data: { subscription },
    });
  } catch (error) {
    next(error);
  }
};

