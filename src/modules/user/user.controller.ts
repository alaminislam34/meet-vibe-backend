import { Response, NextFunction } from "express";
import { prisma } from "../../config/db.js";
import { AppError } from "../../utils/errors.js";
import { HTTP_STATUS, VERIFICATION_STATUS } from "../../constants/index.js";
import { AuthenticatedRequest } from "../../middlewares/auth.js";
import { clearAuthCookies } from "../../utils/cookie.js";
import { createIdentitySession } from "../../utils/stripe.js";
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
