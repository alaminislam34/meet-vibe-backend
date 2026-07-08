import { z } from "zod";
export const joinEventSchema = z.object({
    body: z.object({
        eventId: z.string().uuid("Invalid event ID format"),
    }),
});
export const submitPaymentSchema = z.object({
    body: z.object({
        eventId: z.string().uuid("Invalid event ID format"),
        transactionId: z.string().min(5, "Transaction ID must be at least 5 characters"),
    }),
});
export const reviewParticipationSchema = z.object({
    body: z.object({
        participantId: z.string().uuid("Invalid participant ID format"),
        action: z.enum(["APPROVED", "REJECTED"]),
    }),
});
//# sourceMappingURL=participation.validator.js.map