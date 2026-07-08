import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "./errors.js";
import { HTTP_STATUS } from "../constants/index.js";

interface TokenPayload {
  userId: string;
}

export const generateToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as any,
  });
};

export const verifyToken = (token: string): TokenPayload => {
  try {
    return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
  } catch (error) {
    throw new AppError("Invalid or expired session token", HTTP_STATUS.UNAUTHORIZED);
  }
};
