import { Response, NextFunction } from "express";
import { prisma } from "../../config/db.js";
import { AppError } from "../../utils/errors.js";
import { HTTP_STATUS, VERIFICATION_STATUS } from "../../constants/index.js";
import { AuthenticatedRequest } from "../../middlewares/auth.js";
import { clearAuthCookies } from "../../utils/cookie.js";
import { createIdentitySession, createConnectAccount, createAccountLink, retrieveAccount } from "../../utils/stripe.js";
import { env } from "../../config/env.js";

// ─── Get My Profile ──────────────────────────────────────────────────────────

export const getProfile = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        subscription: true,
        accounts: {
          select: { providerId: true },
        },
      },
    });

    if (!user) {
      throw new AppError("User not found", HTTP_STATUS.NOT_FOUND);
    }

    res.status(HTTP_STATUS.OK).json({
      status: "success",
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          provider: user.accounts[0]?.providerId || "LOCAL",
          isEmailVerified: user.isEmailVerified,
          verificationStatus: user.verificationStatus,
          is18Plus: user.is18Plus,
          isHuman: user.isHuman,
          subscription: user.subscription,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Update Profile ───────────────────────────────────────────────────────────

export const updateProfile = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, image } = req.body;

    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        ...(name && { name }),
        ...(image && { image }),
      },
    });

    res.status(HTTP_STATUS.OK).json({
      status: "success",
      message: "Profile updated successfully.",
      data: {
        user: {
          id: updated.id,
          email: updated.email,
          name: updated.name,
          image: updated.image,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Submit Identity Verification ────────────────────────────────────────────
// Accepts govId + selfie uploads. In production, call AWS Rekognition / Stripe Identity.

export const verifyIdentity = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.id;

    // Check if user is already verified
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError("User not found", HTTP_STATUS.NOT_FOUND);
    }

    if (user.verificationStatus === VERIFICATION_STATUS.VERIFIED) {
      throw new AppError("Identity is already verified.", HTTP_STATUS.BAD_REQUEST);
    }

    // Create VerificationSession using Stripe
    const session = await createIdentitySession(userId);

    // Update user status to PENDING and store session ID
    await prisma.user.update({
      where: { id: userId },
      data: {
        verificationStatus: VERIFICATION_STATUS.PENDING,
        govIdUrl: session.id,
      },
    });

    res.status(HTTP_STATUS.OK).json({
      status: "success",
      message: "Stripe Identity Verification Session created successfully.",
      data: {
        url: session.url,
        clientSecret: session.client_secret,
        status: session.status,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

// ─── Delete Account ───────────────────────────────────────────────────────────

export const deleteAccount = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { reason } = req.body;

    // Soft delete: mark as deleted rather than hard delete
    await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        deletedAt: new Date(),
        deleteReason: reason ?? null,
        // Anonymize PII
        email: `deleted_${req.user!.id}@removed.local`,
        name: "Deleted User",
        image: null,
      },
    });

    // Remove active sessions
    await prisma.session.deleteMany({
      where: { userId: req.user!.id },
    });

    // Remove accounts credentials/info
    await prisma.account.deleteMany({
      where: { userId: req.user!.id },
    });

    clearAuthCookies(res);

    res.status(HTTP_STATUS.OK).json({
      status: "success",
      message: "Your account has been deleted.",
    });
  } catch (error) {
    next(error);
  }
};

// ─── Mock Identity Verification (Development Only) ───────────────────────────

export const mockVerifyIdentity = async (
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

    const userId = req.user!.id;

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        verificationStatus: VERIFICATION_STATUS.VERIFIED,
        is18Plus: true,
        isHuman: true,
        govIdUrl: "vs_mock_verification_session",
      },
    });

    res.status(HTTP_STATUS.OK).json({
      status: "success",
      message: "Identity verified successfully (MOCKED).",
      data: {
        verificationStatus: updated.verificationStatus,
        is18Plus: updated.is18Plus,
        isHuman: updated.isHuman,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Stripe Connect Onboarding (Event Hosts) ─────────────────────────────────

export const getStripeConnectOnboarding = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, email: true, name: true, stripeConnectedAccountId: true },
    });

    if (!user) {
      throw new AppError("User not found", HTTP_STATUS.NOT_FOUND);
    }

    let accountId = user.stripeConnectedAccountId;

    if (!accountId) {
      const account = await createConnectAccount(user.id, user.email);
      accountId = account.id;

      await prisma.user.update({
        where: { id: user.id },
        data: { stripeConnectedAccountId: accountId },
      });
    }

    const frontendUrl = env.FRONTEND_URL || "http://localhost:3000";
    const successUrl = `${frontendUrl}/stripe-connect/success`;
    const refreshUrl = `${frontendUrl}/stripe-connect/refresh`;

    const accountLink = await createAccountLink(accountId, successUrl, refreshUrl);

    res.status(HTTP_STATUS.OK).json({
      status: "success",
      data: {
        stripeConnectedAccountId: accountId,
        url: accountLink.url,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Stripe Connect Status Check ─────────────────────────────────────────────

export const getStripeConnectStatus = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { stripeConnectedAccountId: true },
    });

    if (!user || !user.stripeConnectedAccountId) {
      res.status(HTTP_STATUS.OK).json({
        status: "success",
        data: {
          connected: false,
          details: null,
        },
      });
      return;
    }

    const account = await retrieveAccount(user.stripeConnectedAccountId);
    const connected = account.charges_enabled && account.payouts_enabled;

    res.status(HTTP_STATUS.OK).json({
      status: "success",
      data: {
        connected: Boolean(connected),
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        details: {
          email: account.email,
          country: account.country,
          defaultCurrency: account.default_currency,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

