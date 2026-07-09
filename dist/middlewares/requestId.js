import crypto from "crypto";
export const requestId = (req, res, next) => {
    const reqId = req.headers["x-request-id"] || crypto.randomUUID();
    req.headers["x-request-id"] = reqId;
    res.setHeader("X-Request-ID", reqId);
    next();
};
//# sourceMappingURL=requestId.js.map