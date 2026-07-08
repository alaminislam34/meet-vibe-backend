import { prisma } from "../../config/db.js";
import { AppError } from "../../utils/errors.js";
import { HTTP_STATUS, CONNECTION_STATUS, PARTICIPANT_STATUS, EVENT_STATUS } from "../../constants/index.js";
// ─── Send Connection Request ──────────────────────────────────────────────────
export const sendConnectionRequest = async (req, res, next) => {
    try {
        const senderId = req.user.id;
        const { receiverId, requestMessage } = req.body;
        if (senderId === receiverId) {
            throw new AppError("You cannot connect with yourself.", HTTP_STATUS.BAD_REQUEST);
        }
        const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
        if (!receiver || receiver.deletedAt) {
            throw new AppError("User not found.", HTTP_STATUS.NOT_FOUND);
        }
        // Check existing connection
        const existing = await prisma.connection.findFirst({
            where: {
                OR: [
                    { requesterId: senderId, receiverId },
                    { requesterId: receiverId, receiverId: senderId },
                ],
            },
        });
        if (existing) {
            throw new AppError(`A connection already exists. Status: ${existing.status}`, HTTP_STATUS.CONFLICT);
        }
        // ── Shared Event Rule ────────────────────────────────────────────────────
        // Both must have shared a published event (as participants or host)
        const sharedEvent = await prisma.event.findFirst({
            where: {
                status: EVENT_STATUS.PUBLISHED,
                OR: [
                    // Both are approved participants
                    {
                        participants: { some: { userId: senderId, status: PARTICIPANT_STATUS.APPROVED } },
                        AND: { participants: { some: { userId: receiverId, status: PARTICIPANT_STATUS.APPROVED } } },
                    },
                    // Sender is creator, receiver is approved participant
                    {
                        creatorId: senderId,
                        participants: { some: { userId: receiverId, status: PARTICIPANT_STATUS.APPROVED } },
                    },
                    // Receiver is creator, sender is approved participant
                    {
                        creatorId: receiverId,
                        participants: { some: { userId: senderId, status: PARTICIPANT_STATUS.APPROVED } },
                    },
                ],
            },
        });
        if (!sharedEvent) {
            throw new AppError("You can only connect with users you have shared an event with.", HTTP_STATUS.FORBIDDEN);
        }
        const connection = await prisma.connection.create({
            data: {
                requesterId: senderId,
                receiverId,
                status: CONNECTION_STATUS.PENDING,
                requestMessage: requestMessage ?? null,
            },
        });
        res.status(HTTP_STATUS.CREATED).json({
            status: "success",
            message: "Connection request sent.",
            data: { connection },
        });
    }
    catch (error) {
        next(error);
    }
};
// ─── Respond to Connection Request ───────────────────────────────────────────
export const respondToConnection = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { connectionId, action } = req.body; // action: "ACCEPTED" | "DECLINED"
        const connection = await prisma.connection.findUnique({ where: { id: connectionId } });
        if (!connection)
            throw new AppError("Connection request not found.", HTTP_STATUS.NOT_FOUND);
        if (connection.receiverId !== userId)
            throw new AppError("Unauthorized.", HTTP_STATUS.FORBIDDEN);
        if (connection.status !== CONNECTION_STATUS.PENDING) {
            throw new AppError("Request already responded to.", HTTP_STATUS.BAD_REQUEST);
        }
        if (action === "ACCEPTED") {
            const updated = await prisma.connection.update({
                where: { id: connectionId },
                data: { status: CONNECTION_STATUS.ACCEPTED },
            });
            res.status(HTTP_STATUS.OK).json({
                status: "success",
                message: "Connection accepted.",
                data: { connection: updated },
            });
        }
        else {
            await prisma.connection.delete({ where: { id: connectionId } });
            res.status(HTTP_STATUS.OK).json({
                status: "success",
                message: "Connection request declined.",
            });
        }
    }
    catch (error) {
        next(error);
    }
};
// ─── Get My Connections (Friends List) ───────────────────────────────────────
export const getConnections = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const connections = await prisma.connection.findMany({
            where: {
                status: CONNECTION_STATUS.ACCEPTED,
                OR: [{ requesterId: userId }, { receiverId: userId }],
            },
            include: {
                requester: { select: { id: true, name: true, image: true } },
                receiver: { select: { id: true, name: true, image: true } },
            },
            orderBy: { updatedAt: "desc" },
        });
        const formatted = connections.map((conn) => ({
            connectionId: conn.id,
            connectedAt: conn.updatedAt,
            friend: conn.requesterId === userId ? conn.receiver : conn.requester,
        }));
        res.status(HTTP_STATUS.OK).json({
            status: "success",
            data: { connections: formatted },
        });
    }
    catch (error) {
        next(error);
    }
};
// ─── Pending Requests (received) ──────────────────────────────────────────────
export const getPendingRequests = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const requests = await prisma.connection.findMany({
            where: { receiverId: userId, status: CONNECTION_STATUS.PENDING },
            include: {
                requester: { select: { id: true, name: true, image: true } },
            },
            orderBy: { createdAt: "desc" },
        });
        res.status(HTTP_STATUS.OK).json({
            status: "success",
            data: { requests },
        });
    }
    catch (error) {
        next(error);
    }
};
// ─── Remove Connection (Unfriend) ─────────────────────────────────────────────
export const removeConnection = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const connection = await prisma.connection.findUnique({ where: { id } });
        if (!connection)
            throw new AppError("Connection not found.", HTTP_STATUS.NOT_FOUND);
        if (connection.requesterId !== userId && connection.receiverId !== userId) {
            throw new AppError("Unauthorized.", HTTP_STATUS.FORBIDDEN);
        }
        await prisma.connection.delete({ where: { id } });
        res.status(HTTP_STATUS.OK).json({
            status: "success",
            message: "Connection removed.",
        });
    }
    catch (error) {
        next(error);
    }
};
//# sourceMappingURL=connection.controller.js.map