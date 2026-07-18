import { Router } from "express";
import { getProfile, updateProfile, verifyIdentity, deleteAccount, mockVerifyIdentity, getStripeConnectOnboarding, getStripeConnectStatus, } from "./user.controller.js";
import { requireAuth } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validate.js";
import { updateProfileSchema, deleteAccountSchema } from "./user.validator.js";
const router = Router();
router.use(requireAuth);
router.get("/profile", getProfile);
router.put("/profile", validate(updateProfileSchema), updateProfile);
router.post("/verify-identity", verifyIdentity);
router.post("/mock-verify-identity", mockVerifyIdentity);
router.get("/stripe-connect/onboard", getStripeConnectOnboarding);
router.get("/stripe-connect/status", getStripeConnectStatus);
router.delete("/account", validate(deleteAccountSchema), deleteAccount);
export default router;
//# sourceMappingURL=user.routes.js.map