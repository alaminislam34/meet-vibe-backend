import { Router } from "express";
import {
  purchaseSubscription,
  getSubscriptionStatus,
  mockSubscribe,
  recordIAPSubscription,
} from "./subscription.controller.js";
import { requireAuth } from "../../middlewares/auth.js";

const router = Router();

// Apply requireAuth middleware to all subscription endpoints
router.use(requireAuth as any);

router.post("/purchase", purchaseSubscription);
router.post("/subscribe", purchaseSubscription);
router.post("/mock-subscribe", mockSubscribe);
router.post("/iap-record", recordIAPSubscription);
router.get("/status", getSubscriptionStatus);

export default router;
