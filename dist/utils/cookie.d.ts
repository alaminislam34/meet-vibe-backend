import { Response } from "express";
export declare const setAuthCookie: (res: Response, token: string) => void;
export declare const clearAuthCookie: (res: Response) => void;
