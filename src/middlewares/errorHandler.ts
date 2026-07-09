import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors.js";

const isDev = process.env.NODE_ENV === "development";

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";
  let errors = err.errors || undefined;

  // Distinguish server crashes from predictable API errors
  if (statusCode === 500) {
    console.error("[CRITICAL SERVER ERROR]:", err);
  } else {
    console.warn(`[API WARNING] ${req.method} ${req.path}: ${message}`);
  }


  res.status(statusCode).json({
    status: "error",
    statusCode,
    message,
    errors,
    ...(isDev && { stack: err.stack }),
  });
};
