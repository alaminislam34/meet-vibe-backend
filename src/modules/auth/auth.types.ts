import { User, Account, Session, Verification } from "@prisma/client";

// ─── Data Transfer Objects (DTOs) ────────────────────────────────────────────
// DTOs define the shape of data entering the system from HTTP requests.
// They are validated by Zod before reaching the service layer.

export interface RegisterDTO {
  email: string;
  password: string;
  name: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface MfaLoginDTO {
  mfaToken: string;
  mfaCode: string;
}

export interface VerifyOtpDTO {
  email: string;
  otp: string;
}

export interface ResendOtpDTO {
  email: string;
}

export interface ForgotPasswordDTO {
  email: string;
}

export interface ResetPasswordDTO {
  email: string;
  otp: string;
  password: string;
}

// ─── Internal Request Context ─────────────────────────────────────────────────
// Captures network metadata forwarded from the controller to the service
// for session tracking and audit logging purposes.

export interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
}

// ─── Safe User ────────────────────────────────────────────────────────────────
// The explicit public-facing shape of a user — fields safe to return
// in API responses. Never includes credentials or internal flags.

export type SafeUser = Pick<
  User,
  | "id"
  | "email"
  | "name"
  | "image"
  | "isVerified"
  | "verificationStatus"
  | "is18Plus"
  | "isHuman"
  | "mfaEnabled"
  | "createdAt"
>;

// ─── Auth Result ──────────────────────────────────────────────────────────────
// The standard return shape from auth operations that both authenticate
// a user and establish a session (login, verifyOtp, oauthCallback).

export interface AuthResult {
  user: SafeUser;
  accessToken: string;
  refreshToken: string;
}

export interface MfaRequiredResult {
  mfaRequired: true;
  mfaToken: string;
}

export type LoginResult = AuthResult | MfaRequiredResult;

// ─── Repository Input Types ───────────────────────────────────────────────────
// Typed inputs for repository methods — decouples the service layer from
// Prisma's generated `*CreateInput` types to allow DB-agnostic testing.

export interface CreateUserInput {
  email: string;
  name: string;
}

export interface CreateAccountInput {
  userId: string;
  providerId: string;
  accountId: string;
  password?: string;
}

export interface CreateSessionInput {
  userId: string;
  token: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
  familyId: string;
}

export interface CreateVerificationInput {
  identifier: string;
  value: string;
  expiresAt: Date;
  purpose: VerificationPurpose;
}

export interface FindVerificationInput {
  identifier: string;
  value: string;
}

// ─── Enumerations ─────────────────────────────────────────────────────────────
// Typed string literal union for verification purposes — avoids magic strings
// scattered across the codebase. Use this everywhere instead of raw strings.

export type VerificationPurpose = "EMAIL_VERIFICATION" | "PASSWORD_RESET";

export type OAuthProvider = "GOOGLE" | "APPLE";

// ─── OAuth Profile ────────────────────────────────────────────────────────────
// Normalized shape of a third-party OAuth profile, regardless of provider.
// Maps Google/Apple profile fields into a consistent internal structure.

export interface OAuthProfile {
  id: string;
  email: string;
  name: string;
  image?: string;
}

// ─── Extended Prisma Types ────────────────────────────────────────────────────
// Prisma relation types used internally by the repository layer.

export type UserWithAccounts = User & {
  accounts: Account[];
};

export type AccountWithUser = Account & {
  user: User;
};

export type SessionWithUser = Session & {
  user: User;
};
