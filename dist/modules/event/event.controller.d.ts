import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../middlewares/auth.js";
export declare const saveDraft: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const publishEvent: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getEvent: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const listEvents: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const deleteEvent: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
