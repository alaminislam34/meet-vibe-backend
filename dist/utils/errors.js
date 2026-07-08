export class AppError extends Error {
    statusCode;
    isOperational;
    errors;
    constructor(message, statusCode, errors, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.errors = errors;
        // Capture stack trace for easier debugging
        Error.captureStackTrace(this, this.constructor);
    }
}
//# sourceMappingURL=errors.js.map