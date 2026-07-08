import { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { prisma } from "../../config/db.js";
import { AppError } from "../../utils/errors.js";
import { HTTP_STATUS } from "../../constants/index.js";
import { generateToken } from "../../utils/jwt.js";
import { setAuthCookie, clearAuthCookie } from "../../utils/cookie.js";
import { env } from "../../config/env.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Generates a random 6-digit OTP and 10-minute expiry */
const generateOTP = (): { code: string; expiry: Date } => {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiry = new Date(Date.now() + 10 * 60 * 1000);
  return { code, expiry };
};

// ─── Register ────────────────────────────────────────────────────────────────

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password, name } = req.body;

    // 1. Check for duplicate email
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError("Email is already registered", HTTP_STATUS.CONFLICT);
    }

    // 2. Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // 3. Generate OTP
    const { code, expiry } = generateOTP();

    // 4. Create user (unverified)
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        provider: "LOCAL",
        otpCode: code,
        otpExpiry: expiry,
      },
    });

    // 5. Dispatch OTP (console in dev, hook up SMTP in production)
    console.log(`✉️  [OTP - Register] Email: ${email} | Code: [${code}]`);

    res.status(HTTP_STATUS.CREATED).json({
      status: "success",
      message: "Registration successful. Please verify your email with the OTP sent.",
      data: { email: user.email },
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

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new AppError("User not found", HTTP_STATUS.NOT_FOUND);
    }

    if (user.isVerified) {
      throw new AppError("Email is already verified", HTTP_STATUS.BAD_REQUEST);
    }

    // Validate OTP match and expiry
    if (
      !user.otpCode ||
      !user.otpExpiry ||
      user.otpCode !== otp ||
      user.otpExpiry < new Date()
    ) {
      throw new AppError("Invalid or expired OTP code", HTTP_STATUS.BAD_REQUEST);
    }

    // Mark verified, clear OTP fields
    const verified = await prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        otpCode: null,
        otpExpiry: null,
      },
    });

    // Auto-login: generate JWT and set cookie
    const token = generateToken({ userId: verified.id });
    setAuthCookie(res, token);

    res.status(HTTP_STATUS.OK).json({
      status: "success",
      message: "Email verified successfully. You are now logged in.",
      data: {
        user: {
          id: verified.id,
          email: verified.email,
          name: verified.name,
          image: verified.image,
          is18Plus: verified.is18Plus,
          isHuman: verified.isHuman,
        },
      },
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

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new AppError("User not found", HTTP_STATUS.NOT_FOUND);
    }

    if (user.isVerified) {
      throw new AppError("Email is already verified", HTTP_STATUS.BAD_REQUEST);
    }

    const { code, expiry } = generateOTP();

    await prisma.user.update({
      where: { id: user.id },
      data: { otpCode: code, otpExpiry: expiry },
    });

    console.log(`✉️  [OTP - Resend] Email: ${email} | Code: [${code}]`);

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

    // 1. Find user
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.password) {
      throw new AppError("Invalid email or password", HTTP_STATUS.UNAUTHORIZED);
    }

    // 2. Block unverified accounts
    if (!user.isVerified) {
      throw new AppError(
        "Please verify your email before logging in.",
        HTTP_STATUS.FORBIDDEN
      );
    }

    // 3. Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new AppError("Invalid email or password", HTTP_STATUS.UNAUTHORIZED);
    }

    // 4. Generate JWT & set cookie
    const token = generateToken({ userId: user.id });
    setAuthCookie(res, token);

    res.status(HTTP_STATUS.OK).json({
      status: "success",
      message: "Login successful.",
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          is18Plus: user.is18Plus,
          isHuman: user.isHuman,
        },
      },
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
    clearAuthCookie(res);

    res.status(HTTP_STATUS.OK).json({
      status: "success",
      message: "Logged out successfully.",
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

    const user = await prisma.user.findUnique({ where: { email } });

    // Silently succeed even if email not found (prevents enumeration)
    if (user) {
      const { code, expiry } = generateOTP();

      await prisma.user.update({
        where: { id: user.id },
        data: { otpCode: code, otpExpiry: expiry },
      });

      console.log(`✉️  [OTP - Forgot Password] Email: ${email} | Code: [${code}]`);
    }

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

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new AppError("Invalid reset request", HTTP_STATUS.BAD_REQUEST);
    }

    // Validate OTP
    if (
      !user.otpCode ||
      !user.otpExpiry ||
      user.otpCode !== otp ||
      user.otpExpiry < new Date()
    ) {
      throw new AppError("Invalid or expired OTP code", HTTP_STATUS.BAD_REQUEST);
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        otpCode: null,
        otpExpiry: null,
      },
    });

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

    // TODO: Exchange code for real Google profile in production
    const mockProfile = {
      id: "google-oauth-id-12345",
      email: "google-user@example.com",
      name: "Google User",
      image: "https://lh3.googleusercontent.com/a/mock",
    };

    let user = await prisma.user.findUnique({ where: { email: mockProfile.email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: mockProfile.email,
          name: mockProfile.name,
          image: mockProfile.image,
          provider: "GOOGLE",
          providerId: mockProfile.id,
          isVerified: true,
        },
      });
    }

    const token = generateToken({ userId: user.id });
    setAuthCookie(res, token);

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

    // TODO: Exchange code for real Apple profile/ID token in production
    const mockProfile = {
      id: "apple-user-id-54321",
      email: "apple-user@example.com",
      name: "Apple User",
    };

    let user = await prisma.user.findUnique({ where: { email: mockProfile.email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: mockProfile.email,
          name: mockProfile.name,
          provider: "APPLE",
          providerId: mockProfile.id,
          isVerified: true,
        },
      });
    }

    const token = generateToken({ userId: user.id });
    setAuthCookie(res, token);

    res.render("oauth-callback", {
      status: "success",
      message: "OAuth login completed",
      targetUrl: env.FRONTEND_URL,
    });
  } catch (error) {
    next(error);
  }
};
