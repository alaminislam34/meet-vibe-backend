import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "./errors.js";
import { HTTP_STATUS } from "../constants/index.js";
export const generateAccessToken = (payload) => {
    return jwt.sign(payload, env.JWT_SECRET, {
        expiresIn: "15m",
    });
};
export const verifyAccessToken = (token) => {
    try {
        return jwt.verify(token, env.JWT_SECRET);
    }
    catch (error) {
        throw new AppError("Invalid or expired access token", HTTP_STATUS.UNAUTHORIZED);
    }
};
export const generateMfaToken = (userId) => {
    return jwt.sign({ userId, mfaToken: true }, env.JWT_SECRET, {
        expiresIn: "5m", // Valid for 5 minutes
    });
};
export const verifyMfaToken = (token) => {
    try {
        const payload = jwt.verify(token, env.JWT_SECRET);
        if (!payload.mfaToken)
            throw new Error();
        return payload.userId;
    }
    catch (error) {
        throw new AppError("Invalid or expired MFA token", HTTP_STATUS.UNAUTHORIZED);
    }
};
//# sourceMappingURL=jwt.js.map