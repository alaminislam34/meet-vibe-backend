import { Router } from "express";
import {
  register,
  verifyOtp,
  resendOtp,
  login,
  logout,
  googleLogin,
  googleCallback,
  appleLogin,
  appleCallback,
  forgotPassword,
  resetPassword,
} from "./auth.controller.js";
import { validate } from "../../middlewares/validate.js";
import {
  registerSchema,
  loginSchema,
  verifyOtpSchema,
  resendOtpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "./auth.validator.js";
import { authLimiter } from "../../middlewares/limiter.js";

const router = Router();

router.post("/register", authLimiter, validate(registerSchema), register);
router.post("/verify-otp", authLimiter, validate(verifyOtpSchema), verifyOtp);
router.post("/resend-otp", authLimiter, validate(resendOtpSchema), resendOtp);
router.post("/login", authLimiter, validate(loginSchema), login);
router.post("/logout", logout);
router.post("/forgot-password", authLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post("/reset-password", authLimiter, validate(resetPasswordSchema), resetPassword);

router.get("/google", googleLogin);
router.get("/google/callback", googleCallback);
router.get("/apple", appleLogin);
router.post("/apple/callback", appleCallback);

export default router;
