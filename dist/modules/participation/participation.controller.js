import { prisma } from "../../config/db.js";
import { AppError } from "../../utils/errors.js";
import { HTTP_STATUS, PARTICIPANT_STATUS, EVENT_STATUS } from "../../constants/index.js";
export const joinEvent = async (req, res, next) => {
    try {
        const userId = req.user.id;
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
        const existingParticipation = event.participants.find((p) => p.userId === userId);
        if (existingParticipation) {
            throw new AppError(`You have already joined this event. Status: ${existingParticipation.status}`, HTTP_STATUS.CONFLICT);
        }
        // 4. Check capacity limit
        const approvedCount = event.participants.filter((p) => p.status === PARTICIPANT_STATUS.APPROVED).length;
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
    }
    catch (error) {
        next(error);
    }
};
export const submitPayment = async (req, res, next) => {
    try {
        const userId = req.user.id;
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
            throw new AppError(`Payment cannot be submitted for status: ${participant.status}`, HTTP_STATUS.BAD_REQUEST);
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
    }
    catch (error) {
        next(error);
    }
};
export const reviewParticipation = async (req, res, next) => {
    try {
        const userId = req.user.id;
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
            throw new AppError("Only the event host can review participation requests", HTTP_STATUS.FORBIDDEN);
        }
        if (participant.status !== PARTICIPANT_STATUS.PENDING_APPROVAL &&
            participant.status !== PARTICIPANT_STATUS.PENDING_PAYMENT) {
            throw new AppError(`Cannot review request with current status: ${participant.status}`, HTTP_STATUS.BAD_REQUEST);
        }
        // Update status based on host review action
        const updatedStatus = action === "APPROVED"
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
    }
    catch (error) {
        next(error);
    }
};
//# sourceMappingURL=participation.controller.js.map