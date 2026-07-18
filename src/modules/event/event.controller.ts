import { Response, NextFunction } from "express";
import { prisma } from "../../config/db.js";
import { AppError } from "../../utils/errors.js";
import { HTTP_STATUS, EVENT_STATUS, SUB_STATUS } from "../../constants/index.js";
import { AuthenticatedRequest } from "../../middlewares/auth.js";

// ─── Guard: Active Subscription ──────────────────────────────────────────────

const requireActiveSubscription = async (userId: string): Promise<void> => {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (!sub || sub.status !== SUB_STATUS.ACTIVE || new Date(sub.endDate) < new Date()) {
    throw new AppError(
      "An active subscription is required to create events.",
      HTTP_STATUS.FORBIDDEN
    );
  }
};

// ─── Guard: Event owner check ─────────────────────────────────────────────────

const requireEventOwner = async (eventId: string, userId: string) => {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new AppError("Event not found", HTTP_STATUS.NOT_FOUND);
  if (event.creatorId !== userId) throw new AppError("Unauthorized", HTTP_STATUS.FORBIDDEN);
  if (event.status !== EVENT_STATUS.DRAFT) throw new AppError("Event already published or cancelled", HTTP_STATUS.BAD_REQUEST);
  return event;
};

// ─── Step 1 – Basic Info ──────────────────────────────────────────────────────

