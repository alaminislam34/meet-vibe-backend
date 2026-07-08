import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./db.js";
import { env } from "./env.js";
import { emailOTP } from "better-auth/plugins";
export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL || `${env.BACKEND_URL}/api/v1/auth`,
    emailAndPassword: {
        enabled: true,
        autoSignIn: false, // We handle signing in and redirection manually in controllers
    },
    plugins: [
        emailOTP({
            async sendVerificationOTP({ email, otp, type }) {
                // Log in development / stdout; hook up to your mailer in staging/production
                console.log(`✉️  [Better Auth OTP] Dispatched code to ${email}: Code = [${otp}] for [${type}]`);
            },
        }),
    ],
});
//# sourceMappingURL=auth.js.map