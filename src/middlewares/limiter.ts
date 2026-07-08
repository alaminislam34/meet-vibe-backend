import { rateLimit } from "express-rate-limit";
import { AppError } from "../utils/errors.js";
import { HTTP_STATUS } from "../constants/index.js";

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // Limit each IP to 100 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(
      new AppError(
        "Too many requests, please try again later.",
        HTTP_STATUS.TOO_MANY_REQUESTS
      )
    );
  },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20, // Limit each IP to 20 attempts for login/register/oauth
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(
      new AppError(
        "Too many login attempts. Please try again after 15 minutes.",
        HTTP_STATUS.TOO_MANY_REQUESTS
      )
    );
  },
});