export const saveStep1 = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.id;
    await requireActiveSubscription(userId);

    const { eventId, title, category, eventType, capacity, isFree, price, isDepositModel, refundPenaltyRate } = req.body;
    const coverImage = (req.file as Express.Multer.File | undefined)?.path ?? undefined;

    let event;
    if (eventId) {
      await requireEventOwner(eventId, userId);
      event = await prisma.event.update({
        where: { id: eventId },
        data: {
          title,
          category,
          eventType,
          capacity: Number(capacity),
          isFree: Boolean(isFree),
          price: isFree ? 0 : Number(price ?? 0),
          isDepositModel: isFree ? false : isDepositModel === "true" || isDepositModel === true,
          refundPenaltyRate: refundPenaltyRate ? Number(refundPenaltyRate) : 0.10,
          creationStep: Math.max(1, 1),
          ...(coverImage && { coverImage }),
        },
      });
    } else {
      event = await prisma.event.create({
        data: {
          creatorId: userId,
          title,
          category,
          eventType,
          capacity: Number(capacity),
          isFree: Boolean(isFree),
          price: isFree ? 0 : Number(price ?? 0),
          isDepositModel: isFree ? false : isDepositModel === "true" || isDepositModel === true,
          refundPenaltyRate: refundPenaltyRate ? Number(refundPenaltyRate) : 0.10,
          creationStep: 1,
          status: EVENT_STATUS.DRAFT,
          ...(coverImage && { coverImage }),
        },
      });
    }

    res.status(HTTP_STATUS.OK).json({
      status: "success",
      message: "Step 1 saved.",
      data: { event },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Step 2 – Date & Time ─────────────────────────────────────────────────────

export const saveStep2 = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { eventId, startDate, startTime, endDate, endTime, timezone } = req.body;
    const event = await requireEventOwner(eventId, req.user!.id);

    const updated = await prisma.event.update({
      where: { id: eventId },
      data: {
        startDate: new Date(startDate),
        startTime,
        endDate: endDate ? new Date(endDate) : null,
        endTime: endTime ?? null,
        timezone,
        creationStep: Math.max(event.creationStep, 2),
      },
    });

    res.status(HTTP_STATUS.OK).json({
      status: "success",
      message: "Step 2 saved.",
      data: { event: updated },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Step 3 – Location ────────────────────────────────────────────────────────

export const saveStep3 = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { eventId, venueType, venueName, address, mapLat, mapLng, onlineLink } = req.body;
    const event = await requireEventOwner(eventId, req.user!.id);

    const updated = await prisma.event.update({
      where: { id: eventId },
      data: {
        venueType,
        venueName: venueName ?? null,
        address: address ?? null,
        mapLat: mapLat ? Number(mapLat) : null,
        mapLng: mapLng ? Number(mapLng) : null,
        onlineLink: onlineLink ?? null,
        creationStep: Math.max(event.creationStep, 3),
      },
    });

    res.status(HTTP_STATUS.OK).json({
      status: "success",
      message: "Step 3 saved.",
      data: { event: updated },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Step 4 – Details ─────────────────────────────────────────────────────────

export const saveStep4 = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { eventId, agenda, whatToBring, tags, visibility } = req.body;
    const event = await requireEventOwner(eventId, req.user!.id);

    const updated = await prisma.event.update({
      where: { id: eventId },
      data: {
        agenda: agenda ?? null,
        whatToBring: whatToBring ?? null,
        tags: tags ?? [],
        visibility: visibility ?? "PUBLIC",
        creationStep: Math.max(event.creationStep, 4),
      },
    });

    res.status(HTTP_STATUS.OK).json({
      status: "success",
      message: "Step 4 saved.",
      data: { event: updated },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Publish (Step 5 – Review & Submit) ───────────────────────────────────────

export const publishEvent = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const event = await requireEventOwner(id, req.user!.id);

    if (event.creationStep < 4) {
      throw new AppError(
        "Please complete all 4 steps before publishing.",
        HTTP_STATUS.BAD_REQUEST
      );
    }

    if (!event.title || !event.startDate || !event.venueType) {
      throw new AppError(
        "Event is missing required fields. Please review all steps.",
        HTTP_STATUS.UNPROCESSABLE_ENTITY
      );
    }

    const published = await prisma.event.update({
      where: { id },
      data: { status: EVENT_STATUS.PUBLISHED, creationStep: 5 },
    });

    // Auto-create group chat for the event
    const chatGroup = await prisma.chatGroup.upsert({
      where: { eventId: id },
      update: {},
      create: { eventId: id },
    });

    res.status(HTTP_STATUS.OK).json({
      status: "success",
      message: "Event published! Group chat created.",
      data: { event: published, chatGroupId: chatGroup.id },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Get Event ────────────────────────────────────────────────────────────────

export const getEvent = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true, image: true } },
        _count: { select: { participants: true } },
      },
    });

    if (!event) throw new AppError("Event not found", HTTP_STATUS.NOT_FOUND);

    // Draft visibility: only owner can see
    if (event.status === EVENT_STATUS.DRAFT && event.creatorId !== req.user!.id) {
      throw new AppError("Unauthorized", HTTP_STATUS.FORBIDDEN);
    }

    res.status(HTTP_STATUS.OK).json({ status: "success", data: { event } });
  } catch (error) {
    next(error);
  }
};

// ─── List Events ──────────────────────────────────────────────────────────────

export const listEvents = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { category, venueType, isFree } = req.query;

    const events = await prisma.event.findMany({
      where: {
        status: EVENT_STATUS.PUBLISHED,
        ...(category && { category: String(category) }),
        ...(venueType && { venueType: String(venueType) }),
        ...(isFree !== undefined && { isFree: isFree === "true" }),
      },
      include: {
        creator: { select: { id: true, name: true, image: true } },
        _count: { select: { participants: true } },
      },
      orderBy: { startDate: "asc" },
    });

    res.status(HTTP_STATUS.OK).json({
      status: "success",
      data: { events, total: events.length },
    });
  } catch (error) {
    next(error);
  }
};

// ─── My Events (drafts + published) ──────────────────────────────────────────

export const myEvents = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const events = await prisma.event.findMany({
      where: { creatorId: req.user!.id },
      orderBy: { createdAt: "desc" },
    });

    res.status(HTTP_STATUS.OK).json({ status: "success", data: { events } });
  } catch (error) {
    next(error);
  }
};

// ─── Delete / Cancel Event ───────────────────────────────────────────────────

export const deleteEvent = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) throw new AppError("Event not found", HTTP_STATUS.NOT_FOUND);
    if (event.creatorId !== req.user!.id) throw new AppError("Unauthorized", HTTP_STATUS.FORBIDDEN);

    await prisma.event.delete({ where: { id } });

    res.status(HTTP_STATUS.OK).json({
      status: "success",
      message: "Event deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
};
