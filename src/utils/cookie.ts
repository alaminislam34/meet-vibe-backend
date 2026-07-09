import { Response } from "express";
import { env } from "../config/env.js";

const ACCESS_COOKIE = "access_token";
const REFRESH_COOKIE = "refresh_token";

export const setAuthCookies = (res: Response, accessToken: string, refreshToken: string): void => {
  const isProduction = env.NODE_ENV === "production";
  
  const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict" as const, // Strict to prevent CSRF attacks
  };

  res.cookie(ACCESS_COOKIE, accessToken, {
    ...cookieOptions,
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

export const clearAuthCookies = (res: Response): void => {
  const isProduction = env.NODE_ENV === "production";
  
  const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict" as const,
  };

  res.clearCookie(ACCESS_COOKIE, cookieOptions);
  res.clearCookie(REFRESH_COOKIE, cookieOptions);
};
