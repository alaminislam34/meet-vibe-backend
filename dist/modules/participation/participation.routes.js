import { Router } from "express";
import { joinEvent, submitPayment, reviewParticipation, } from "./participation.controller.js";
import { requireAuth } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validate.js";
import { joinEventSchema, submitPaymentSchema, reviewParticipationSchema, } from "./participation.validator.js";
const router = Router();
// Apply requireAuth middleware to all participation endpoints
router.use(requireAuth);
router.post("/join", validate(joinEventSchema), joinEvent);
router.post("/pay", validate(submitPaymentSchema), submitPayment);
router.post("/review", validate(reviewParticipationSchema), reviewParticipation);
export default router;
//# sourceMappingURL=participation.routes.js.map