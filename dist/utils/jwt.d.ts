interface TokenPayload {
    userId: string;
}
export declare const generateToken: (payload: TokenPayload) => string;
export declare const verifyToken: (token: string) => TokenPayload;
export {};
