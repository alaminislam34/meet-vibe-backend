import dotenv from "dotenv";
import { z } from "zod";

// Load environment variables from .env file
dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  BACKEND_URL: z.string().url().default("http://localhost:5000"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(8, "JWT_SECRET must be at least 8 characters long"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  
  // Google OAuth Config
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().optional(),

  // Apple OAuth Config
  APPLE_CLIENT_ID: z.string().optional(),
  APPLE_TEAM_ID: z.string().optional(),
  APPLE_KEY_ID: z.string().optional(),
  APPLE_PRIVATE_KEY: z.string().optional(),
  APPLE_CALLBACK_URL: z.string().optional(),

  // AWS Rekognition Config
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().optional(),
  AWS_S3_BUCKET_NAME: z.string().optional(),

  // Stripe Config
  STRIPE_API_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // SMTP Mail Config
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  // Better Auth
  BETTER_AUTH_SECRET: z.string().default("development-auth-secret-key-at-least-32-characters-long"),
  BETTER_AUTH_URL: z.string().optional(),
});

// Run validation
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("❌ Environment validation failed:", parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;
