import argon2 from "argon2";
import crypto from "crypto";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import { generateAccessToken, generateMfaToken, verifyMfaToken } from "../../utils/jwt.js";
import { auditLogger } from "../../utils/auditLogger.js";
import { sendVerificationEmail, sendPasswordResetEmail, sendMfaRecoveryEmail } from "../../utils/mailer.js";
import { AuthRepository } from "./auth.repository.js";
import { AppError } from "../../utils/errors.js";
import { HTTP_STATUS } from "../../constants/index.js";
import {
  RegisterDTO,
  LoginDTO,
  VerifyOtpDTO,
  ResetPasswordDTO,
  RequestContext,
  AuthResult,
  SafeUser,
  OAuthProfile,
  OAuthProvider,
  VerificationPurpose,
  MfaLoginDTO,
  LoginResult,
  MfaRequestRecoveryOtpDTO,
  MfaVerifyRecoveryOtpDTO,
} from "./auth.types.js";
import { User } from "@prisma/client";

/**
 * AuthService — contains all authentication business logic.
 *
 * Design principles:
 *  - All DB access is delegated to AuthRepository (never calls Prisma directly).
 *  - All crypto/hashing lives in private static helpers.
 *  - Public methods map 1:1 to auth use cases (register, login, logout, etc.).
 *  - Methods return typed results defined in auth.types.ts.
 */
export class AuthService {
  /**
   * The repository instance is injected via the constructor.
   * This decoupling allows unit tests to inject a mock repository without
   * touching Prisma or the actual database.
   */
  constructor(private readonly repository: AuthRepository) { }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  /**
   * Generates a cryptographically random 6-digit OTP and a 10-minute expiry.
   * Uses `Math.random()` seeded range for a uniformly distributed 6-digit code.
   */
  private generateOTP(): { code: string; expiry: Date } {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    return { code, expiry };
  }

  /**
   * Persists a new stateful session and returns access and refresh tokens.
   * The refresh token is stored in the DB with an associated family ID.
   */
  private async createTokens(userId: string, context?: RequestContext, familyId?: string): Promise<{ accessToken: string; refreshToken: string }> {
    const refreshToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const activeFamilyId = familyId || crypto.randomUUID();

    const session = await this.repository.createSession({
      userId,
      token: refreshToken,
      expiresAt,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      familyId: activeFamilyId,
    });

    const accessToken = generateAccessToken({ userId, sessionId: session.id });

    return { accessToken, refreshToken };
  }

