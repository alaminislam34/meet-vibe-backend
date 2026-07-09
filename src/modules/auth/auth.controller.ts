import { Request, Response, NextFunction } from "express";
import { AuthService } from "./auth.service.js";
import { AuthRepository } from "./auth.repository.js";
import { HTTP_STATUS } from "../../constants/index.js";
import { AppError } from "../../utils/errors.js";
import { setAuthCookies, clearAuthCookies } from "../../utils/cookie.js";
import { env } from "../../config/env.js";
import { RequestContext } from "./auth.types.js";

/**
 * Dependency Injection — manual composition root for the auth module.
 * The repository is instantiated once and injected into the service.
 * In a larger app this would be handled by a DI container (e.g., tsyringe, inversify).
 */
const authRepository = new AuthRepository();
const authService = new AuthService(authRepository);

/**
 * Extracts network metadata from the request for session tracking.
 * Forwarded to the service layer — never used for auth decisions,
 * only for session records and future audit logging.
 */
const getRequestContext = (req: Request): RequestContext => ({
  ipAddress: req.ip,
  userAgent: req.headers["user-agent"],
});

// ─── Register ────────────────────────────────────────────────────────────────

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password, name } = req.body;

    const result = await authService.register({ email, password, name });

    res.status(HTTP_STATUS.CREATED).json({
      status: "success",
      message: "Registration successful. Please verify your email with the OTP sent.",
      data: { email: result.email },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Verify OTP ──────────────────────────────────────────────────────────────

export const verifyOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, otp } = req.body;

    const { user, accessToken, refreshToken } = await authService.verifyOtp(
      { email, otp },
      getRequestContext(req)
    );

    setAuthCookies(res, accessToken, refreshToken);

    res.status(HTTP_STATUS.OK).json({
      status: "success",
      message: "Email verified successfully. You are now logged in.",
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Resend OTP ──────────────────────────────────────────────────────────────

export const resendOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email } = req.body;

    await authService.resendOtp(email);

    res.status(HTTP_STATUS.OK).json({
      status: "success",
      message: "A new OTP has been sent to your email.",
    });
  } catch (error) {
    next(error);
  }
};

// ─── Login ───────────────────────────────────────────────────────────────────

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body;

    const result = await authService.login(
      { email, password },
      getRequestContext(req)
    );

    if ("mfaRequired" in result) {
      res.status(HTTP_STATUS.OK).json({
        status: "success",
        message: "MFA code required.",
        data: { mfaRequired: true, mfaToken: result.mfaToken },
      });
      return;
    }

    setAuthCookies(res, result.accessToken, result.refreshToken);

    res.status(HTTP_STATUS.OK).json({
      status: "success",
      message: "Login successful.",
      data: { user: result.user },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Logout ──────────────────────────────────────────────────────────────────

export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token = req.cookies?.refresh_token;
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (token) {
      await authService.logout(token);
    }

    clearAuthCookies(res);

    res.status(HTTP_STATUS.OK).json({
      status: "success",
      message: "Logged out successfully.",
    });
  } catch (error) {
    next(error);
  }
};

// ─── Refresh Token ───────────────────────────────────────────────────────────

export const refresh = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.cookies?.refresh_token;

    if (!token) {
      throw new AppError("Refresh token required", HTTP_STATUS.UNAUTHORIZED);
    }

    const { accessToken, refreshToken } = await authService.refreshSession(
      token,
      getRequestContext(req)
    );

    setAuthCookies(res, accessToken, refreshToken);

    res.status(HTTP_STATUS.OK).json({
      status: "success",
      message: "Tokens refreshed successfully.",
    });
  } catch (error) {
    next(error);
  }
};

// ─── Forgot Password ─────────────────────────────────────────────────────────

export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email } = req.body;

    await authService.forgotPassword(email);

    res.status(HTTP_STATUS.OK).json({
      status: "success",
      message: "If this email is registered, a password reset OTP has been sent.",
    });
  } catch (error) {
    next(error);
  }
};

