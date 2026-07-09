import nodemailer from "nodemailer";
import { env } from "../config/env.js";
// Create a transporter only if SMTP settings are provided, to prevent crashing in dev if unset
const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465, // true for 465, false for other ports
    auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
    },
});
export const sendVerificationEmail = async (to, otp) => {
    if (!env.SMTP_HOST || !env.SMTP_USER) {
        console.log(`[Development Mode] Mock Verification Email to ${to}. OTP: ${otp}`);
        return;
    }
    const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e1e1e1; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #2563eb; padding: 20px; text-align: center;">
        <h2 style="color: white; margin: 0;">Meet Vibe Verification</h2>
      </div>
      <div style="padding: 30px; text-align: center;">
        <p style="font-size: 16px; color: #333;">Your verification code is:</p>
        <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h1 style="margin: 0; font-size: 32px; letter-spacing: 5px; color: #1f2937;">${otp}</h1>
        </div>
        <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">This code will expire in 10 minutes.</p>
        <p style="font-size: 14px; color: #6b7280;">If you didn't request this code, you can safely ignore this email.</p>
      </div>
    </div>
  `;
    try {
        await transporter.sendMail({
            from: env.SMTP_FROM || '"Meet Vibe" <noreply@meetvibe.com>',
            to,
            subject: "Your Verification Code - Meet Vibe",
            html: htmlContent,
        });
    }
    catch (error) {
        console.error("Failed to send verification email:", error);
        throw new Error("Failed to send email. Please try again later.");
    }
};
export const sendPasswordResetEmail = async (to, otp) => {
    if (!env.SMTP_HOST || !env.SMTP_USER) {
        console.log(`[Development Mode] Mock Password Reset Email to ${to}. OTP: ${otp}`);
        return;
    }
    const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e1e1e1; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #dc2626; padding: 20px; text-align: center;">
        <h2 style="color: white; margin: 0;">Meet Vibe Password Reset</h2>
      </div>
      <div style="padding: 30px; text-align: center;">
        <p style="font-size: 16px; color: #333;">We received a request to reset your password.</p>
        <p style="font-size: 16px; color: #333;">Use the following code to reset it:</p>
        <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h1 style="margin: 0; font-size: 32px; letter-spacing: 5px; color: #1f2937;">${otp}</h1>
        </div>
        <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">This code will expire in 10 minutes.</p>
        <p style="font-size: 14px; color: #6b7280;">If you didn't request a password reset, you can safely ignore this email.</p>
      </div>
    </div>
  `;
    try {
        await transporter.sendMail({
            from: env.SMTP_FROM || '"Meet Vibe" <noreply@meetvibe.com>',
            to,
            subject: "Password Reset Request - Meet Vibe",
            html: htmlContent,
        });
    }
    catch (error) {
        console.error("Failed to send password reset email:", error);
        throw new Error("Failed to send email. Please try again later.");
    }
};
//# sourceMappingURL=mailer.js.map