import { prisma } from "../config/db.js";
export const auditLogger = {
    log: async (input) => {
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
        }
        catch (error) {
            // We don't want audit logging failures to break the main application flow,
            // but we do want to record that logging failed.
            console.error("Failed to write to audit log:", error);
        }
    },
};
//# sourceMappingURL=auditLogger.js.map