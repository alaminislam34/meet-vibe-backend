import { Response, NextFunction } from "express";
import { prisma } from "../../config/db.js";
import { AppError } from "../../utils/errors.js";
import { HTTP_STATUS, PARTICIPANT_STATUS, EVENT_STATUS } from "../../constants/index.js";
import { AuthenticatedRequest } from "../../middlewares/auth.js";
import { getOrCreateCustomer, createCheckoutSessionForEvent, createTransferToConnectedAccount, refundPaymentIntent } from "../../utils/stripe.js";
import { env } from "../../config/env.js";

export const joinEvent = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { eventId } = req.body;

    // 1. Fetch event details
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { participants: true },
    });

    if (!event || event.status !== EVENT_STATUS.PUBLISHED) {
      throw new AppError("Active published event not found", HTTP_STATUS.NOT_FOUND);
    }

    // 2. Check if user is the creator
    if (event.creatorId === userId) {
      throw new AppError("Event creators are automatically participants of their own events", HTTP_STATUS.BAD_REQUEST);
    }

    // 3. Check if already joined
    const existingParticipation = event.participants.find(
      (p) => p.userId === userId
    );

    if (existingParticipation) {
      throw new AppError(
        `You have already joined this event. Status: ${existingParticipation.status}`,
        HTTP_STATUS.CONFLICT
      );
    }

    // 4. Check capacity limit
    const approvedCount = event.participants.filter(
      (p) => p.status === PARTICIPANT_STATUS.APPROVED
    ).length;

    if (approvedCount >= event.capacity) {
      throw new AppError("This event is fully booked", HTTP_STATUS.BAD_REQUEST);
    }

    // 5. Check event pricing rules
    const isPremium = Number(event.price) > 0;
    const initialStatus = isPremium
      ? PARTICIPANT_STATUS.PENDING_PAYMENT
      : PARTICIPANT_STATUS.APPROVED;

    const participant = await prisma.participant.create({
      data: {
        eventId,
        userId,
        status: initialStatus,
      },
    });

    res.status(HTTP_STATUS.CREATED).json({
      status: "success",
      message: isPremium
        ? "Joined event. Payment required since this is a premium event."
        : "Successfully registered for this event.",
      data: { participant },
    });
  } catch (error) {
    next(error);
  }
};

export const submitPayment = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { eventId, transactionId } = req.body;

    // Find participation record
    const participant = await prisma.participant.findUnique({
      where: {
        eventId_userId: {
          eventId,
          userId,
        },
      },
    });

    if (!participant) {
      throw new AppError("Participation record not found", HTTP_STATUS.NOT_FOUND);
    }

    if (participant.status !== PARTICIPANT_STATUS.PENDING_PAYMENT) {
      throw new AppError(
        `Payment cannot be submitted for status: ${participant.status}`,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    // Update status to PENDING_APPROVAL and set transactionId
    const updatedParticipant = await prisma.participant.update({
      where: { id: participant.id },
      data: {
        transactionId,
        status: PARTICIPANT_STATUS.PENDING_APPROVAL,
      },
    });

    res.status(HTTP_STATUS.OK).json({
      status: "success",
      message: "Transaction ID submitted. Awaiting host review.",
      data: { participant: updatedParticipant },
    });
  } catch (error) {
    next(error);
  }
};

