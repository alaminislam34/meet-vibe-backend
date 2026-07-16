import { Router } from "express";
import { register, verifyOtp, resendOtp, login, logout, refresh, googleLogin, googleCallback, appleLogin, appleCallback, forgotPassword, resetPassword, setupMfa, verifyMfa, mfaLogin, requestMfaRecoveryOtp, verifyMfaRecoveryOtp, disableMfa, } from "./auth.controller.js";
import { validate } from "../../middlewares/validate.js";
import { registerSchema, loginSchema, verifyOtpSchema, resendOtpSchema, forgotPasswordSchema, resetPasswordSchema, mfaLoginSchema, mfaRequestRecoveryOtpSchema, mfaVerifyRecoveryOtpSchema, mfaDisableSchema, } from "./auth.validator.js";
import { authLimiter } from "../../middlewares/limiter.js";
import { requireAuth } from "../../middlewares/auth.js";
const router = Router();
router.post("/register", authLimiter, validate(registerSchema), register);
router.post("/verify-otp", authLimiter, validate(verifyOtpSchema), verifyOtp);
router.post("/resend-otp", authLimiter, validate(resendOtpSchema), resendOtp);
router.post("/login", authLimiter, validate(loginSchema), login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.post("/forgot-password", authLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post("/reset-password", authLimiter, validate(resetPasswordSchema), resetPassword);
// MFA Routes
router.post("/mfa/login", authLimiter, validate(mfaLoginSchema), mfaLogin);
router.post("/mfa/setup", requireAuth, setupMfa);
router.post("/mfa/verify", requireAuth, verifyMfa);
router.post("/mfa/request-recovery-otp", authLimiter, validate(mfaRequestRecoveryOtpSchema), requestMfaRecoveryOtp);
router.post("/mfa/verify-recovery-otp", authLimiter, validate(mfaVerifyRecoveryOtpSchema), verifyMfaRecoveryOtp);
router.post("/mfa/disable", requireAuth, validate(mfaDisableSchema), disableMfa);
router.get("/google", googleLogin);
router.get("/google/callback", googleCallback);
router.get("/apple", appleLogin);
router.post("/apple/callback", appleCallback);
export default router;
//# sourceMappingURL=auth.routes.js.map