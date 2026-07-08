import { z } from "zod";
export const registerSchema = z.object({
    body: z.object({
        email: z.string().email("Invalid email address"),
        password: z.string().min(8, "Password must be at least 8 characters"),
        name: z.string().min(2, "Name must be at least 2 characters"),
    }),
});
export const loginSchema = z.object({
    body: z.object({
        email: z.string().email("Invalid email address"),
        password: z.string().min(1, "Password is required"),
    }),
});
export const verifyOtpSchema = z.object({
    body: z.object({
        email: z.string().email("Invalid email address"),
        otp: z.string().length(6, "OTP must be 6 digits"),
    }),
});
export const resendOtpSchema = z.object({
    body: z.object({
        email: z.string().email("Invalid email address"),
    }),
});
export const forgotPasswordSchema = z.object({
    body: z.object({
        email: z.string().email("Invalid email address"),
    }),
});
export const resetPasswordSchema = z.object({
    body: z.object({
        email: z.string().email("Invalid email address"),
        otp: z.string().length(6, "OTP must be 6 digits"),
        password: z.string().min(8, "Password must be at least 8 characters"),
    }),
});
//# sourceMappingURL=auth.validator.js.map