import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../middlewares/auth.js";
export declare const purchaseSubscription: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getSubscriptionStatus: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
