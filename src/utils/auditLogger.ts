import { prisma } from "../config/db.js";

export type AuditEvent = 
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILURE"
  | "PASSWORD_RESET"
  | "ACCOUNT_LOCKED"
  | "LOGOUT"
  | "REGISTER";

interface AuditLogInput {
  userId?: string;
  event: AuditEvent;
  ipAddress?: string;
  userAgent?: string;
  metadata?: any;
}

export const auditLogger = {
  log: async (input: AuditLogInput): Promise<void> => {
    try {
      await prisma.auditLog.create({
        data: {
          userId: input.userId,
          event: input.event,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          metadata: input.metadata ? input.metadata : undefined,
        },
      });
    } catch (error) {
      // We don't want audit logging failures to break the main application flow,
      // but we do want to record that logging failed.
      console.error("Failed to write to audit log:", error);
    }
  },
};
