import { Router } from "express";
import { purchaseSubscription, getSubscriptionStatus, mockSubscribe, } from "./subscription.controller.js";
import { requireAuth } from "../../middlewares/auth.js";
const router = Router();
// Apply requireAuth middleware to all subscription endpoints
router.use(requireAuth);
router.post("/purchase", purchaseSubscription);
router.post("/subscribe", purchaseSubscription);
router.post("/mock-subscribe", mockSubscribe);
router.get("/status", getSubscriptionStatus);
export default router;
//# sourceMappingURL=subscription.routes.js.map