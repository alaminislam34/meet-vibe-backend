import { Router } from "express";
import {
  joinEvent,
  submitPayment,
  reviewParticipation,
  createEventCheckoutSession,
  finalizeEventAttendance,
} from "./participation.controller.js";
import { requireAuth } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validate.js";
import {
  joinEventSchema,
  submitPaymentSchema,
  reviewParticipationSchema,
} from "./participation.validator.js";

const router = Router();

// Apply requireAuth middleware to all participation endpoints
router.use(requireAuth as any);

router.post("/join", validate(joinEventSchema), joinEvent);
router.post("/pay", validate(submitPaymentSchema), submitPayment);
router.post("/pay-checkout", createEventCheckoutSession);
router.post("/review", validate(reviewParticipationSchema), reviewParticipation);
router.post("/finalize/:eventId", finalizeEventAttendance);

export default router;