// ─── Reset Password ───────────────────────────────────────────────────────────

export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, otp, password } = req.body;

    await authService.resetPassword({ email, otp, password });

    res.status(HTTP_STATUS.OK).json({
      status: "success",
      message: "Password reset successfully. You can now log in with your new password.",
    });
  } catch (error) {
    next(error);
  }
};

// ─── OAuth Callbacks (scaffolded) ─────────────────────────────────────────────

export const googleLogin = (req: Request, res: Response): void => {
  const redirectUri = `${env.BACKEND_URL}/api/v1/auth/google/callback?code=mock-google-code`;
  res.redirect(redirectUri);
};

export const googleCallback = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const code = req.query.code;
    if (!code) {
      throw new AppError("Authorization code not provided", HTTP_STATUS.BAD_REQUEST);
    }

    // TODO: Exchange code for real Google profile via Google OAuth2 SDK in production
    const mockProfile = {
      id: "google-oauth-id-12345",
      email: "google-user@example.com",
      name: "Google User",
      image: "https://lh3.googleusercontent.com/a/mock",
    };

    const { user, accessToken, refreshToken } = await authService.oauthCallback(
      "GOOGLE",
      mockProfile,
      getRequestContext(req)
    );

    setAuthCookies(res, accessToken, refreshToken);

    res.render("oauth-callback", {
      status: "success",
      message: "OAuth login completed",
      targetUrl: env.FRONTEND_URL,
    });
  } catch (error) {
    next(error);
  }
};

export const appleLogin = (req: Request, res: Response): void => {
  const redirectUri = `${env.BACKEND_URL}/api/v1/auth/apple/callback?code=mock-apple-code`;
  res.redirect(redirectUri);
};

export const appleCallback = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const code = req.query.code;
    if (!code) {
      throw new AppError("Authorization code not provided", HTTP_STATUS.BAD_REQUEST);
    }

    // TODO: Exchange code for real Apple profile/ID token via Apple Sign-In SDK in production
    const mockProfile = {
      id: "apple-user-id-54321",
      email: "apple-user@example.com",
      name: "Apple User",
    };

    const { user, accessToken, refreshToken } = await authService.oauthCallback(
      "APPLE",
      mockProfile,
      getRequestContext(req)
    );

    setAuthCookies(res, accessToken, refreshToken);

    res.render("oauth-callback", {
      status: "success",
      message: "OAuth login completed",
      targetUrl: env.FRONTEND_URL,
    });
  } catch (error) {
    next(error);
  }
};

// ─── MFA Setup & Verification ────────────────────────────────────────────────

export const setupMfa = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user.id; // From requireAuth middleware

    const { secret, qrCodeUrl } = await authService.generateMfaSecret(userId);

    res.status(HTTP_STATUS.OK).json({
      status: "success",
      message: "MFA secret generated. Please scan the QR code with your authenticator app.",
      data: { secret, qrCodeUrl },
    });
  } catch (error) {
    next(error);
  }
};

export const verifyMfa = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user.id; // From requireAuth middleware
    const { code } = req.body;

    if (!code) {
      throw new AppError("MFA code is required", HTTP_STATUS.BAD_REQUEST);
    }

    const { recoveryCodes } = await authService.verifyAndEnableMfa(userId, code);

    res.status(HTTP_STATUS.OK).json({
      status: "success",
      message: "MFA enabled successfully. Please save these recovery codes in a secure place.",
      data: { recoveryCodes },
    });
  } catch (error) {
    next(error);
  }
};

export const mfaLogin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { mfaToken, mfaCode } = req.body;

    const { user, accessToken, refreshToken } = await authService.mfaLogin(
      { mfaToken, mfaCode },
      getRequestContext(req)
    );

    setAuthCookies(res, accessToken, refreshToken);

    res.status(HTTP_STATUS.OK).json({
      status: "success",
      message: "MFA verified successfully.",
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};
