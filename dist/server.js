import { createServer } from "http";
import { Server } from "socket.io";
import app from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./config/db.js";
import { initializeChatSockets } from "./modules/chat/chat.socket.js";
// Handle uncaught exceptions globally to prevent silent crashes
process.on("uncaughtException", (err) => {
    console.error("💥 UNCAUGHT EXCEPTION! Shutting down server...");
    console.error(err.name, err.message, err.stack);
    process.exit(1);
});
const server = createServer(app);
// Initialize Socket.io Server
const io = new Server(server, {
    cors: {
        origin: env.FRONTEND_URL,
        credentials: true,
    },
});
initializeChatSockets(io);
const startServer = async () => {
    try {
        await prisma.$connect();
        console.log("✅ Database connection established successfully.");
        server.listen(env.PORT, () => {
            console.log(`🚀 Server listening on port ${env.PORT} in ${env.NODE_ENV} mode`);
            console.log(`🔗 API Base URL: ${env.BACKEND_URL}`);
        });
    }
    catch (error) {
        console.error("❌ Failed to start server due to database connection error:", error);
        process.exit(1);
    }
};
startServer();
process.on("unhandledRejection", (err) => {
    console.error("💥 UNHANDLED REJECTION! Shutting down server gracefully...");
    console.error(err?.name, err?.message);
    server.close(() => {
        process.exit(1);
    });
});
//# sourceMappingURL=server.js.map