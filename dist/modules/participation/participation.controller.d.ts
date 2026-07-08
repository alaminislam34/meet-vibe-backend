import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../middlewares/auth.js";
export declare const joinEvent: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const submitPayment: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const reviewParticipation: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
