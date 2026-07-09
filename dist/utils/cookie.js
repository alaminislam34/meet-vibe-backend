import { env } from "../config/env.js";
const ACCESS_COOKIE = "access_token";
const REFRESH_COOKIE = "refresh_token";
export const setAuthCookies = (res, accessToken, refreshToken) => {
    const isProduction = env.NODE_ENV === "production";
    const cookieOptions = {
        httpOnly: true,
        secure: isProduction,
        sameSite: "strict", // Strict to prevent CSRF attacks
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
export const clearAuthCookies = (res) => {
    const isProduction = env.NODE_ENV === "production";
    const cookieOptions = {
        httpOnly: true,
        secure: isProduction,
        sameSite: "strict",
    };
    res.clearCookie(ACCESS_COOKIE, cookieOptions);
    res.clearCookie(REFRESH_COOKIE, cookieOptions);
};
//# sourceMappingURL=cookie.js.map