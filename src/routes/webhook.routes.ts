import { Router } from "express";
import { handleStripeWebhook } from "../modules/user/stripe-webhook.controller.js";

const router = Router();

// Route for Stripe Webhooks - POST /api/v1/webhooks/stripe
router.post("/stripe", handleStripeWebhook);

export default router;
