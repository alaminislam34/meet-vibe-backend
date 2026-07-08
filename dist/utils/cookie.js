import { env } from "../config/env.js";
const COOKIE_NAME = "meet_vibe_token";
export const setAuthCookie = (res, token) => {
    res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days matching token expiration
    });
};
export const clearAuthCookie = (res) => {
    res.clearCookie(COOKIE_NAME, {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: env.NODE_ENV === "production" ? "none" : "lax",
    });
};
//# sourceMappingURL=cookie.js.map