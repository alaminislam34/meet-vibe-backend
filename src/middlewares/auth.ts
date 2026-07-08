import { Request, Response, NextFunction } from "express";
import { User } from "@prisma/client";
import { verifyToken } from "../utils/jwt.js";
import { prisma } from "../config/db.js";
import { AppError } from "../utils/errors.js";
import { HTTP_STATUS } from "../constants/index.js";

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 1. Extract token from HttpOnly cookie or Authorization header
    let token = req.cookies?.meet_vibe_token;

    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      throw new AppError("Authentication required", HTTP_STATUS.UNAUTHORIZED);
    }

    // 2. Verify JWT signature and expiry
    const decoded = verifyToken(token);

    // 3. Fetch user from DB to ensure the account still exists
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      throw new AppError("User account no longer exists", HTTP_STATUS.UNAUTHORIZED);
    }

    // 4. Attach user to request
    req.user = user;
    next();
  } catch (error) {
    next(new AppError("Authentication required", HTTP_STATUS.UNAUTHORIZED));
  }
};
