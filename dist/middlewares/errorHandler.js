export const errorHandler = (err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let message = err.message || "Internal Server Error";
    let errors = err.errors || undefined;
    // Distinguish server crashes from predictable API errors
    if (statusCode === 500) {
        console.error("[CRITICAL SERVER ERROR]:", err);
    }
    else {
        console.warn(`[API WARNING] ${req.method} ${req.path}: ${message}`);
    }
    const isDev = process.env.NODE_ENV === "development";
    res.status(statusCode).json({
        status: "error",
        statusCode,
        message,
        errors,
        ...(isDev && { stack: err.stack }),
    });
};
//# sourceMappingURL=errorHandler.js.map