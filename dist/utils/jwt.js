import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "./errors.js";
import { HTTP_STATUS } from "../constants/index.js";
export const generateToken = (payload) => {
    return jwt.sign(payload, env.JWT_SECRET, {
        expiresIn: env.JWT_EXPIRES_IN,
    });
};
export const verifyToken = (token) => {
    try {
        return jwt.verify(token, env.JWT_SECRET);
    }
    catch (error) {
        throw new AppError("Invalid or expired session token", HTTP_STATUS.UNAUTHORIZED);
    }
};
//# sourceMappingURL=jwt.js.map