export const reviewParticipation = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { participantId, action } = req.body;

    // Find participation details along with event owner
    const participant = await prisma.participant.findUnique({
      where: { id: participantId },
      include: { event: true },
    });

    if (!participant) {
      throw new AppError("Participation request not found", HTTP_STATUS.NOT_FOUND);
    }

    // Verify requesting user is the host
    if (participant.event.creatorId !== userId) {
      throw new AppError(
        "Only the event host can review participation requests",
        HTTP_STATUS.FORBIDDEN
      );
    }

    if (
      participant.status !== PARTICIPANT_STATUS.PENDING_APPROVAL &&
      participant.status !== PARTICIPANT_STATUS.PENDING_PAYMENT
    ) {
      throw new AppError(
        `Cannot review request with current status: ${participant.status}`,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    // Update status based on host review action
    const updatedStatus =
      action === "APPROVED"
        ? PARTICIPANT_STATUS.APPROVED
        : PARTICIPANT_STATUS.REJECTED;

    const updatedParticipant = await prisma.participant.update({
      where: { id: participantId },
      data: {
        status: updatedStatus,
      },
    });

    res.status(HTTP_STATUS.OK).json({
      status: "success",
      message: `Participation request has been ${action.toLowerCase()}.`,
      data: { participant: updatedParticipant },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Create Event Checkout Session (Participant Payment / Deposit) ────────────

export const createEventCheckoutSession = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { eventId } = req.body;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event || event.status !== EVENT_STATUS.PUBLISHED) {
      throw new AppError("Active published event not found", HTTP_STATUS.NOT_FOUND);
    }

    if (event.isFree || Number(event.price) <= 0) {
      throw new AppError("This event is free, no payment required", HTTP_STATUS.BAD_REQUEST);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError("User not found", HTTP_STATUS.NOT_FOUND);
    }

    const customer = await getOrCreateCustomer(user.id, user.email, user.name);

    const frontendUrl = env.FRONTEND_URL || "http://localhost:3000";
    const successUrl = `${frontendUrl}/events/${eventId}/payment-success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${frontendUrl}/events/${eventId}/payment-cancelled`;

    const session = await createCheckoutSessionForEvent(
      customer.id,
      Number(event.price),
      event.id,
      user.id,
      successUrl,
      cancelUrl
    );

    await prisma.participant.upsert({
      where: {
        eventId_userId: { eventId, userId },
      },
      update: {
        status: "PENDING_PAYMENT",
      },
      create: {
        eventId,
        userId,
        status: "PENDING_PAYMENT",
      },
    });

    res.status(HTTP_STATUS.OK).json({
      status: "success",
      data: {
        checkoutUrl: session.url,
        sessionId: session.id,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Finalize Event Attendance & Process Escrow/Payouts (Host Only) ──────────

export const finalizeEventAttendance = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const hostId = req.user!.id;
    const { eventId } = req.params;
    const { attendance } = req.body; // Array of { userId: string, attended: boolean }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { creator: true },
    });

    if (!event) {
      throw new AppError("Event not found", HTTP_STATUS.NOT_FOUND);
    }

    if (event.creatorId !== hostId) {
      throw new AppError("Only the event host can finalize attendance", HTTP_STATUS.FORBIDDEN);
    }

    const host = event.creator;

    if (!event.isFree && Number(event.price) > 0 && !host.stripeConnectedAccountId) {
      throw new AppError(
        "Host must connect their Stripe Account first to release paid event escrow.",
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const results = [];

    for (const record of attendance) {
      const { userId, attended } = record;

      const participant = await prisma.participant.findUnique({
        where: {
          eventId_userId: {
            eventId,
            userId,
          },
        },
      });

      if (!participant) continue;

      let paymentStatus = participant.paymentStatus;

      if (!event.isFree && Number(event.price) > 0 && participant.stripePaymentIntentId && participant.paymentStatus === "HELD_IN_ESCROW") {
        try {
          if (attended) {
            if (event.isDepositModel) {
              await refundPaymentIntent(participant.stripePaymentIntentId);
              paymentStatus = "REFUNDED";
            } else {
              const amountInCents = Math.round(Number(event.price) * 100);
              await createTransferToConnectedAccount(
                amountInCents,
                host.stripeConnectedAccountId!,
                `event_${event.id}`
              );
              paymentStatus = "TRANSFERRED_TO_HOST";
            }
          } else {
            if (event.isDepositModel) {
              const penaltyRate = Number(event.refundPenaltyRate) || 0.10;
              const refundRate = 1 - penaltyRate;

              const refundAmount = Math.round(Number(event.price) * refundRate * 100);
              const penaltyAmount = Math.round(Number(event.price) * penaltyRate * 100);

              if (refundAmount > 0) {
                await refundPaymentIntent(participant.stripePaymentIntentId, refundAmount);
              }
              if (penaltyAmount > 0) {
                await createTransferToConnectedAccount(
                  penaltyAmount,
                  host.stripeConnectedAccountId!,
                  `event_${event.id}`
                );
              }
              paymentStatus = "REFUNDED";
            } else {
              const amountInCents = Math.round(Number(event.price) * 100);
              await createTransferToConnectedAccount(
                amountInCents,
                host.stripeConnectedAccountId!,
                `event_${event.id}`
              );
              paymentStatus = "TRANSFERRED_TO_HOST";
            }
          }
        } catch (err: any) {
          console.error(`Stripe transaction failed for participant ${userId}:`, err);
        }
      }

      const updated = await prisma.participant.update({
        where: { id: participant.id },
        data: {
          attended,
          paymentStatus,
          status: "APPROVED",
        },
      });

      results.push(updated);
    }

    res.status(HTTP_STATUS.OK).json({
      status: "success",
      message: "Event attendance finalized and payments processed successfully.",
      data: { results },
    });
  } catch (error) {
    next(error);
  }
};