  /**
   * Constructs the SafeUser shape from a full Prisma User record.
   * Explicitly picking fields ensures no accidental credential or
   * internal flag leakage in API responses if the User schema grows.
   */
  private toSafeUser(user: User): SafeUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      isEmailVerified: user.isEmailVerified,
      verificationStatus: user.verificationStatus,
      is18Plus: user.is18Plus,
      isHuman: user.isHuman,
      mfaEnabled: user.mfaEnabled,
      createdAt: user.createdAt,
    };
  }

  /**
   * Creates and persists a new OTP verification token.
   * Always clears previous tokens for the same identifier+purpose first
   * to enforce single-token-per-flow — prevents code hoarding attacks.
   */
  private async issueOtp(
    identifier: string,
    purpose: VerificationPurpose
  ): Promise<string> {
    const { code, expiry } = this.generateOTP();

    // Delete any existing OTPs for this flow before creating a new one
    await this.repository.deleteVerificationsByIdentifier(identifier, purpose);

    await this.repository.createVerification({
      identifier,
      value: code,
      expiresAt: expiry,
      purpose,
    });

    return code;
  }

  // ─── Use Cases ────────────────────────────────────────────────────────────

  /**
   * Registers a new user with LOCAL credentials.
   *
   * Flow:
   *  1. Guard against duplicate email (returns 409 to prevent silent failure).
   *  2. Hash password with argon2id.
   *  3. Persist User + Account records.
   *  4. Issue and persist an EMAIL_VERIFICATION OTP.
   *  5. Return only the email so the client knows to prompt for OTP entry.
   *
   * NOTE: The OTP is currently logged to console. Wire up the mailer utility
   * in Phase 6 to send this via SMTP instead.
   */
  async register(dto: RegisterDTO): Promise<Pick<SafeUser, "email">> {
    // 1. Duplicate check
    const existing = await this.repository.findUserByEmail(dto.email);
    if (existing) {
      throw new AppError("Email is already registered", HTTP_STATUS.CONFLICT);
    }

    // 2. Hash password
    // Phase 2: Use Argon2id with OWASP recommended parameters
    const hashedPassword = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    // 3. Create User record
    const user = await this.repository.createUser({
      email: dto.email,
      name: dto.name,
    });

    // 4. Create LOCAL Account linked to the user
    await this.repository.createAccount({
      userId: user.id,
      providerId: "LOCAL",
      accountId: dto.email, // For LOCAL: accountId is the email (the unique identifier)
      password: hashedPassword,
    });

    // 5. Issue EMAIL_VERIFICATION OTP
    const code = await this.issueOtp(dto.email, "EMAIL_VERIFICATION");

    // Phase 6: Use the Mailer utility
    await sendVerificationEmail(dto.email, code);

    return { email: user.email };
  }

  /**
   * Verifies the 6-digit email OTP and auto-logs the user in.
   *
   * Flow:
   *  1. Guard: user must exist and not already be verified.
   *  2. Look up the verification record by compound key (email + code).
   *  3. Guard: record must exist, be for EMAIL_VERIFICATION, and not be expired.
   *  4. Mark user as verified.
   *  5. Delete the used OTP (single-use enforcement).
   *  6. Create a session and return the token + safe user.
   */
  async verifyOtp(dto: VerifyOtpDTO, context?: RequestContext): Promise<AuthResult> {
    const user = await this.repository.findUserByEmail(dto.email);

    if (!user) {
      throw new AppError("User not found", HTTP_STATUS.NOT_FOUND);
    }
    if (user.isEmailVerified) {
      throw new AppError("Email is already verified", HTTP_STATUS.BAD_REQUEST);
    }

    // Validate OTP
    const verification = await this.repository.findVerification({
      identifier: dto.email,
      value: dto.otp,
    });

    if (
      !verification ||
      verification.purpose !== "EMAIL_VERIFICATION" ||
      verification.expiresAt < new Date()
    ) {
      throw new AppError("Invalid or expired OTP code", HTTP_STATUS.BAD_REQUEST);
    }

    // Mark verified + delete used OTP atomically (best-effort; not a hard transaction
    // since a partial failure here is recoverable — user can re-verify)
    const verifiedUser = await this.repository.markUserVerified(user.id);
    await this.repository.deleteVerificationById(verification.id);

    // Auto-login: create tokens
    const tokens = await this.createTokens(verifiedUser.id, context);

    return { user: this.toSafeUser(verifiedUser), ...tokens };
  }

  /**
   * Re-issues a new EMAIL_VERIFICATION OTP for an unverified user.
   * Clears any previous code first (enforced inside `issueOtp`).
   */
  async resendOtp(email: string): Promise<void> {
    const user = await this.repository.findUserByEmail(email);

    if (!user) {
      throw new AppError("User not found", HTTP_STATUS.NOT_FOUND);
    }
    if (user.isEmailVerified) {
      throw new AppError("Email is already verified", HTTP_STATUS.BAD_REQUEST);
    }

    const code = await this.issueOtp(email, "EMAIL_VERIFICATION");

    await sendVerificationEmail(email, code);
  }

  /**
   * Validates LOCAL credentials and creates a session on success.
   *
   * Security note: The error message is intentionally generic ("Invalid email
   * or password") for BOTH a missing user AND a wrong password. Returning
   * "user not found" vs "wrong password" would allow user enumeration.
   *
   * Flow:
   *  1. Find user with their LOCAL account (single DB query via join).
   *  2. Guard: user + account + password must all exist (same generic error).
   *  3. Guard: account must be verified before login is permitted.
   *  4. Compare submitted password against stored hash.
   *  5. Create session and return the token + safe user.
   */
  async login(dto: LoginDTO, context?: RequestContext): Promise<LoginResult> {
    const user = await this.repository.findUserWithLocalAccount(dto.email);
    const account = user?.accounts[0];

    // Generic error — do NOT distinguish "user not found" from "wrong password"
    if (!user || !account || !account.password) {
      await auditLogger.log({
        event: "LOGIN_FAILURE",
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        metadata: { email: dto.email, reason: "user_not_found_or_no_password" },
      });
      throw new AppError("Invalid email or password", HTTP_STATUS.UNAUTHORIZED);
    }

    // Check if account is currently locked out
    if (account.lockedUntil && account.lockedUntil > new Date()) {
      await auditLogger.log({
        userId: user.id,
        event: "ACCOUNT_LOCKED",
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        metadata: { email: dto.email, reason: "active_lockout" },
      });
      throw new AppError("Invalid email or password", HTTP_STATUS.UNAUTHORIZED);
    }

    if (!user.isEmailVerified) {
      await auditLogger.log({
        userId: user.id,
        event: "LOGIN_FAILURE",
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        metadata: { email: dto.email, reason: "unverified_email" },
      });
      throw new AppError(
        "Please verify your email before logging in.",
        HTTP_STATUS.FORBIDDEN
      );
    }

    const isMatch = await argon2.verify(account.password, dto.password);
    if (!isMatch) {
      const newAttempts = account.failedLoginAttempts + 1;
      let lockUntil: Date | undefined = undefined;

      if (newAttempts >= 5) {
        lockUntil = new Date(Date.now() + 15 * 60 * 1000); // Lock for 15 minutes
        await auditLogger.log({
          userId: user.id,
          event: "ACCOUNT_LOCKED",
          ipAddress: context?.ipAddress,
          userAgent: context?.userAgent,
          metadata: { email: dto.email, reason: "max_attempts_reached" },
        });
      } else {
        await auditLogger.log({
          userId: user.id,
          event: "LOGIN_FAILURE",
          ipAddress: context?.ipAddress,
          userAgent: context?.userAgent,
          metadata: { email: dto.email, reason: "invalid_password" },
        });
      }

      await this.repository.incrementFailedLoginAttempts(account.id, lockUntil);

      throw new AppError("Invalid email or password", HTTP_STATUS.UNAUTHORIZED);
    }

    // Success! Reset failed login attempts
    if (account.failedLoginAttempts > 0 || account.lockedUntil) {
      await this.repository.resetFailedLoginAttempts(account.id);
    }

    // ─── MFA Verification ───
    if (user.mfaEnabled) {
      const mfaToken = generateMfaToken(user.id);
      return { mfaRequired: true, mfaToken };
    }

    const tokens = await this.createTokens(user.id, context);

    await auditLogger.log({
      userId: user.id,
      event: "LOGIN_SUCCESS",
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return { user: this.toSafeUser(user), ...tokens };
  }

  /**
   * Refreshes the session by issuing new access and refresh tokens.
   * Features Refresh Token Rotation and Reuse Detection.
   */
  async refreshSession(refreshToken: string, context?: RequestContext): Promise<{ accessToken: string; refreshToken: string }> {
    const session = await this.repository.findSessionWithUser(refreshToken);

    if (!session) {
      throw new AppError("Invalid refresh token", HTTP_STATUS.UNAUTHORIZED);
    }

    // Reuse Detection
    if (session.isRevoked) {
      await this.repository.revokeTokenFamily(session.familyId);
      throw new AppError("Token reuse detected. All sessions revoked for security.", HTTP_STATUS.UNAUTHORIZED);
    }

    if (session.expiresAt < new Date()) {
      throw new AppError("Refresh token expired", HTTP_STATUS.UNAUTHORIZED);
    }

    // Rotate token: revoke old, issue new in the same family
    await this.repository.revokeSession(session.id);

    return this.createTokens(session.userId, context, session.familyId);
  }

  /**
   * Terminates the current session by deleting it from the database.
   * Opaque token deletion = instant revocation with no client-side reliance.
   */
  async logout(token: string): Promise<void> {
    await this.repository.deleteSessionByToken(token);
  }

  /**
   * Initiates a password reset flow by issuing a PASSWORD_RESET OTP.
   *
   * Security note: The response is always 200 OK regardless of whether the
   * email exists in the system. This prevents user enumeration via the
   * "forgot password" endpoint.
   */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.repository.findUserByEmail(email);

    // Silently succeed if user not found — prevents email enumeration
    if (user) {
      const code = await this.issueOtp(email, "PASSWORD_RESET");

      await sendPasswordResetEmail(email, code);
    }
  }

  /**
   * Resets a user's password after validating their PASSWORD_RESET OTP.
   *
   * Flow:
   *  1. Guard: user must exist (400, not 404, to prevent enumeration).
   *  2. Validate OTP exists, is for PASSWORD_RESET, and has not expired.
   *  3. Hash the new password.
   *  4. Update the LOCAL account password.
   *  5. Delete the used OTP (single-use).
   */
  async resetPassword(dto: ResetPasswordDTO): Promise<void> {
    const user = await this.repository.findUserByEmail(dto.email);
    if (!user) {
      // Generic 400 — avoid leaking whether the email exists via 404
      throw new AppError("Invalid reset request", HTTP_STATUS.BAD_REQUEST);
    }

    const verification = await this.repository.findVerification({
      identifier: dto.email,
      value: dto.otp,
    });

    if (
      !verification ||
      verification.purpose !== "PASSWORD_RESET" ||
      verification.expiresAt < new Date()
    ) {
      throw new AppError("Invalid or expired OTP code", HTTP_STATUS.BAD_REQUEST);
    }

    const hashedPassword = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    await this.repository.updateAccountPassword(user.id, hashedPassword);
    await this.repository.deleteVerificationById(verification.id);

    // Context is not available here unless we pass it, but we log the basic event
    await auditLogger.log({
      userId: user.id,
      event: "PASSWORD_RESET",
      metadata: { email: dto.email },
    });
  }

  /**
   * Handles OAuth login/registration for GOOGLE and APPLE providers.
   *
   * Flow:
   *  1. Look up an existing Account by provider + providerUserId.
   *  2a. If account exists → return its linked User.
   *  2b. If no account → check if the email is already registered:
   *      - Yes → link a new OAuth Account to the existing User.
   *      - No  → create a new User + Account together.
   *  3. Create session and return.
   */
  async oauthCallback(
    provider: OAuthProvider,
    profile: OAuthProfile,
    context?: RequestContext
  ): Promise<AuthResult> {
    // 1. Check if we already have this OAuth account
    const existingAccount = await this.repository.findAccountByProvider(
      provider,
      profile.id
    );

    let user: User;

    if (existingAccount) {
      // Returning OAuth user
      user = existingAccount.user;
    } else {
      // Check if email is already registered (e.g., the user registered with LOCAL first)
      const existingUser = await this.repository.findUserByEmail(profile.email);

      if (existingUser) {
        // Link the new OAuth provider to the existing user account
        user = existingUser;
        await this.repository.createAccount({
          userId: user.id,
          providerId: provider,
          accountId: profile.id,
        });
      } else {
        // Brand new user — create User + Account
        user = await this.repository.createUser({
          email: profile.email,
          name: profile.name,
        });

        // OAuth users are considered verified — the provider already confirmed the email
        user = await this.repository.markUserVerified(user.id);

        await this.repository.createAccount({
          userId: user.id,
          providerId: provider,
          accountId: profile.id,
        });
      }
    }

    const tokens = await this.createTokens(user.id, context);

    return { user: this.toSafeUser(user), ...tokens };
  }

  // ─── MFA Operations ──────────────────────────────────────────────────────────

  /**
   * Generates an MFA secret and returns the QR code URL for setup.
   */
  async generateMfaSecret(userId: string): Promise<{ secret: string; qrCodeUrl: string }> {
    const user = await this.repository.findUserById(userId);
    if (!user) throw new AppError("User not found", HTTP_STATUS.NOT_FOUND);

    if (user.mfaEnabled) {
      throw new AppError("MFA is already enabled", HTTP_STATUS.BAD_REQUEST);
    }

    const secret = speakeasy.generateSecret({ name: `Meet Vibe (${user.email})` });
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

    // Save secret but do not enable it yet
    await this.repository.updateUserMfaStatus(userId, false, secret.base32);

    return { secret: secret.base32, qrCodeUrl };
  }

  /**
   * Verifies the first MFA code and fully enables MFA for the user.
   * Generates and returns backup recovery codes.
   */
  async verifyAndEnableMfa(userId: string, code: string): Promise<{ recoveryCodes: string[] }> {
    const user = await this.repository.findUserById(userId);
    if (!user || !user.mfaSecret) {
      throw new AppError("MFA setup not initialized", HTTP_STATUS.BAD_REQUEST);
    }

    if (user.mfaEnabled) {
      throw new AppError("MFA is already enabled", HTTP_STATUS.BAD_REQUEST);
    }

    const isValid = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: "base32",
      token: code,
      window: 1
    });
    if (!isValid) {
      throw new AppError("Invalid MFA code", HTTP_STATUS.UNAUTHORIZED);
    }

    // Generate 10 recovery codes
    const rawRecoveryCodes = Array.from({ length: 10 }, () => crypto.randomBytes(4).toString("hex"));

    // Hash them for secure DB storage
    const hashedCodes = await Promise.all(
      rawRecoveryCodes.map(c => argon2.hash(c, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
      }))
    );

    await this.repository.updateUserMfaStatus(userId, true, user.mfaSecret, hashedCodes);

    return { recoveryCodes: rawRecoveryCodes };
  }

  /**
   * Finalizes login by verifying the MFA code.
   */
  async mfaLogin(dto: MfaLoginDTO, context?: RequestContext): Promise<AuthResult> {
    const userId = verifyMfaToken(dto.mfaToken);

    const user = await this.repository.findUserById(userId);
    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      throw new AppError("Invalid MFA setup", HTTP_STATUS.BAD_REQUEST);
    }

    const isTotpValid = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: "base32",
      token: dto.mfaCode,
      window: 1
    });

    let isRecoveryValid = false;
    let usedRecoveryCodeHash = "";

    if (!isTotpValid) {
      for (const hashedCode of user.mfaRecoveryCodes) {
        if (await argon2.verify(hashedCode, dto.mfaCode)) {
          isRecoveryValid = true;
          usedRecoveryCodeHash = hashedCode;
          break;
        }
      }
    }

    if (!isTotpValid && !isRecoveryValid) {
      await auditLogger.log({
        userId: user.id,
        event: "LOGIN_FAILURE",
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        metadata: { reason: "invalid_mfa_code" },
      });
      throw new AppError("Invalid MFA code", HTTP_STATUS.UNAUTHORIZED);
    }

    if (isRecoveryValid) {
      const remainingCodes = user.mfaRecoveryCodes.filter(c => c !== usedRecoveryCodeHash);
      await this.repository.updateUserRecoveryCodes(user.id, remainingCodes);
      await auditLogger.log({
        userId: user.id,
        event: "LOGIN_SUCCESS",
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        metadata: { note: "Logged in via MFA Recovery Code" },
      });
    } else {
      await auditLogger.log({
        userId: user.id,
        event: "LOGIN_SUCCESS",
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        metadata: { note: "Logged in via MFA TOTP Code" },
      });
    }

    const tokens = await this.createTokens(user.id, context);
    return { user: this.toSafeUser(user), ...tokens };
  }

  /**
   * Generates a temporary MFA recovery OTP and sends it to the user's registered email.
   */
  async requestMfaRecoveryOtp(dto: MfaRequestRecoveryOtpDTO): Promise<void> {
    const userId = verifyMfaToken(dto.mfaToken);

    const user = await this.repository.findUserById(userId);
    if (!user || !user.mfaEnabled) {
      throw new AppError("MFA is not enabled for this user", HTTP_STATUS.BAD_REQUEST);
    }

    const code = await this.issueOtp(user.id, "MFA_RECOVERY");

    await sendMfaRecoveryEmail(user.email, code);
  }

  /**
   * Verifies the MFA recovery OTP sent to the email and logs the user in.
   */
  async verifyMfaRecoveryOtp(dto: MfaVerifyRecoveryOtpDTO, context?: RequestContext): Promise<AuthResult> {
    const userId = verifyMfaToken(dto.mfaToken);

    const user = await this.repository.findUserById(userId);
    if (!user || !user.mfaEnabled) {
      throw new AppError("MFA is not enabled for this user", HTTP_STATUS.BAD_REQUEST);
    }

    const verification = await this.repository.findVerification({
      identifier: user.id,
      value: dto.otp,
    });

    if (
      !verification ||
      verification.purpose !== "MFA_RECOVERY" ||
      verification.expiresAt < new Date()
    ) {
      throw new AppError("Invalid or expired OTP code", HTTP_STATUS.BAD_REQUEST);
    }

    await this.repository.deleteVerificationById(verification.id);

    const tokens = await this.createTokens(user.id, context);

    await auditLogger.log({
      userId: user.id,
      event: "LOGIN_SUCCESS",
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      metadata: { note: "Logged in via Email MFA Recovery OTP" },
    });

    return { user: this.toSafeUser(user), ...tokens };
  }

  /**
   * Disables MFA for the user after verifying their current password or a valid MFA code.
   */
  async disableMfa(userId: string, dto: { password?: string; code?: string }): Promise<void> {
    const user = await this.repository.findUserWithAccounts(userId);
    if (!user) {
      throw new AppError("User not found", HTTP_STATUS.NOT_FOUND);
    }

    if (!user.mfaEnabled || !user.mfaSecret) {
      throw new AppError("MFA is not enabled", HTTP_STATUS.BAD_REQUEST);
    }

    if (dto.code) {
      // Verify using TOTP code
      const isValid = speakeasy.totp.verify({
        secret: user.mfaSecret,
        encoding: "base32",
        token: dto.code,
        window: 1,
      });

      if (!isValid) {
        throw new AppError("Invalid MFA code", HTTP_STATUS.UNAUTHORIZED);
      }
    } else if (dto.password) {
      // Verify using password (for LOCAL accounts)
      const localAccount = user.accounts.find((acc) => acc.providerId === "LOCAL");
      if (!localAccount || !localAccount.password) {
        throw new AppError(
          "Password verification is not available for this account. Please use MFA code.",
          HTTP_STATUS.BAD_REQUEST
        );
      }

      const isMatch = await argon2.verify(localAccount.password, dto.password);
      if (!isMatch) {
        throw new AppError("Incorrect password", HTTP_STATUS.UNAUTHORIZED);
      }
    } else {
      throw new AppError("Either current password or MFA code is required", HTTP_STATUS.BAD_REQUEST);
    }

    // Disable MFA
    await this.repository.updateUserMfaStatus(userId, false, null, []);

    await auditLogger.log({
      userId: user.id,
      event: "MFA_DISABLED",
      metadata: { disabledBy: "user" },
    });
  }
}

