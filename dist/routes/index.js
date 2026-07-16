import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes.js";
import userRoutes from "../modules/user/user.routes.js";
import subscriptionRoutes from "../modules/subscription/subscription.routes.js";
import eventRoutes from "../modules/event/event.routes.js";
import participationRoutes from "../modules/participation/participation.routes.js";
import connectionRoutes from "../modules/connection/connection.routes.js";
import chatRoutes from "../modules/chat/chat.routes.js";
import webhookRoutes from "./webhook.routes.js";
const router = Router();
// Modular Routes bindings
router.use("/auth", authRoutes);
router.use("/user", userRoutes);
router.use("/subscription", subscriptionRoutes);
router.use("/event", eventRoutes);
router.use("/participation", participationRoutes);
router.use("/connection", connectionRoutes);
router.use("/chat", chatRoutes);
router.use("/webhooks", webhookRoutes);
export default router;
//# sourceMappingURL=index.js.map