import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../middlewares/auth.js";
export declare const getGroupMessages: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const sendGroupMessage: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getPrivateMessages: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const sendPrivateMessage: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
