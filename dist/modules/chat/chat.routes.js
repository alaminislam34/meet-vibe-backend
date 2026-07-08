import { Router } from "express";
import { getGroupMessages, sendGroupMessage, getPrivateMessages, sendPrivateMessage, getConversationList, } from "./chat.controller.js";
import { requireAuth } from "../../middlewares/auth.js";
const router = Router();
router.use(requireAuth);
router.get("/conversations", getConversationList); // All private conversations
router.get("/group/:eventId", getGroupMessages); // Group chat messages + participants
router.post("/group/:eventId", sendGroupMessage); // Send group message (REST)
router.get("/private/:targetUserId", getPrivateMessages); // Private chat history
router.post("/private/:targetUserId", sendPrivateMessage); // Send private message (REST)
export default router;
//# sourceMappingURL=chat.routes.js.map