import { prisma } from "../../config/db.js";
import { AppError } from "../../utils/errors.js";
import { HTTP_STATUS, CONNECTION_STATUS, PARTICIPANT_STATUS } from "../../constants/index.js";
const senderSelect = { id: true, name: true, image: true };
// ─── Group Chat – Get Messages ────────────────────────────────────────────────
export const getGroupMessages = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { eventId } = req.params;
        const event = await prisma.event.findUnique({
            where: { id: eventId },
            include: {
                participants: { where: { userId, status: PARTICIPANT_STATUS.APPROVED } },
                chatGroup: true,
            },
        });
        if (!event)
            throw new AppError("Event not found.", HTTP_STATUS.NOT_FOUND);
        if (!event.chatGroup)
            throw new AppError("Group chat not found.", HTTP_STATUS.NOT_FOUND);
        const hasAccess = event.creatorId === userId || event.participants.length > 0;
        if (!hasAccess)
            throw new AppError("Access denied to this group chat.", HTTP_STATUS.FORBIDDEN);
        const messages = await prisma.chatMessage.findMany({
            where: { chatGroupId: event.chatGroup.id },
            include: { sender: { select: senderSelect } },
            orderBy: { createdAt: "asc" },
        });
        // Get participants list for the event group sidebar
        const participants = await prisma.participant.findMany({
            where: { eventId, status: PARTICIPANT_STATUS.APPROVED },
            include: { user: { select: senderSelect } },
        });
        res.status(HTTP_STATUS.OK).json({
            status: "success",
            data: {
                messages,
                participants: participants.map((p) => p.user),
                chatGroupId: event.chatGroup.id,
            },
        });
    }
    catch (error) {
        next(error);
    }
};
// ─── Group Chat – Send Message (REST fallback) ────────────────────────────────
export const sendGroupMessage = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { eventId } = req.params;
        const { message } = req.body;
        if (!message?.trim())
            throw new AppError("Message cannot be empty.", HTTP_STATUS.BAD_REQUEST);
        const event = await prisma.event.findUnique({
            where: { id: eventId },
            include: {
                participants: { where: { userId, status: PARTICIPANT_STATUS.APPROVED } },
                chatGroup: true,
            },
        });
        if (!event || !event.chatGroup)
            throw new AppError("Event or chat not found.", HTTP_STATUS.NOT_FOUND);
        const hasAccess = event.creatorId === userId || event.participants.length > 0;
        if (!hasAccess)
            throw new AppError("Access denied.", HTTP_STATUS.FORBIDDEN);
        const chatMessage = await prisma.chatMessage.create({
            data: { chatGroupId: event.chatGroup.id, senderId: userId, message },
            include: { sender: { select: senderSelect } },
        });
        res.status(HTTP_STATUS.CREATED).json({ status: "success", data: { message: chatMessage } });
    }
    catch (error) {
        next(error);
    }
};
// ─── Private Chat – Get Conversation ─────────────────────────────────────────
export const getPrivateMessages = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { targetUserId } = req.params;
        // Must be friends (accepted connection)
        const connection = await prisma.connection.findFirst({
            where: {
                status: CONNECTION_STATUS.ACCEPTED,
                OR: [
                    { requesterId: userId, receiverId: targetUserId },
                    { requesterId: targetUserId, receiverId: userId },
                ],
            },
        });
        if (!connection) {
            throw new AppError("You can only message connected users.", HTTP_STATUS.FORBIDDEN);
        }
        const messages = await prisma.chatMessage.findMany({
            where: {
                chatGroupId: null,
                OR: [
                    { senderId: userId, receiverId: targetUserId },
                    { senderId: targetUserId, receiverId: userId },
                ],
            },
            include: { sender: { select: senderSelect } },
            orderBy: { createdAt: "asc" },
        });
        res.status(HTTP_STATUS.OK).json({ status: "success", data: { messages } });
    }
    catch (error) {
        next(error);
    }
};
// ─── Private Chat – Send Message (REST fallback) ──────────────────────────────
export const sendPrivateMessage = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { targetUserId } = req.params;
        const { message } = req.body;
        if (!message?.trim())
            throw new AppError("Message cannot be empty.", HTTP_STATUS.BAD_REQUEST);
        const connection = await prisma.connection.findFirst({
            where: {
                status: CONNECTION_STATUS.ACCEPTED,
                OR: [
                    { requesterId: userId, receiverId: targetUserId },
                    { requesterId: targetUserId, receiverId: userId },
                ],
            },
        });
        if (!connection) {
            throw new AppError("You can only message connected users.", HTTP_STATUS.FORBIDDEN);
        }
        const chatMessage = await prisma.chatMessage.create({
            data: { senderId: userId, receiverId: targetUserId, message },
            include: { sender: { select: senderSelect } },
        });
        res.status(HTTP_STATUS.CREATED).json({ status: "success", data: { message: chatMessage } });
    }
    catch (error) {
        next(error);
    }
};
// ─── Conversation List ────────────────────────────────────────────────────────
export const getConversationList = async (req, res, next) => {
    try {
        const userId = req.user.id;
        // Get all accepted connections (friends)
        const connections = await prisma.connection.findMany({
            where: {
                status: CONNECTION_STATUS.ACCEPTED,
                OR: [{ requesterId: userId }, { receiverId: userId }],
            },
            include: {
                requester: { select: senderSelect },
                receiver: { select: senderSelect },
            },
        });
        const conversations = await Promise.all(connections.map(async (conn) => {
            const friend = conn.requesterId === userId ? conn.receiver : conn.requester;
            // Get last message
            const lastMessage = await prisma.chatMessage.findFirst({
                where: {
                    chatGroupId: null,
                    OR: [
                        { senderId: userId, receiverId: friend.id },
                        { senderId: friend.id, receiverId: userId },
                    ],
                },
                orderBy: { createdAt: "desc" },
            });
            // Count unread messages
            const unreadCount = await prisma.chatMessage.count({
                where: {
                    senderId: friend.id,
                    receiverId: userId,
                    isRead: false,
                    chatGroupId: null,
                },
            });
            return {
                connectionId: conn.id,
                friend,
                lastMessage,
                unreadCount,
            };
        }));
        res.status(HTTP_STATUS.OK).json({
            status: "success",
            data: { conversations },
        });
    }
    catch (error) {
        next(error);
    }
};
//# sourceMappingURL=chat.controller.js.map