import { Router } from "express";
import {
  getProfile,
  updateProfile,
  verifyIdentity,
  deleteAccount,
} from "./user.controller.js";
import { requireAuth } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validate.js";
import { updateProfileSchema, deleteAccountSchema } from "./user.validator.js";
import { upload } from "../../utils/uploader.js";

const router = Router();

router.use(requireAuth as any);

router.get("/profile", getProfile);
router.put("/profile", validate(updateProfileSchema), updateProfile);
router.post(
  "/verify-identity",
  upload.fields([
    { name: "govId", maxCount: 1 },
    { name: "selfie", maxCount: 1 },
  ]),
  verifyIdentity
);
router.delete("/account", validate(deleteAccountSchema), deleteAccount);

export default router;
