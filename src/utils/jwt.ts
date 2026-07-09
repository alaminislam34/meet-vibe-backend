import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "./errors.js";
import { HTTP_STATUS } from "../constants/index.js";

interface TokenPayload {
  userId: string;
  sessionId: string;
}

export const generateAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: "15m",
  });
};

export const verifyAccessToken = (token: string): TokenPayload => {
  try {
    return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
  } catch (error) {
    throw new AppError("Invalid or expired access token", HTTP_STATUS.UNAUTHORIZED);
  }
};

export const generateMfaToken = (userId: string): string => {
  return jwt.sign({ userId, mfaToken: true }, env.JWT_SECRET, {
    expiresIn: "5m", // Valid for 5 minutes
  });
};

export const verifyMfaToken = (token: string): string => {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as any;
    if (!payload.mfaToken) throw new Error();
    return payload.userId;
  } catch (error) {
    throw new AppError("Invalid or expired MFA token", HTTP_STATUS.UNAUTHORIZED);
  }
};
