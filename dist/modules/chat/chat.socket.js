import { verifyToken } from "../../utils/jwt.js";
import { prisma } from "../../config/db.js";
import { PARTICIPANT_STATUS, CONNECTION_STATUS, EVENT_STATUS } from "../../constants/index.js";
export const initializeChatSockets = (io) => {
    // 1. WebSocket Authorization Middleware
    io.use(async (socket, next) => {
        try {
            let token = socket.handshake.auth?.token ||
                socket.handshake.headers?.authorization;
            if (token && token.startsWith("Bearer ")) {
                token = token.split(" ")[1];
            }
            if (!token) {
                return next(new Error("Authentication error: Session token required"));
            }
            const decoded = verifyToken(token);
            const user = await prisma.user.findUnique({
                where: { id: decoded.userId },
            });
            if (!user) {
                return next(new Error("Authentication error: User not found"));
            }
            // Attach authenticated user to socket instance
            socket.user = user;
            next();
        }
        catch (err) {
            return next(new Error("Authentication error: Invalid session token"));
        }
    });
    // 2. Event Listeners
    io.on("connection", (socket) => {
        const user = socket.user;
        console.log(`⚡ WebSocket Connected: ${user.name} (${socket.id})`);
        // Assign user to a personal room for private message delivery
        socket.join(`user:${user.id}`);
        // Action: Join Event group chat room
        socket.on("join_event_chat", async ({ eventId }) => {
            try {
                const event = await prisma.event.findUnique({
                    where: { id: eventId },
                    include: {
                        participants: {
                            where: { userId: user.id, status: PARTICIPANT_STATUS.APPROVED },
                        },
                    },
                });
                if (!event || event.status !== EVENT_STATUS.PUBLISHED) {
                    socket.emit("error_msg", { message: "Published event not found" });
                    return;
                }
                const hasAccess = event.creatorId === user.id || event.participants.length > 0;
                if (!hasAccess) {
                    socket.emit("error_msg", {
                        message: "Unauthorized: You must be an approved participant of this event",
                    });
                    return;
                }
                socket.join(`event:${eventId}`);
                console.log(`👥 Socket joined event-chat room: event:${eventId}`);
            }
            catch (error) {
                socket.emit("error_msg", { message: "Error joining event chat room" });
            }
        });
        // Action: Send direct private message
        socket.on("send_private_message", async ({ receiverId, message }) => {
            try {
                if (!message || message.trim() === "") {
                    socket.emit("error_msg", { message: "Message content cannot be empty" });
                    return;
                }
                // Validate that sender and receiver are connected
                const connection = await prisma.connection.findFirst({
                    where: {
                        status: CONNECTION_STATUS.ACCEPTED,
                        OR: [
                            { requesterId: user.id, receiverId },
                            { requesterId: receiverId, receiverId: user.id },
                        ],
                    },
                });
                if (!connection) {
                    socket.emit("error_msg", {
                        message: "Unauthorized: You must be connected to message this user",
                    });
                    return;
                }
                const chatMessage = await prisma.chatMessage.create({
                    data: {
                        senderId: user.id,
                        receiverId,
                        message,
                    },
                    include: {
                        sender: {
                            select: { id: true, name: true, image: true },
                        },
                    },
                });
                io.to(`user:${receiverId}`).emit("new_private_message", chatMessage);
                socket.emit("new_private_message", chatMessage);
            }
            catch (error) {
                socket.emit("error_msg", { message: "Failed to dispatch private message" });
            }
        });
        // Action: Send event group chat message
        socket.on("send_group_message", async ({ eventId, message }) => {
            try {
                if (!message || message.trim() === "") {
                    socket.emit("error_msg", { message: "Message content cannot be empty" });
                    return;
                }
                const event = await prisma.event.findUnique({
                    where: { id: eventId },
                    include: {
                        participants: {
                            where: { userId: user.id, status: PARTICIPANT_STATUS.APPROVED },
                        },
                        chatGroup: true,
                    },
                });
                if (!event || event.status !== EVENT_STATUS.PUBLISHED) {
                    socket.emit("error_msg", { message: "Published event not found" });
                    return;
                }
                const hasAccess = event.creatorId === user.id || event.participants.length > 0;
                if (!hasAccess || !event.chatGroup) {
                    socket.emit("error_msg", {
                        message: "Unauthorized: Only approved participants can chat",
                    });
                    return;
                }
                const chatMessage = await prisma.chatMessage.create({
                    data: {
                        chatGroupId: event.chatGroup.id,
                        senderId: user.id,
                        message,
                    },
                    include: {
                        sender: {
                            select: { id: true, name: true, image: true },
                        },
                    },
                });
                io.to(`event:${eventId}`).emit("new_group_message", chatMessage);
            }
            catch (error) {
                socket.emit("error_msg", { message: "Failed to dispatch group message" });
            }
        });
        socket.on("disconnect", () => {
            console.log(`🔌 WebSocket Disconnected: ${user.name} (${socket.id})`);
        });
    });
};
//# sourceMappingURL=chat.socket.js.map