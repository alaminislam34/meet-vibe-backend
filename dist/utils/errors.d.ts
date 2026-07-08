export declare class AppError extends Error {
    readonly statusCode: number;
    readonly isOperational: boolean;
    readonly errors?: any;
    constructor(message: string, statusCode: number, errors?: any, isOperational?: boolean);
}
