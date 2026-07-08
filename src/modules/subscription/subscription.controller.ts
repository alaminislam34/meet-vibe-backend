import { Response, NextFunction } from "express";
import { prisma } from "../../config/db.js";
import { AppError } from "../../utils/errors.js";
import { HTTP_STATUS, SUB_PLANS, SUB_STATUS } from "../../constants/index.js";
import { AuthenticatedRequest } from "../../middlewares/auth.js";

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

    const startDate = new Date();
    const endDate = new Date();
    // For standard demonstration, subscriptions expire in 30 days
    endDate.setDate(endDate.getDate() + 30);

    const subscription = await prisma.subscription.upsert({
      where: { userId: req.user!.id },
      update: {
        plan,
        status: SUB_STATUS.ACTIVE,
        startDate,
        endDate,
      },
      create: {
        userId: req.user!.id,
        plan,
        status: SUB_STATUS.ACTIVE,
        startDate,
        endDate,
      },
    });

    res.status(HTTP_STATUS.OK).json({
      status: "success",
      message: `Plan ${plan} activated successfully for 30 days.`,
      data: { subscription },
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
