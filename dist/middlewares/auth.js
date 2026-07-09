import { prisma } from "../config/db.js";
import { AppError } from "../utils/errors.js";
import { HTTP_STATUS } from "../constants/index.js";
import { verifyAccessToken } from "../utils/jwt.js";
export const requireAuth = async (req, res, next) => {
    try {
        // 1. Extract access token from HttpOnly cookie or Authorization header
        let token = req.cookies?.access_token;
        if (!token && req.headers.authorization?.startsWith("Bearer ")) {
            token = req.headers.authorization.split(" ")[1];
        }
        if (!token) {
            throw new AppError("Authentication required", HTTP_STATUS.UNAUTHORIZED);
        }
        // 2. Verify JWT access token (throws if expired or invalid)
        const payload = verifyAccessToken(token);
        // 3. Fetch user from DB
        const user = await prisma.user.findUnique({
            where: { id: payload.userId },
        });
        if (!user) {
            throw new AppError("User account no longer exists", HTTP_STATUS.UNAUTHORIZED);
        }
        if (user.deletedAt) {
            throw new AppError("User account no longer exists", HTTP_STATUS.UNAUTHORIZED);
        }
        // 4. Attach user to request
        req.user = user;
        next();
    }
    catch (error) {
        if (error instanceof AppError) {
            next(error);
        }
        else {
            next(new AppError("Authentication required", HTTP_STATUS.UNAUTHORIZED));
        }
    }
};
//# sourceMappingURL=auth.js.map