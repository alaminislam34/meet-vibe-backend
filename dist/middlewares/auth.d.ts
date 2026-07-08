import { Request, Response, NextFunction } from "express";
import { User } from "@prisma/client";
export interface AuthenticatedRequest extends Request {
    user?: User;
}
export declare const requireAuth: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
