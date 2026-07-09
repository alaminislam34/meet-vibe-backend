import crypto from "crypto";
import { Request, Response, NextFunction } from "express";

export const requestId = (req: Request, res: Response, next: NextFunction): void => {
  const reqId = req.headers["x-request-id"] || crypto.randomUUID();
  req.headers["x-request-id"] = reqId;
  res.setHeader("X-Request-ID", reqId);
  next();
};
