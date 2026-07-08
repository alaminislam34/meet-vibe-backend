import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../middlewares/auth.js";
export declare const getProfile: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const updateProfile: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const verifyIdentity: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
