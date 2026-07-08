import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../middlewares/auth.js";
export declare const sendConnectionRequest: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const respondToConnection: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getConnections: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
