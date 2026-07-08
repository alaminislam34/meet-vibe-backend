import { Request, Response, NextFunction } from "express";
export declare const register: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const login: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const logout: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const googleLogin: (req: Request, res: Response) => void;
export declare const googleCallback: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const appleLogin: (req: Request, res: Response) => void;
export declare const appleCallback: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const forgotPassword: (req: Request, res: Response, next: NextFunction) => Promise<void>;
